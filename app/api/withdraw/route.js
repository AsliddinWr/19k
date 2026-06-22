import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureUser, jsonError, readTelegramRequest } from '@/lib/telegramAuth';

export async function POST(request) {
  try {
    const auth = await readTelegramRequest(request);
    if (!auth.ok) return jsonError(auth.error, auth.status);

    const supabase = getSupabaseAdmin();
    const dbUser = await ensureUser(auth.telegramUser);
    const { historyId, giftId } = auth.body || {};

    if (dbUser.is_banned) return jsonError('Siz bloklangansiz', 403);

    if (historyId) {
      const { data: history, error: historyError } = await supabase
        .from('open_history')
        .select('*')
        .eq('id', historyId)
        .eq('user_id', auth.telegramUser.id)
        .single();

      if (historyError || !history) return jsonError('Inventory sovg‘asi topilmadi', 404);
      if (history.reward_type === 'coin') return jsonError('Moneta withdraw qilinmaydi');

      const { data: existing } = await supabase
        .from('withdraw_requests')
        .select('id,status')
        .eq('history_id', historyId)
        .maybeSingle();

      if (existing) return jsonError(`Bu sovg‘a uchun so‘rov allaqachon bor: ${existing.status}`);

      const { data, error } = await supabase
        .from('withdraw_requests')
        .insert({
          user_id: auth.telegramUser.id,
          history_id: historyId,
          gift_id: null,
          status: 'pending',
          reward_title: history.reward_title,
          reward_image_url: history.reward_image_url,
          reward_animation_url: history.reward_animation_url,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, request: data });
    }

    if (!giftId) return jsonError('historyId kerak');

    const { data, error } = await supabase
      .from('withdraw_requests')
      .insert({
        user_id: auth.telegramUser.id,
        gift_id: giftId,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return Response.json({ ok: true, request: data });
  } catch (error) {
    return jsonError(error.message || 'Server xatosi', 500);
  }
}
