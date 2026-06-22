import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureUser, jsonError, readTelegramRequest } from '@/lib/telegramAuth';

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function publicCaseReward(item) {
  const catalog = item?.gift_catalog || item?.catalog || null;

  if (item?.reward_type === 'coin') {
    const title = item.coin_type === 'stars'
      ? `${toNumber(item.coin_amount)} Stars`
      : `${toNumber(item.coin_amount)} Balance coin`;

    return {
      id: item.id,
      case_gift_id: item.id,
      case_id: item.case_id,
      reward_type: 'coin',
      coin_type: item.coin_type || 'balance',
      coin_amount: toNumber(item.coin_amount),
      title,
      type: item.coin_type === 'stars' ? 'stars' : 'bonus',
      value: toNumber(item.coin_amount),
      chance: toNumber(item.chance),
      stock: toNumber(item.stock),
      image_url: null,
      animation_url: null,
      background_value: item.coin_type === 'stars'
        ? 'linear-gradient(135deg,#f59e0b 0%,#fde68a 45%,#4a2600 100%)'
        : 'linear-gradient(135deg,#38bdf8 0%,#2563eb 48%,#07172f 100%)',
      rarity: 'rare',
      is_active: item.is_active !== false,
    };
  }

  return {
    id: item.id,
    case_gift_id: item.id,
    case_id: item.case_id,
    reward_type: 'nft',
    type: 'telegram_gift',
    catalog_gift_id: item.catalog_gift_id,
    title: catalog?.title || 'Telegram Gift',
    value: catalog?.display_price || catalog?.star_price || null,
    chance: toNumber(item.chance),
    stock: toNumber(item.stock),
    image_url: catalog?.image_url || null,
    animation_url: catalog?.animation_url || null,
    background_value: catalog?.background_value || null,
    rarity: catalog?.rarity || 'common',
    media_type: catalog?.media_type || null,
    gift_kind: catalog?.gift_kind || null,
    is_active: item.is_active !== false && catalog?.is_active !== false,
    catalog,
  };
}

function publicLegacyGift(gift) {
  return {
    id: gift.id,
    case_id: gift.case_id,
    reward_type: 'legacy',
    title: gift.title,
    type: gift.type,
    value: gift.value,
    chance: toNumber(gift.chance),
    stock: toNumber(gift.stock),
    is_active: gift.is_active,
    image_url: gift.image_url || null,
    animation_url: gift.animation_url || null,
    background_value: gift.background_value || null,
    rarity: gift.rarity || null,
    created_at: gift.created_at,
  };
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + toNumber(item.chance), 0);
  let point = Math.random() * total;

  for (const item of items) {
    point -= toNumber(item.chance);
    if (point <= 0) return item;
  }

  return items[items.length - 1];
}

async function pickFromCaseRewards(supabase, caseId) {
  const { data, error } = await supabase
    .from('case_gifts')
    .select('*, gift_catalog(*)')
    .eq('case_id', caseId)
    .eq('is_active', true)
    .gt('chance', 0)
    .gt('stock', 0);

  if (error) return { pool: [], error: null };

  const pool = (data || []).filter((item) => {
    if (item.reward_type === 'coin') return toNumber(item.coin_amount) > 0;
    return item.gift_catalog && item.gift_catalog.is_active !== false && (item.gift_catalog.image_url || item.gift_catalog.animation_url || item.gift_catalog.title);
  });

  return { pool, error: null };
}

async function pickFromLegacyGifts(supabase, caseId) {
  const { data, error } = await supabase
    .from('gifts')
    .select('*')
    .eq('case_id', caseId)
    .eq('is_active', true)
    .gt('stock', 0)
    .gt('chance', 0);

  if (error) return { pool: [] };
  return { pool: data || [] };
}

