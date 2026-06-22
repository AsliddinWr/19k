import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonError, readTelegramRequest } from '@/lib/telegramAuth';

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRarity(value, chance) {
  const rarity = cleanText(value).toLowerCase();
  if (['common', 'rare', 'epic', 'legendary', 'mythic'].includes(rarity)) return rarity;
  const numericChance = toNumber(chance, 100);
  if (numericChance <= 3) return 'mythic';
  if (numericChance <= 8) return 'legendary';
  if (numericChance <= 18) return 'epic';
  if (numericChance <= 40) return 'rare';
  return 'common';
}

function defaultBackground(rarity) {
  if (rarity === 'mythic') return 'linear-gradient(135deg,#fb7185 0%,#db2777 50%,#2a0612 100%)';
  if (rarity === 'legendary') return 'linear-gradient(135deg,#ffbf1b 0%,#ff7a00 45%,#241100 100%)';
  if (rarity === 'epic') return 'linear-gradient(135deg,#8b5cf6 0%,#4c1d95 50%,#140927 100%)';
  if (rarity === 'rare') return 'linear-gradient(135deg,#38bdf8 0%,#2563eb 50%,#07172f 100%)';
  return 'linear-gradient(135deg,#323232 0%,#171717 55%,#050505 100%)';
}

