import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { jsonError, readTelegramRequest } from '@/lib/telegramAuth';

const PORTALS_API_URL = 'https://portals-market.com/api/';
const GIFTASSET_API_URL = process.env.GIFTASSET_API_URL || 'https://api.giftasset.dev/';

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeSlug(value) {
  return cleanText(value, 'gift')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160) || `gift-${Date.now()}`;
}

function titleCase(text = '') {
  return cleanText(text)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function portalsCollectionParam(names = []) {
  return names
    .map((name) => encodeURIComponent(titleCase(name).replace(/\s+/g, '+')))
    .join('%2C');
}

function detectMediaType(url = '') {
  const clean = cleanText(url).split('?')[0].toLowerCase();
  if (clean.endsWith('.tgs')) return 'tgs';
  if (clean.endsWith('.webm')) return 'webm';
  if (clean.endsWith('.mp4')) return 'mp4';
  if (clean.endsWith('.json') || clean.endsWith('.lottie')) return 'lottie';
  return 'image';
}

function attributeValue(item = {}, type = '') {
  const direct = item[type] || item[`${type}_name`] || item[type.toLowerCase()] || item[type.toUpperCase()];
  if (direct && typeof direct === 'string') return cleanText(direct);

  const fromArray = (item.attributes_array || item.attributes || []).find?.((attr) => {
    return cleanText(attr.type || attr.trait_type).toLowerCase() === type.toLowerCase();
  });
  if (fromArray) return cleanText(fromArray.value || fromArray.name || '');

  const fromObject = item.attributes?.[type.toUpperCase()] || item.attributes?.[type] || item.attributes?.[type.toLowerCase()];
  return cleanText(fromObject?.value || fromObject?.name || '');
}

function flattenApiItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.nfts)) return data.nfts;
  if (Array.isArray(data.gifts)) return data.gifts;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.markets)) return data.markets;
  if (data.result) return flattenApiItems(data.result);
  return Object.values(data).filter((item) => item && typeof item === 'object');
}

function bestProviderFloor(providers = {}) {
  const prices = [];
  for (const provider of Object.values(providers || {})) {
    const collectionFloor = cleanNumber(provider?.collection_floor, 0);
    const modelFloor = cleanNumber(provider?.model_floor, 0);
    if (collectionFloor > 0) prices.push(collectionFloor);
    if (modelFloor > 0) prices.push(modelFloor);
  }
  return prices.length ? Math.min(...prices) : 0;
}

