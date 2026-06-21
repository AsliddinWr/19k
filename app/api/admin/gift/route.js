import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonError, readTelegramRequest } from '@/lib/telegramAuth';

export async function POST(request) {
  try {
    const auth = await readTelegramRequest(request);

    if (!auth.ok) return jsonError(auth.error, auth.status);
    if (!auth.isAdmin) return jsonError('Admin ruxsati yo‘q', 403);

    const supabase = getSupabaseAdmin();
    const { action, giftId, case_id, title, type, value, chance, stock, is_active } = auth.body || {};

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

      const numericChance = Number(chance || 0);
      const numericStock = Number(stock || 0);

      if (numericChance <= 0) return jsonError('Chance 0 dan katta bo‘lishi kerak');
      if (numericStock < 0) return jsonError('Stock manfiy bo‘lmasin');

      const { data, error } = await supabase
        .from('gifts')
        .insert({
          case_id,
          title: String(title).trim(),
          type: type || 'gift',
          value: value || null,
          chance: numericChance,
          stock: numericStock,
          is_active: true,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, gift: data });
    }

    if (action === 'update') {
      if (!giftId) return jsonError('giftId kerak');

      const updates = {};
      if (case_id !== undefined) updates.case_id = case_id;
      if (title !== undefined) updates.title = String(title).trim();
      if (type !== undefined) updates.type = type || 'gift';
      if (value !== undefined) updates.value = value || null;
      if (chance !== undefined) updates.chance = Number(chance || 0);
      if (stock !== undefined) updates.stock = Number(stock || 0);
      if (is_active !== undefined) updates.is_active = Boolean(is_active);

      const { data, error } = await supabase
        .from('gifts')
        .update(updates)
        .eq('id', giftId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, gift: data });
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
