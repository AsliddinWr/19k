import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureUser, jsonError, readTelegramRequest } from '@/lib/telegramAuth';

function pickWeightedGift(gifts) {
  const total = gifts.reduce((sum, gift) => sum + Number(gift.chance || 0), 0);
  if (total <= 0) return null;

  let random = Math.random() * total;

  for (const gift of gifts) {
    random -= Number(gift.chance || 0);
    if (random <= 0) return gift;
  }

  return gifts[gifts.length - 1] || null;
}

export async function POST(request) {
  try {
    const auth = await readTelegramRequest(request);

    if (!auth.ok) return jsonError(auth.error, auth.status);

    const supabase = getSupabaseAdmin();
    const dbUser = await ensureUser(auth.telegramUser);
    const { caseId } = auth.body || {};

    if (!caseId) return jsonError('caseId kerak');
    if (dbUser.is_banned) return jsonError('Siz bloklangansiz', 403);

    const { data: caseItem, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .eq('is_active', true)
      .single();

    if (caseError || !caseItem) return jsonError('Case topilmadi', 404);

    const userBalance = Number(dbUser.balance || 0);
    const casePrice = Number(caseItem.price || 0);

    if (userBalance < casePrice) {
      return jsonError('Balans yetarli emas', 400, {
        balance: userBalance,
        price: casePrice,
      });
    }

    const { data: gifts, error: giftsError } = await supabase
      .from('gifts')
      .select('*')
      .eq('case_id', caseId)
      .eq('is_active', true)
      .gt('stock', 0);

    if (giftsError) throw new Error(giftsError.message);
    if (!gifts || gifts.length === 0) return jsonError('Bu case ichida aktiv sovg‘a yo‘q');

    const selectedGift = pickWeightedGift(gifts);

    if (!selectedGift) return jsonError('Sovg‘a tanlashda xatolik');

    const newBalance = userBalance - casePrice;
    const newStock = Math.max(Number(selectedGift.stock || 0) - 1, 0);

    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', auth.telegramUser.id);

    if (balanceError) throw new Error(balanceError.message);

    const { error: stockError } = await supabase
      .from('gifts')
      .update({ stock: newStock })
      .eq('id', selectedGift.id);

    if (stockError) throw new Error(stockError.message);

    const { data: history, error: historyError } = await supabase
      .from('open_history')
      .insert({
        user_id: auth.telegramUser.id,
        case_id: caseId,
        gift_id: selectedGift.id,
      })
      .select('id, created_at')
      .single();

    if (historyError) throw new Error(historyError.message);

    return Response.json({
      ok: true,
      gift: selectedGift,
      case: caseItem,
      balance: newBalance,
      history,
    });
  } catch (error) {
    return jsonError(error.message || 'Server xatosi', 500);
  }
}