function normalizeGiftAssetGift(item = {}, index = 0) {
  const gift = item.gift || item.nft || item.item || item;
  const telegramGiftName = cleanText(gift.telegram_gift_name || gift.name || gift.slug || gift.unique_name || item.telegram_gift_name || '');
  const collectionName = cleanText(
    gift.telegram_gift_title || gift.collection_name || gift.collection || item.collection_name || item.name || 'NFT Gift'
  );
  const giftNumber = cleanText(gift.telegram_gift_number || gift.number || gift.collectible_id || '');
  const externalId = cleanText(gift.telegram_gift_id || gift.id || gift.collectible_id || telegramGiftName || `${collectionName}-${giftNumber || index}`);
  const modelName = attributeValue(gift, 'MODEL') || attributeValue(gift, 'model');
  const symbolName = attributeValue(gift, 'SYMBOL') || attributeValue(gift, 'symbol');
  const backdropName = attributeValue(gift, 'BACKDROP') || attributeValue(gift, 'backdrop');

  const imageUrl = cleanText(
    gift.media_preview ||
    gift.media?.pics?.large ||
    gift.media?.pics?.medium ||
    gift.media?.pics?.small ||
    gift.photo_url ||
    gift.image_url ||
    gift.preview_url ||
    gift.image ||
    ''
  );

  const animationUrl = cleanText(
    gift.media?.lottie_anim ||
    gift.animation_url ||
    gift.lottie_url ||
    gift.video_url ||
    gift.animation ||
    gift.tgs_url ||
    ''
  );

  const providerFloor = bestProviderFloor(gift.providers || item.providers || {});
  const marketMin = cleanNumber(gift.market_floor?.min || item.market_floor?.min, 0);
  const marketAvg = cleanNumber(gift.market_floor?.avg || item.market_floor?.avg, 0);
  const price = cleanNumber(item.price || gift.price || gift.resell_price || gift.resale_price, 0);
  const floorPrice = marketMin || providerFloor || marketAvg || 0;
  const displayPrice = price || floorPrice || 0;

  const nftUrl = cleanText(
    gift.telegram_nft_url ||
    gift.marketplace_url ||
    gift.url ||
    (telegramGiftName ? `https://t.me/nft/${telegramGiftName}` : '')
  );

  return {
    telegram_gift_id: `giftasset:${externalId}`,
    slug: safeSlug(`giftasset-${telegramGiftName || externalId}`),
    title: giftNumber ? `${collectionName} #${giftNumber}` : collectionName,
    type: 'nft_gift',
    description: [modelName, symbolName, backdropName].filter(Boolean).join(' · ') || 'GiftAsset NFT gift',
    image_url: imageUrl || null,
    animation_url: animationUrl || null,
    media_type: animationUrl ? detectMediaType(animationUrl) : detectMediaType(imageUrl),
    gift_kind: 'nft',
    source: 'giftasset',
    external_id: externalId,
    marketplace_url: nftUrl || null,
    collection_name: collectionName || null,
    model_name: modelName || null,
    symbol_name: symbolName || null,
    backdrop_name: backdropName || null,
    background_value: 'linear-gradient(135deg,#141318 0%,#2b184f 48%,#090713 100%)',
    rarity: floorPrice >= 100 ? 'mythic' : floorPrice >= 50 ? 'legendary' : floorPrice >= 15 ? 'epic' : 'rare',
    star_price: 0,
    floor_price: floorPrice,
    manual_price: 0,
    display_price: displayPrice,
    price_currency: 'TON',
    price_source: 'giftasset',
    raw: gift,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

function normalizeMarketGift(item = {}, index = 0, source = 'market') {
  if (source === 'giftasset') return normalizeGiftAssetGift(item, index);

  const collectionName = cleanText(item.name || item.collection || item.collection_name || item.gift_name || item.title || 'NFT Gift');
  const modelName = attributeValue(item, 'model');
  const symbolName = attributeValue(item, 'symbol');
  const backdropName = attributeValue(item, 'backdrop');
  const externalNumber = cleanText(item.external_collection_number || item.tg_id || item.number || item.num || '');
  const uniqueName = cleanText(item.unique_name || item.slug || item.name_unique || '');
  const externalId = cleanText(item.id || item.nft_id || item.gift_id || item.address || uniqueName || `${collectionName}-${externalNumber || index}`);
  const price = cleanNumber(item.price || item.resell_price || item.resale_price || item.value_amount || item.amount, 0);
  const floorPrice = cleanNumber(item.floor_price || item.collection_floor || item.floor || item.min_price, 0);
  const imageUrl = cleanText(item.photo_url || item.image_url || item.preview_url || item.image || item.thumbnail || item.picture || '');
  const animationUrl = cleanText(item.animation_url || item.lottie_url || item.video_url || item.animation || item.tgs_url || '');
  const mediaType = animationUrl ? detectMediaType(animationUrl) : detectMediaType(imageUrl);
  const marketplaceUrl = cleanText(item.marketplace_url || item.url || (uniqueName ? `https://t.me/nft/${uniqueName}` : ''));
  const titleParts = [collectionName];
  if (externalNumber) titleParts.push(`#${externalNumber}`);

  return {
    telegram_gift_id: `${source}:${externalId}`,
    slug: safeSlug(`${source}-${uniqueName || externalId}`),
    title: titleParts.join(' '),
    type: 'nft_gift',
    description: [modelName, symbolName, backdropName].filter(Boolean).join(' · ') || 'Marketplace NFT gift',
    image_url: imageUrl || null,
    animation_url: animationUrl || null,
    media_type: mediaType,
    gift_kind: 'nft',
    source,
    external_id: externalId,
    marketplace_url: marketplaceUrl || null,
    collection_name: collectionName || null,
    model_name: modelName || null,
    symbol_name: symbolName || null,
    backdrop_name: backdropName || null,
    background_value: 'linear-gradient(135deg,#141318 0%,#2b184f 48%,#090713 100%)',
    rarity: floorPrice >= 100 ? 'mythic' : floorPrice >= 50 ? 'legendary' : floorPrice >= 15 ? 'epic' : 'rare',
    star_price: 0,
    floor_price: floorPrice,
    manual_price: 0,
    display_price: price || floorPrice || 0,
    price_currency: cleanText(item.currency || item.price_currency || 'TON'),
    price_source: source,
    raw: item,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

async function fetchJsonSource(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json, text/plain, */*' },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`JSON source xatosi: ${response.status}`);
  if (!data) throw new Error('JSON source bo‘sh yoki noto‘g‘ri formatda');
  return flattenApiItems(data);
}



export async function POST(request) {
  try {
    const auth = await readTelegramRequest(request);
    if (!auth.ok) return jsonError(auth.error, auth.status);
    if (!auth.isAdmin) return jsonError('Admin ruxsati yo‘q', 403);

    const body = auth.body || {};
    const supabase = getSupabaseAdmin();
    const jsonUrl = cleanText(body.json_url || process.env.NFT_GIFTS_JSON_URL || '');
    const sourceName = cleanText(body.source || 'json').toLowerCase() || 'json';

    let items = [];
    if (Array.isArray(body.items)) {
      items = body.items;
    } else {
      if (!jsonUrl) throw new Error('JSON URL kiriting yoki Vercel env ga NFT_GIFTS_JSON_URL qo‘ying.');
      items = await fetchJsonSource(jsonUrl);
    }

    if (!Array.isArray(items) || !items.length) {
      throw new Error('JSON ichidan gift topilmadi. Format array yoki { results/items/nfts/gifts: [...] } bo‘lishi kerak.');
    }

    let synced = 0;
    const rows = items.map((item, index) => {
      const row = normalizeMarketGift(item, index, sourceName === 'json' ? 'json' : sourceName);
      return {
        ...row,
        source: sourceName,
        price_source: sourceName,
        raw: { ...item, json_source_url: jsonUrl || null },
      };
    });

    for (const row of rows) {
      const { error } = await supabase
        .from('gift_catalog')
        .upsert(row, { onConflict: 'telegram_gift_id' });
      if (error) throw new Error(error.message);
      synced += 1;
    }

    return Response.json({ ok: true, count: synced, source: sourceName, json_url: jsonUrl, gifts: rows });
  } catch (error) {
    return jsonError(error.message || 'JSON gift import xatosi', 500);
  }
}