export async function POST(request) {
  try {
    const auth = await readTelegramRequest(request);
    if (!auth.ok) return jsonError(auth.error, auth.status);

    const { caseId } = auth.body || {};
    if (!caseId) return jsonError('caseId kerak');

    const supabase = getSupabaseAdmin();
    const dbUser = await ensureUser(auth.telegramUser);

    if (dbUser.is_banned) return jsonError('Siz bloklangansiz', 403);

    const { data: caseItem, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (caseError || !caseItem) return jsonError('Case topilmadi', 404);
    if (caseItem.is_active === false) return jsonError('Bu case aktiv emas');

    const casePrice = Math.max(toNumber(caseItem.price), 0);
    const userBalance = toNumber(dbUser.balance);

    if (userBalance < casePrice) {
      return jsonError(`Balans yetarli emas. Kerak: ${casePrice}, balans: ${userBalance}`);
    }

    let source = 'case_gifts';
    let { pool } = await pickFromCaseRewards(supabase, caseId);

    if (!pool.length) {
      const legacy = await pickFromLegacyGifts(supabase, caseId);
      pool = legacy.pool;
      source = 'legacy_gifts';
    }

    if (!pool.length) {
      return jsonError('Bu case ichida aktiv, stock bor reward yo‘q. Admin panelda Case Rewards bo‘limidan moneta yoki Telegram gift qo‘shing.', 400);
    }

    const totalChance = pool.reduce((sum, item) => sum + toNumber(item.chance), 0);
    if (totalChance <= 0) return jsonError('Chance sozlamasi noto‘g‘ri');

    const selected = weightedPick(pool);
    const gift = source === 'case_gifts' ? publicCaseReward(selected) : publicLegacyGift(selected);

    const rewardBalance = gift.reward_type === 'coin' && gift.coin_type === 'balance' ? toNumber(gift.coin_amount) : 0;
    const rewardValue = toNumber(gift.value || gift.coin_amount || 0);
    const nextBalance = userBalance - casePrice + rewardBalance;

    if (source === 'case_gifts') {
      const { data: stockRow, error: stockError } = await supabase
        .from('case_gifts')
        .update({ stock: Math.max(0, toNumber(selected.stock) - 1) })
        .eq('id', selected.id)
        .gt('stock', 0)
        .select('id, stock')
        .single();

      if (stockError || !stockRow) return jsonError('Reward stocki tugab qoldi. Qayta urinib ko‘ring.', 409);
      gift.stock = toNumber(stockRow.stock);
    } else {
      const { data: stockRow, error: stockError } = await supabase
        .from('gifts')
        .update({ stock: Math.max(0, toNumber(selected.stock) - 1) })
        .eq('id', selected.id)
        .gt('stock', 0)
        .select('id, stock')
        .single();

      if (stockError || !stockRow) return jsonError('Sovg‘a stocki tugab qoldi. Qayta urinib ko‘ring.', 409);
      gift.stock = toNumber(stockRow.stock);
    }

    const { data: updatedUser, error: balanceError } = await supabase
      .from('users')
      .update({ balance: nextBalance })
      .eq('id', auth.telegramUser.id)
      .select('*')
      .single();

    if (balanceError) throw new Error(balanceError.message);

    const historyPayload = {
      user_id: auth.telegramUser.id,
      case_id: caseId,
      gift_id: source === 'legacy_gifts' ? gift.id : null,
      case_gift_id: source === 'case_gifts' ? selected.id : null,
      catalog_gift_id: gift.catalog_gift_id || null,
      reward_type: gift.reward_type,
      reward_title: gift.title,
      reward_value: rewardValue,
      reward_image_url: gift.image_url,
      reward_animation_url: gift.animation_url,
      reward_background_value: gift.background_value,
      reward_rarity: gift.rarity,
      coin_type: gift.coin_type || null,
      coin_amount: gift.coin_amount || null,
      case_price: casePrice,
      balance_before: userBalance,
      balance_after: nextBalance,
    };

    const { data: history, error: historyError } = await supabase
      .from('open_history')
      .insert(historyPayload)
      .select('*')
      .single();

    if (historyError) throw new Error(historyError.message);

    return Response.json({
      ok: true,
      case: caseItem,
      gift,
      balance: toNumber(updatedUser.balance),
      balanceBefore: userBalance,
      balanceAfter: toNumber(updatedUser.balance),
      price: casePrice,
      history,
      reelPool: source === 'case_gifts' ? pool.map(publicCaseReward) : pool.map(publicLegacyGift),
      opening: {
        totalChance,
        poolSize: pool.length,
        source,
        openedAt: history.created_at,
      },
    });
  } catch (error) {
    return jsonError(error.message || 'Server xatosi', 500);
  }
}