async function caseExists(supabase, caseId) {
  const { data, error } = await supabase
    .from('cases')
    .select('id,title')
    .eq('id', caseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function validateChanceLimit(supabase, { caseId, giftId = null, nextChance = 0, nextActive = true }) {
  if (!caseId) return { ok: false, error: 'Qaysi casega qo‘shishni tanlang' };

  const { data: existingGifts, error } = await supabase
    .from('gifts')
    .select('id, chance, is_active')
    .eq('case_id', caseId);

  if (error) throw new Error(error.message);

  const activeSum = (existingGifts || [])
    .filter((gift) => String(gift.id) !== String(giftId || ''))
    .filter((gift) => gift.is_active !== false)
    .reduce((sum, gift) => sum + toNumber(gift.chance), 0);

  const finalSum = activeSum + (nextActive ? nextChance : 0);

  if (finalSum > 100) {
    return {
      ok: false,
      error: `Chance jami 100% dan oshib ketdi. Hozirgi aktiv summa: ${activeSum}%, yangi bilan: ${finalSum}%. Qolgan limit: ${Math.max(0, 100 - activeSum)}%.`,
      activeSum,
      finalSum,
      remaining: Math.max(0, 100 - activeSum),
    };
  }

  return { ok: true, activeSum, finalSum, remaining: Math.max(0, 100 - finalSum) };
}

function publicGift(gift) {
  return {
    ...gift,
    chance: toNumber(gift.chance),
    stock: toNumber(gift.stock),
    image_url: gift.image_url || null,
    animation_url: gift.animation_url || null,
    background_value: gift.background_value || null,
    rarity: gift.rarity || 'common',
  };
}

export async function POST(request) {
  try {
    const auth = await readTelegramRequest(request);

    if (!auth.ok) return jsonError(auth.error, auth.status);
    if (!auth.isAdmin) return jsonError('Admin ruxsati yo‘q', 403);

    const supabase = getSupabaseAdmin();
    const {
      action,
      giftId,
      case_id,
      title,
      type,
      value,
      chance,
      stock,
      is_active,
      image_url,
      animation_url,
      background_value,
      rarity,
    } = auth.body || {};

    if (action === 'list') {
      const { data, error } = await supabase
        .from('gifts')
        .select('*, cases(title)')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, gifts: (data || []).map(publicGift) });
    }

    if (action === 'create') {
      const cleanCaseId = cleanText(case_id);
      const cleanTitle = cleanText(title);
      const numericChance = toNumber(chance);
      const numericStock = Math.floor(toNumber(stock));
      const cleanImage = cleanText(image_url);
      const cleanAnimation = cleanText(animation_url);
      const finalRarity = normalizeRarity(rarity, numericChance);
      const finalBackground = cleanText(background_value) || defaultBackground(finalRarity);

      if (!cleanCaseId) return jsonError('Qaysi casega qo‘shishni tanlang');
      if (!(await caseExists(supabase, cleanCaseId))) return jsonError('Tanlangan case topilmadi', 404);
      if (cleanTitle.length < 2) return jsonError('Sovg‘a nomini yozing');
      if (!cleanImage) return jsonError('Sovg‘a rasmi majburiy. PNG yoki WEBP yuklang.');
      if (numericChance <= 0 || numericChance > 100) return jsonError('Chance 0 dan katta va 100 dan oshmasligi kerak');
      if (numericStock <= 0) return jsonError('Stock kamida 1 bo‘lishi kerak. Stock 0 bo‘lsa case ochilmaydi.');

      const chanceCheck = await validateChanceLimit(supabase, {
        caseId: cleanCaseId,
        nextChance: numericChance,
        nextActive: true,
      });

      if (!chanceCheck.ok) {
        return jsonError(chanceCheck.error, 400, chanceCheck);
      }

      const { data, error } = await supabase
        .from('gifts')
        .insert({
          case_id: cleanCaseId,
          title: cleanTitle,
          type: cleanText(type) || 'gift',
          value: cleanText(value) || null,
          chance: numericChance,
          stock: numericStock,
          image_url: cleanImage,
          animation_url: cleanAnimation || null,
          background_value: finalBackground,
          rarity: finalRarity,
          is_active: true,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, gift: publicGift(data), chance: chanceCheck });
    }

    if (action === 'update') {
      if (!giftId) return jsonError('giftId kerak');

      const { data: currentGift, error: currentError } = await supabase
        .from('gifts')
        .select('*')
        .eq('id', giftId)
        .single();

      if (currentError || !currentGift) return jsonError('Sovg‘a topilmadi', 404);

      const nextCaseId = case_id !== undefined ? cleanText(case_id) : currentGift.case_id;
      const nextChance = chance !== undefined ? toNumber(chance) : toNumber(currentGift.chance);
      const nextActive = is_active !== undefined ? Boolean(is_active) : currentGift.is_active !== false;
      const nextStock = stock !== undefined ? Math.floor(toNumber(stock)) : Math.floor(toNumber(currentGift.stock));
      const nextRarity = rarity !== undefined ? normalizeRarity(rarity, nextChance) : normalizeRarity(currentGift.rarity, nextChance);

      if (!nextCaseId) return jsonError('Qaysi casega qo‘shishni tanlang');
      if (!(await caseExists(supabase, nextCaseId))) return jsonError('Tanlangan case topilmadi', 404);
      if (nextChance < 0 || nextChance > 100) return jsonError('Chance 0 va 100 orasida bo‘lishi kerak');
      if (nextActive && nextChance <= 0) return jsonError('Aktiv sovg‘ada chance 0 dan katta bo‘lishi kerak');
      if (nextActive && nextStock <= 0) return jsonError('Aktiv sovg‘ada stock kamida 1 bo‘lishi kerak');
      if (nextStock < 0) return jsonError('Stock manfiy bo‘lmasin');

      const chanceCheck = await validateChanceLimit(supabase, {
        caseId: nextCaseId,
        giftId,
        nextChance,
        nextActive,
      });

      if (!chanceCheck.ok) {
        return jsonError(chanceCheck.error, 400, chanceCheck);
      }

      const updates = {};
      if (case_id !== undefined) updates.case_id = nextCaseId;
      if (title !== undefined) updates.title = cleanText(title);
      if (type !== undefined) updates.type = cleanText(type) || 'gift';
      if (value !== undefined) updates.value = cleanText(value) || null;
      if (chance !== undefined) updates.chance = nextChance;
      if (stock !== undefined) updates.stock = nextStock;
      if (image_url !== undefined) updates.image_url = cleanText(image_url) || null;
      if (animation_url !== undefined) updates.animation_url = cleanText(animation_url) || null;
      if (background_value !== undefined) updates.background_value = cleanText(background_value) || defaultBackground(nextRarity);
      if (rarity !== undefined) updates.rarity = nextRarity;
      if (is_active !== undefined) updates.is_active = Boolean(is_active);

      const { data, error } = await supabase
        .from('gifts')
        .update(updates)
        .eq('id', giftId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, gift: publicGift(data), chance: chanceCheck });
    }

    if (action === 'delete') {
      if (!giftId) return jsonError('giftId kerak');

      const { error } = await supabase.from('gifts').delete().eq('id', giftId);
      if (error) throw new Error(error.message);

      return Response.json({ ok: true });
    }

    return jsonError('Noma’lum action');
  } catch (error) {
    return jsonError(error.message || 'Server xatosi', 500);
  }
}
