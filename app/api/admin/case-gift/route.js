import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonError, readTelegramRequest } from '@/lib/telegramAuth';

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function validateChanceLimit(supabase, { caseId, caseGiftId = null, nextChance = 0, nextActive = true }) {
  const { data, error } = await supabase
    .from('case_gifts')
    .select('id, chance, is_active')
    .eq('case_id', caseId);

  if (error) throw new Error(error.message);

  const activeSum = (data || [])
    .filter((item) => String(item.id) !== String(caseGiftId || ''))
    .filter((item) => item.is_active !== false)
    .reduce((sum, item) => sum + toNumber(item.chance), 0);

  const finalSum = activeSum + (nextActive ? toNumber(nextChance) : 0);

  if (finalSum > 100) {
    return {
      ok: false,
      error: `Chance jami 100% dan oshdi. Hozir: ${activeSum}%, yangi bilan: ${finalSum}%. Qolgan limit: ${Math.max(0, 100 - activeSum)}%.`,
      activeSum,
      finalSum,
      remaining: Math.max(0, 100 - activeSum),
    };
  }

  return { ok: true, activeSum, finalSum, remaining: Math.max(0, 100 - finalSum) };
}

async function assertCaseExists(supabase, caseId) {
  const { data, error } = await supabase.from('cases').select('id').eq('id', caseId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function assertCatalogGiftExists(supabase, giftId) {
  const { data, error } = await supabase.from('gift_catalog').select('id').eq('id', giftId).eq('is_active', true).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function POST(request) {
  try {
    const auth = await readTelegramRequest(request);
    if (!auth.ok) return jsonError(auth.error, auth.status);
    if (!auth.isAdmin) return jsonError('Admin ruxsati yo‘q', 403);

    const supabase = getSupabaseAdmin();
    const body = auth.body || {};
    const { action, caseGiftId } = body;

    if (action === 'list') {
      const { data, error } = await supabase
        .from('case_gifts')
        .select('*, gift_catalog(*)')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, caseGifts: data || [] });
    }

    if (action === 'create') {
      const caseId = cleanText(body.case_id);
      const rewardType = cleanText(body.reward_type) || 'nft';
      const chance = toNumber(body.chance);
      const stock = Math.floor(toNumber(body.stock));
      const isActive = true;

      if (!caseId) return jsonError('Case tanlang');
      if (!(await assertCaseExists(supabase, caseId))) return jsonError('Case topilmadi', 404);
      if (!['coin', 'nft'].includes(rewardType)) return jsonError('Sovg‘a turi noto‘g‘ri');
      if (chance <= 0 || chance > 100) return jsonError('Tushish foizi 0 dan katta va 100 dan oshmasligi kerak');
      if (stock <= 0) return jsonError('Stock kamida 1 bo‘lishi kerak');

      const chanceCheck = await validateChanceLimit(supabase, { caseId, nextChance: chance, nextActive: isActive });
      if (!chanceCheck.ok) return jsonError(chanceCheck.error, 400, chanceCheck);

      const payload = {
        case_id: caseId,
        reward_type: rewardType,
        chance,
        stock,
        is_active: isActive,
      };

      if (rewardType === 'coin') {
        const coinType = cleanText(body.coin_type) || 'balance';
        const coinAmount = toNumber(body.coin_amount);
        if (!['balance', 'stars'].includes(coinType)) return jsonError('Moneta turi noto‘g‘ri');
        if (coinAmount <= 0) return jsonError('Moneta miqdori 0 dan katta bo‘lsin');
        payload.coin_type = coinType;
        payload.coin_amount = coinAmount;
        payload.catalog_gift_id = null;
      } else {
        const catalogGiftId = cleanText(body.catalog_gift_id);
        if (!catalogGiftId) return jsonError('Gift Catalog’dan NFT gift tanlang');
        if (!(await assertCatalogGiftExists(supabase, catalogGiftId))) return jsonError('Tanlangan gift topilmadi yoki aktiv emas', 404);
        payload.catalog_gift_id = catalogGiftId;
        payload.coin_type = null;
        payload.coin_amount = null;
      }

      const { data, error } = await supabase
        .from('case_gifts')
        .insert(payload)
        .select('*, gift_catalog(*)')
        .single();

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, caseGift: data, chance: chanceCheck });
    }

    if (action === 'update') {
      if (!caseGiftId) return jsonError('caseGiftId kerak');

      const { data: current, error: currentError } = await supabase
        .from('case_gifts')
        .select('*')
        .eq('id', caseGiftId)
        .single();

      if (currentError || !current) return jsonError('Case sovg‘asi topilmadi', 404);

      const nextCaseId = body.case_id !== undefined ? cleanText(body.case_id) : current.case_id;
      const nextChance = body.chance !== undefined ? toNumber(body.chance) : toNumber(current.chance);
      const nextStock = body.stock !== undefined ? Math.floor(toNumber(body.stock)) : Math.floor(toNumber(current.stock));
      const nextActive = body.is_active !== undefined ? Boolean(body.is_active) : current.is_active !== false;

      if (!nextCaseId) return jsonError('Case tanlang');
      if (!(await assertCaseExists(supabase, nextCaseId))) return jsonError('Case topilmadi', 404);
      if (nextChance < 0 || nextChance > 100) return jsonError('Chance 0 va 100 orasida bo‘lsin');
      if (nextActive && nextChance <= 0) return jsonError('Aktiv sovg‘ada chance 0 dan katta bo‘lsin');
      if (nextStock < 0) return jsonError('Stock manfiy bo‘lmasin');
      if (nextActive && nextStock <= 0) return jsonError('Aktiv sovg‘ada stock kamida 1 bo‘lsin');

      const chanceCheck = await validateChanceLimit(supabase, {
        caseId: nextCaseId,
        caseGiftId,
        nextChance,
        nextActive,
      });

      if (!chanceCheck.ok) return jsonError(chanceCheck.error, 400, chanceCheck);

      const updates = {};
      if (body.case_id !== undefined) updates.case_id = nextCaseId;
      if (body.chance !== undefined) updates.chance = nextChance;
      if (body.stock !== undefined) updates.stock = nextStock;
      if (body.is_active !== undefined) updates.is_active = nextActive;

      const { data, error } = await supabase
        .from('case_gifts')
        .update(updates)
        .eq('id', caseGiftId)
        .select('*, gift_catalog(*)')
        .single();

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, caseGift: data, chance: chanceCheck });
    }

    if (action === 'delete') {
      if (!caseGiftId) return jsonError('caseGiftId kerak');
      const { error } = await supabase.from('case_gifts').delete().eq('id', caseGiftId);
      if (error) throw new Error(error.message);
      return Response.json({ ok: true });
    }

    return jsonError('Noma’lum action');
  } catch (error) {
    return jsonError(error.message || 'Server xatosi', 500);
  }
}
