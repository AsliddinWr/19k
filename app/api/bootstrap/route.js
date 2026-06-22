import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureUser, jsonError, readTelegramRequest } from '@/lib/telegramAuth';

function normalizeCatalogGift(gift) {
  return {
    ...(gift || {}),
    reward_type: 'nft',
    catalog: gift || null,
    title: gift?.title || 'Telegram Gift',
    image_url: gift?.image_url || null,
    animation_url: gift?.animation_url || null,
    background_value: gift?.background_value || null,
    rarity: gift?.rarity || 'common',
  };
}

function normalizeCaseGift(item) {
  const catalog = item?.gift_catalog || item?.catalog || null;

  if (item?.reward_type === 'coin') {
    return {
      ...item,
      title: item.coin_type === 'stars' ? `${item.coin_amount || 0} Stars` : `${item.coin_amount || 0} Balance coin`,
      value: item.coin_amount,
      image_url: null,
      animation_url: null,
      background_value: item.coin_type === 'stars'
        ? 'linear-gradient(135deg,#f59e0b 0%,#fde68a 45%,#4a2600 100%)'
        : 'linear-gradient(135deg,#38bdf8 0%,#2563eb 48%,#07172f 100%)',
      rarity: 'rare',
      catalog: null,
    };
  }

  return {
    ...item,
    reward_type: 'nft',
    catalog,
    title: catalog?.title || item?.title || 'Telegram Gift',
    value: catalog?.display_price || catalog?.star_price || item?.value || null,
    image_url: catalog?.image_url || item?.image_url || null,
    animation_url: catalog?.animation_url || item?.animation_url || null,
    background_value: catalog?.background_value || item?.background_value || null,
    rarity: catalog?.rarity || item?.rarity || 'common',
  };
}

export async function POST(request) {
  try {
    const auth = await readTelegramRequest(request);

    if (!auth.ok) return jsonError(auth.error, auth.status);

    const supabase = getSupabaseAdmin();
    const dbUser = await ensureUser(auth.telegramUser);

    if (dbUser.is_banned) return jsonError('Siz bloklangansiz', 403);

    let casesQuery = supabase.from('cases').select('*').order('created_at', { ascending: false });
    let caseGiftsQuery = supabase
      .from('case_gifts')
      .select('*, gift_catalog(*)')
      .order('created_at', { ascending: false });

    if (!auth.isAdmin) {
      casesQuery = casesQuery.eq('is_active', true);
      caseGiftsQuery = caseGiftsQuery.eq('is_active', true);
    }

    const [casesResult, caseGiftsResult, catalogResult, historyResult, withdrawResult] = await Promise.all([
      casesQuery,
      caseGiftsQuery,
      supabase
        .from('gift_catalog')
        .select('*')
        .order('star_price', { ascending: true })
        .order('title', { ascending: true }),
      supabase
        .from('open_history')
        .select('*')
        .eq('user_id', auth.telegramUser.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('withdraw_requests')
        .select('*')
        .eq('user_id', auth.telegramUser.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (casesResult.error) throw new Error(casesResult.error.message);
    if (caseGiftsResult.error) throw new Error(caseGiftsResult.error.message);
    if (catalogResult.error) throw new Error(catalogResult.error.message);
    if (historyResult.error) throw new Error(historyResult.error.message);
    if (withdrawResult.error) throw new Error(withdrawResult.error.message);

    const catalog = (catalogResult.data || []).map(normalizeCatalogGift);
    const caseGifts = (caseGiftsResult.data || []).map(normalizeCaseGift);

    return Response.json({
      ok: true,
      user: dbUser,
      telegramUser: auth.telegramUser,
      isAdmin: auth.isAdmin,
      cases: casesResult.data || [],
      gifts: caseGifts,
      caseGifts,
      giftCatalog: catalog,
      history: historyResult.data || [],
      withdrawals: withdrawResult.data || [],
    });
  } catch (error) {
    return jsonError(error.message || 'Server xatosi', 500);
  }
}
