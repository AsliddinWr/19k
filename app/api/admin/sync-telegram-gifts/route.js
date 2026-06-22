import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonError, readTelegramRequest } from '@/lib/telegramAuth';

function fileExtension(path = '', contentType = '') {
  const cleanPath = String(path).split('?')[0];
  const fromPath = cleanPath.includes('.') ? cleanPath.split('.').pop().toLowerCase() : '';
  if (fromPath && fromPath.length <= 5) return fromPath;
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('mp4')) return 'mp4';
  if (contentType.includes('gzip') || contentType.includes('x-tgsticker')) return 'tgs';
  return 'bin';
}

function defaultBackground(index) {
  const presets = [
    'linear-gradient(135deg,#f59e0b 0%,#fde68a 45%,#4a2600 100%)',
    'linear-gradient(135deg,#38bdf8 0%,#2563eb 48%,#07172f 100%)',
    'linear-gradient(135deg,#8b5cf6 0%,#4c1d95 50%,#140927 100%)',
    'linear-gradient(135deg,#22c55e 0%,#065f46 52%,#061b14 100%)',
    'linear-gradient(135deg,#fb7185 0%,#db2777 50%,#2a0612 100%)',
  ];
  return presets[index % presets.length];
}

function rarityByStars(stars = 0) {
  const price = Number(stars || 0);
  if (price >= 1000) return 'mythic';
  if (price >= 500) return 'legendary';
  if (price >= 250) return 'epic';
  if (price >= 100) return 'rare';
  return 'common';
}

async function telegramJson(method, params = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN topilmadi');

  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(data.description || `${method} xatosi`);
  }

  return data.result;
}

async function mirrorTelegramFile(supabase, fileId, targetPrefix) {
  if (!fileId) return null;

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const bucket = process.env.SUPABASE_TELEGRAM_GIFT_BUCKET || process.env.SUPABASE_GIFT_ASSETS_BUCKET || 'telegram-gift-assets';

  const fileInfo = await telegramJson('getFile', { file_id: fileId });
  if (!fileInfo?.file_path) return null;

  const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
  const fileResponse = await fetch(fileUrl, { cache: 'no-store' });

  if (!fileResponse.ok) return null;

  const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
  const ext = fileExtension(fileInfo.file_path, contentType);
  const arrayBuffer = await fileResponse.arrayBuffer();
  const path = `${targetPrefix}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      upsert: true,
      contentType,
      cacheControl: '86400',
    });

  if (error) throw new Error(`Storage upload xatosi: ${error.message}. Bucket public va mavjudligini tekshiring: ${bucket}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

function giftTitle(gift, index) {
  const emoji = gift?.sticker?.emoji || '🎁';
  const stars = gift?.star_count ? `${gift.star_count}⭐` : '';
  return `${emoji} Telegram Gift ${stars}`.trim() || `Telegram Gift ${index + 1}`;
}

export async function POST(request) {
  try {
    const auth = await readTelegramRequest(request);
    if (!auth.ok) return jsonError(auth.error, auth.status);
    if (!auth.isAdmin) return jsonError('Admin ruxsati yo‘q', 403);

    const supabase = getSupabaseAdmin();
    const result = await telegramJson('getAvailableGifts');
    const gifts = result?.gifts || [];

    let synced = 0;
    const rows = [];

    for (let index = 0; index < gifts.length; index += 1) {
      const gift = gifts[index];
      const sticker = gift.sticker || {};
      const telegramGiftId = String(gift.id || sticker.file_unique_id || sticker.file_id || `gift-${index}`);
      const slug = `tg-${telegramGiftId}`.replace(/[^a-zA-Z0-9-_]/g, '-');

      let imageUrl = null;
      let animationUrl = null;

      const imageFileId = sticker.thumbnail?.file_id || (!sticker.is_video && !sticker.is_animated ? sticker.file_id : null);
      const animationFileId = sticker.is_video ? sticker.file_id : null;

      try {
        imageUrl = imageFileId ? await mirrorTelegramFile(supabase, imageFileId, `telegram/${telegramGiftId}/image`) : null;
      } catch (error) {
        imageUrl = null;
      }

      try {
        animationUrl = animationFileId ? await mirrorTelegramFile(supabase, animationFileId, `telegram/${telegramGiftId}/animation`) : null;
      } catch (error) {
        animationUrl = null;
      }

      if (!imageUrl && animationUrl) imageUrl = animationUrl;

      const starPrice = Number(gift.star_count || 0);
      const row = {
        telegram_gift_id: telegramGiftId,
        slug,
        title: giftTitle(gift, index),
        type: 'telegram_gift',
        image_url: imageUrl,
        animation_url: animationUrl,
        background_value: defaultBackground(index),
        rarity: rarityByStars(starPrice),
        star_price: starPrice,
        display_price: starPrice,
        price_currency: 'STARS',
        price_source: 'telegram',
        raw: gift,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('gift_catalog')
        .upsert(row, { onConflict: 'telegram_gift_id' });

      if (error) throw new Error(error.message);
      rows.push(row);
      synced += 1;
    }

    return Response.json({ ok: true, count: synced, gifts: rows });
  } catch (error) {
    return jsonError(error.message || 'Telegram gift sync xatosi', 500);
  }
}
