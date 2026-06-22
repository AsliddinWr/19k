import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonError, readTelegramRequest } from '@/lib/telegramAuth';

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
      error: `Chance jami 100% dan oshib ketdi. Hozirgi aktiv summa: ${activeSum}%, yangi bilan: ${finalSum}%.`,
      activeSum,
      finalSum,
    };
  }

  return { ok: true, activeSum, finalSum };
}

export async function POST(request) {
  try {
    const auth = await readTelegramRequest(request);

    if (!auth.ok) return jsonError(auth.error, auth.status);
    if (!auth.isAdmin) return jsonError('Admin ruxsati yo‘q', 403);

    const supabase = getSupabaseAdmin();
    const { action, giftId, case_id, title, type, value, chance, stock, is_active, image_url, animation_url, background_value, rarity } = auth.body || {};

    if (action === 'list') {
      const { data, error } = await supabase
        .from('gifts')
        .select('*, cases(title)')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, gifts: data || [] });
    }

    if (action === 'create') {
      if (!case_id) return jsonError('Qaysi casega qo‘shishni tanlang');
      if (!title || String(title).trim().length < 2) return jsonError('Sovg‘a nomini yozing');

      const numericChance = toNumber(chance);
      const numericStock = Math.floor(toNumber(stock));

      if (numericChance <= 0 || numericChance > 100) return jsonError('Chance 0 dan katta va 100 dan oshmasligi kerak');
      if (numericStock < 0) return jsonError('Stock manfiy bo‘lmasin');

      const chanceCheck = await validateChanceLimit(supabase, {
        caseId: case_id,
        nextChance: numericChance,
        nextActive: true,
      });

      if (!chanceCheck.ok) {
        return jsonError(chanceCheck.error, 400, {
          activeSum: chanceCheck.activeSum,
          finalSum: chanceCheck.finalSum,
        });
      }

      const { data, error } = await supabase
        .from('gifts')
        .insert({
          case_id,
          title: String(title).trim(),
          type: type || 'gift',
          value: value || null,
          chance: numericChance,
          stock: numericStock,
          image_url: image_url || null,
          animation_url: animation_url || null,
          background_value: background_value || null,
          rarity: rarity || 'common',
          is_active: true,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, gift: data, chance: chanceCheck });
    }

    if (action === 'update') {
      if (!giftId) return jsonError('giftId kerak');

      const { data: currentGift, error: currentError } = await supabase
        .from('gifts')
        .select('*')
        .eq('id', giftId)
        .single();

      if (currentError || !currentGift) return jsonError('Sovg‘a topilmadi', 404);

      const nextCaseId = case_id !== undefined ? case_id : currentGift.case_id;
      const nextChance = chance !== undefined ? toNumber(chance) : toNumber(currentGift.chance);
      const nextActive = is_active !== undefined ? Boolean(is_active) : currentGift.is_active !== false;
      const nextStock = stock !== undefined ? Math.floor(toNumber(stock)) : Math.floor(toNumber(currentGift.stock));

      if (nextChance < 0 || nextChance > 100) return jsonError('Chance 0 va 100 orasida bo‘lishi kerak');
      if (nextActive && nextChance <= 0) return jsonError('Aktiv sovg‘ada chance 0 dan katta bo‘lishi kerak');
      if (nextStock < 0) return jsonError('Stock manfiy bo‘lmasin');

      const chanceCheck = await validateChanceLimit(supabase, {
        caseId: nextCaseId,
        giftId,
        nextChance,
        nextActive,
      });

      if (!chanceCheck.ok) {
        return jsonError(chanceCheck.error, 400, {
          activeSum: chanceCheck.activeSum,
          finalSum: chanceCheck.finalSum,
        });
      }

      const updates = {};
      if (case_id !== undefined) updates.case_id = case_id;
      if (title !== undefined) updates.title = String(title).trim();
      if (type !== undefined) updates.type = type || 'gift';
      if (value !== undefined) updates.value = value || null;
      if (chance !== undefined) updates.chance = nextChance;
      if (stock !== undefined) updates.stock = nextStock;
      if (image_url !== undefined) updates.image_url = image_url || null;
      if (animation_url !== undefined) updates.animation_url = animation_url || null;
      if (background_value !== undefined) updates.background_value = background_value || null;
      if (rarity !== undefined) updates.rarity = rarity || 'common';
      if (is_active !== undefined) updates.is_active = Boolean(is_active);

      const { data, error } = await supabase
        .from('gifts')
        .update(updates)
        .eq('id', giftId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, gift: data, chance: chanceCheck });
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
