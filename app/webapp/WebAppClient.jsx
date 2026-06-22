'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const emptyCaseForm = {
  title: '',
  description: '',
  price: '0',
  image_url: '',
  badge_text: '',
  badge_color: '#f6b7b1',
  accent_color: '#22c55e',
  card_style: 'default',
};

const emptyGiftForm = {
  case_id: '',
  title: '',
  type: 'gift',
  value: '',
  chance: '10',
  stock: '999',
  rarity: 'rare',
  image_url: '',
  animation_url: '',
  background_value: 'linear-gradient(135deg,#ffc400 0%,#23c59a 100%)',
  is_active: true,
};

const emptyCaseRewardForm = {
  case_id: '',
  reward_type: 'nft',
  catalog_gift_id: '',
  coin_type: 'balance',
  coin_amount: '100',
  chance: '10',
  stock: '999',
};

const emptyUserForm = {
  userId: '',
  amount: '',
};

const GIFT_BACKGROUND_PRESETS = [
  { name: 'Gold', value: 'linear-gradient(135deg,#ffbf1b 0%,#ff7a00 45%,#241100 100%)' },
  { name: 'Emerald', value: 'linear-gradient(135deg,#24e28a 0%,#10b981 45%,#06281b 100%)' },
  { name: 'Violet', value: 'linear-gradient(135deg,#8b5cf6 0%,#4c1d95 50%,#140927 100%)' },
  { name: 'Ocean', value: 'linear-gradient(135deg,#38bdf8 0%,#2563eb 50%,#07172f 100%)' },
  { name: 'Rose', value: 'linear-gradient(135deg,#fb7185 0%,#db2777 50%,#2a0612 100%)' },
  { name: 'Dark', value: 'linear-gradient(135deg,#323232 0%,#171717 55%,#050505 100%)' },
];

function defaultGiftBackground(rarity = 'rare') {
  const key = String(rarity || 'rare').toLowerCase();
  if (key === 'mythic') return GIFT_BACKGROUND_PRESETS[4].value;
  if (key === 'legendary') return GIFT_BACKGROUND_PRESETS[0].value;
  if (key === 'epic') return GIFT_BACKGROUND_PRESETS[2].value;
  if (key === 'rare') return GIFT_BACKGROUND_PRESETS[3].value;
  return GIFT_BACKGROUND_PRESETS[5].value;
}

function eligibleGift(gift) {
  return gift?.is_active !== false && Number(gift?.stock || 0) > 0 && Number(gift?.chance || 0) > 0;
}

function giftProblem(gift) {
  if (gift?.is_active === false) return 'Yashirilgan';
  if (Number(gift?.stock || 0) <= 0) return 'Stock 0';
  if (Number(gift?.chance || 0) <= 0) return 'Chance 0';
  return 'Ready';
}

function rewardFromHistory(item, gifts = []) {
  const found = gifts.find((gift) =>
    String(gift.id || '') === String(item.case_gift_id || item.gift_id || '') ||
    String(gift.catalog_gift_id || '') === String(item.catalog_gift_id || '')
  );

  if (found) return found;

  if (item.reward_title || item.reward_image_url || item.reward_animation_url) {
    return {
      id: item.case_gift_id || item.gift_id || item.id,
      title: item.reward_title || 'Sovg‘a',
      value: item.reward_value,
      image_url: item.reward_image_url,
      animation_url: item.reward_animation_url,
      background_value: item.reward_background_value,
      rarity: item.reward_rarity || 'rare',
      reward_type: item.reward_type || 'nft',
      coin_type: item.coin_type,
      coin_amount: item.coin_amount,
    };
  }

  return null;
}


function money(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('uz-UZ').format(number);
}


function formatPrice(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  if (number === 0) return 'FREE';
  if (number < 100) return number.toString().replace(/\.0+$/, '');
  return money(number);
}

function safeColor(value, fallback = '#22c55e') {
  if (!value || typeof value !== 'string') return fallback;
  const color = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (/^rgba?\(/.test(color) || /^hsla?\(/.test(color)) return color;
  return fallback;
}

function caseAccent(caseItem) {
  return safeColor(caseItem?.accent_color, '#22c55e');
}

function caseBadgeColor(caseItem) {
  return safeColor(caseItem?.badge_color, '#8b5cf6');
}

function caseBadgeText(caseItem, gifts = []) {
  if (caseItem?.badge_text) return String(caseItem.badge_text).toUpperCase();
  const minChance = gifts.reduce((min, gift) => Math.min(min, Number(gift.chance || 100)), 100);
  if (minChance <= 5) return 'LIMITED';
  if (Number(caseItem?.price || 0) === 0) return 'FREE';
  return '';
}

function coinIcon() {
  return <AppIcon name="coin" />;
}

function groupGiftsByCase(gifts) {
  return gifts.reduce((acc, gift) => {
    const key = gift.case_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(gift);
    return acc;
  }, {});
}

function giftRarity(gift) {
  const chance = Number(gift?.chance || 0);
  if (chance <= 3) return 'mythic';
  if (chance <= 8) return 'legendary';
  if (chance <= 18) return 'epic';
  if (chance <= 40) return 'rare';
  return 'common';
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomItem(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function buildOpeningReel(gifts, winningGift) {
  const safeGifts = gifts.length ? gifts : [winningGift].filter(Boolean);
  const reel = [];

  for (let index = 0; index < 30; index += 1) {
    reel.push(randomItem(safeGifts));
  }

  if (winningGift) {
    reel.push(winningGift);
  }

  for (let index = 0; index < 4; index += 1) {
    reel.push(randomItem(safeGifts));
  }

  return reel.filter(Boolean);
}

function chanceSum(gifts) {
  return gifts
    .filter((gift) => gift.is_active !== false)
    .reduce((sum, gift) => sum + Number(gift.chance || 0), 0);
}

const HEX_CELLS = [
  ['center', 0, 0, 0],
  ['r1', -32, 0, 0.15],
  ['r1', -16, -28, 0.15],
  ['r1', 16, -28, 0.15],
  ['r1', 32, 0, 0.15],
  ['r1', -16, 28, 0.15],
  ['r1', 16, 28, 0.15],
  ['r2', -64, 0, 0.3],
  ['r2', -48, -28, 0.3],
  ['r2', -32, -56, 0.3],
  ['r2', 0, -56, 0.3],
  ['r2', 32, -56, 0.3],
  ['r2', 48, -28, 0.3],
  ['r2', 64, 0, 0.3],
  ['r2', 48, 28, 0.3],
  ['r2', 32, 56, 0.3],
  ['r2', 0, 56, 0.3],
  ['r2', -32, 56, 0.3],
  ['r2', -48, 28, 0.3],
  ['r3', -96, 0, 0.45],
  ['r3', -80, -28, 0.45],
  ['r3', -64, -56, 0.45],
  ['r3', -48, -84, 0.45],
  ['r3', -16, -84, 0.45],
  ['r3', 16, -84, 0.45],
  ['r3', 48, -84, 0.45],
  ['r3', 64, -56, 0.45],
  ['r3', 80, -28, 0.45],
  ['r3', 96, 0, 0.45],
  ['r3', 80, 28, 0.45],
  ['r3', 64, 56, 0.45],
  ['r3', 48, 84, 0.45],
  ['r3', 16, 84, 0.45],
  ['r3', -16, 84, 0.45],
  ['r3', -48, 84, 0.45],
  ['r3', -64, 56, 0.45],
  ['r3', -80, 28, 0.45],
];

function HexLoader({ size = 'normal' }) {
  return (
    <div className={`casino-hex-loader ${size === 'small' ? 'is-small' : ''}`} aria-label="Loading">
      {HEX_CELLS.map(([ring, x, y, delay], index) => (
        <div
          key={index}
          className={`casino-hex-cell ${ring}`}
          style={{
            '--x': `${x}px`,
            '--y': `${y}px`,
            '--delay': `${delay}s`,
          }}
        >
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function AppIcon({ name, className = '' }) {
  const common = {
    className: `app-icon ${className}`.trim(),
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': 'true',
  };

  switch (name) {
    case 'home':
      return <svg {...common}><path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.4Z"/><path d="M3 11.2 12 3l9 8.2"/></svg>;
    case 'cases':
      return <svg {...common}><path d="M5 8h14v12H5V8Z"/><path d="M7 8V6.8A2.8 2.8 0 0 1 9.8 4h4.4A2.8 2.8 0 0 1 17 6.8V8"/><path d="M5 12h14M12 8v12"/></svg>;
    case 'games':
      return <svg {...common}><rect x="3" y="8" width="18" height="10" rx="5"/><path d="M8 11v4M6 13h4"/><path d="M15.5 12h.01M18 14h.01"/><path d="M9 8l1.2-3h3.6L15 8"/></svg>;
    case 'inventory':
      return <svg {...common}><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>;
    case 'history':
      return <svg {...common}><path d="M4 12a8 8 0 1 0 2.35-5.65"/><path d="M4 5v5h5"/><path d="M12 7v5l3 2"/></svg>;
    case 'profile':
      return <svg {...common}><path d="M20 21a8 8 0 0 0-16 0"/><path d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/></svg>;
    case 'coin':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8.5 8h7L12 18 8.5 8Z"/><path d="m8.5 8 3.5 4 3.5-4"/></svg>;
    case 'deposit':
      return <svg {...common}><path d="M4 7h16v12H4V7Z"/><path d="M7 7V5h10v2"/><path d="M8 13h5"/><path d="m11 10 3 3-3 3"/></svg>;
    case 'live':
      return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M5 12a7 7 0 0 1 14 0M2 12a10 10 0 0 1 20 0"/></svg>;
    case 'rocket':
      return <svg {...common}><path d="M13 4c4 1 6 3 7 7l-6 6-5-5 4-8Z"/><path d="M9 12 5 13l-2 5 5-2 1-4Z"/><path d="M14 17v3l-4 2v-4M7 10H4l2-4h4"/><circle cx="15" cy="9" r="1.5"/></svg>;
    case 'swords':
      return <svg {...common}><path d="m14 4 6 6-2 2-6-6 2-2Z"/><path d="m10 14-4 4M5 21l4-4"/><path d="m10 4-6 6 2 2 6-6-2-2Z"/><path d="m14 14 4 4m1 3-4-4"/></svg>;
    case 'admin':
      return <svg {...common}><path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z"/><path d="M9 12l2 2 4-5"/></svg>;
    case 'gift':
      return <svg {...common}><path d="M4 10h16v10H4V10Z"/><path d="M3 7h18v3H3V7Z"/><path d="M12 7v13"/><path d="M12 7c-2.5 0-4-1-4-2.4A1.8 1.8 0 0 1 11.2 3L12 7Zm0 0c2.5 0 4-1 4-2.4A1.8 1.8 0 0 0 12.8 3L12 7Z"/></svg>;
    case 'gem':
      return <svg {...common}><path d="M6 4h12l4 6-10 11L2 10l4-6Z"/><path d="M2 10h20M8 4l4 17 4-17"/></svg>;
    case 'box':
      return <svg {...common}><path d="M4 8 12 4l8 4-8 4-8-4Z"/><path d="M4 8v8l8 4 8-4V8"/><path d="M12 12v8"/></svg>;
    case 'withdraw':
      return <svg {...common}><path d="M5 20h14"/><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/></svg>;
    case 'spark':
      return <svg {...common}><path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8L12 2Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>;
    default:
      return <svg {...common}><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 8v8l9 5 9-5V8"/></svg>;
  }
}

function metricIconName(icon) {
    return icon || 'spark';
}

export default function WebAppClient() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Case Arena';

  const [tg, setTg] = useState(null);
  const [initData, setInitData] = useState('');
  const [tab, setTab] = useState('home');
  const [adminTab, setAdminTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [opening, setOpening] = useState(null);

  const [profile, setProfile] = useState(null);
  const [telegramUser, setTelegramUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cases, setCases] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [giftCatalog, setGiftCatalog] = useState([]);
  const [history, setHistory] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState([]);

  const [caseForm, setCaseForm] = useState(emptyCaseForm);
  const [caseImageFile, setCaseImageFile] = useState(null);
  const [giftForm, setGiftForm] = useState(emptyGiftForm);
  const [giftImageFile, setGiftImageFile] = useState(null);
  const [giftAnimationFile, setGiftAnimationFile] = useState(null);
  const [caseRewardForm, setCaseRewardForm] = useState(emptyCaseRewardForm);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [userForm, setUserForm] = useState(emptyUserForm);

  const giftsByCase = useMemo(() => groupGiftsByCase(gifts), [gifts]);
  const activeCases = useMemo(() => cases.filter((item) => item.is_active !== false), [cases]);
  const totalOpenings = history.length;
  const pendingWithdrawals = withdrawals.filter((item) => item.status === 'pending').length;
  const adminPendingWithdrawals = adminWithdrawals.filter((item) => item.status === 'pending').length;

  const navItems = useMemo(() => ([
    { id: 'games', icon: 'games', label: 'Games' },
    { id: 'inventory', icon: 'inventory', label: 'Inventory' },
    { id: 'home', icon: 'home', label: 'Home', center: true },
    { id: 'history', icon: 'history', label: 'History' },
    { id: 'profile', icon: 'profile', label: 'Profile' },
  ]), []);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const apiPost = useCallback(async (url, payload = {}) => {
    if (!initData) {
      throw new Error('Telegram initData topilmadi. Web App’ni faqat bot tugmasidan oching.');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, ...payload }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Server xatosi');
    }

    return data;
  }, [initData]);

  const apiFormPost = useCallback(async (url, formData) => {
    if (!initData) {
      throw new Error('Telegram initData topilmadi. Web App’ni faqat bot tugmasidan oching.');
    }

    formData.append('initData', initData);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Server xatosi');
    }

    return data;
  }, [initData]);

  const loadApp = useCallback(async () => {
    if (!initData) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiPost('/api/bootstrap');
      setProfile(data.user);
      setTelegramUser(data.telegramUser);
      setIsAdmin(Boolean(data.isAdmin));
      setCases(data.cases || []);
      setGifts(data.gifts || data.caseGifts || []);
      setGiftCatalog(data.giftCatalog || []);
      setHistory(data.history || []);
      setWithdrawals(data.withdrawals || []);

      if (data.cases?.[0]?.id && !giftForm.case_id) {
        setGiftForm((current) => ({ ...current, case_id: data.cases[0].id }));
      }

      if (data.cases?.[0]?.id && !caseRewardForm.case_id) {
        setCaseRewardForm((current) => ({ ...current, case_id: data.cases[0].id }));
      }

      if (data.giftCatalog?.[0]?.id && !caseRewardForm.catalog_gift_id) {
        setCaseRewardForm((current) => ({ ...current, catalog_gift_id: data.giftCatalog[0].id }));
      }
    } catch (err) {
      setError(err.message || 'Ma’lumot yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [apiPost, giftForm.case_id, caseRewardForm.case_id, caseRewardForm.catalog_gift_id, initData]);

  useEffect(() => {
    const app = window.Telegram?.WebApp;

    if (!app) {
      setLoading(false);
      setError('Bu sahifa Telegram ichida ochilmagan. Botdagi Web App tugmasidan oching.');
      return;
    }

    app.ready();
    app.expand();
    app.MainButton.hide();
    app.BackButton.hide();

    setTg(app);
    setInitData(app.initData || '');
    setTelegramUser(app.initDataUnsafe?.user || null);
  }, []);

  useEffect(() => {
    loadApp();
  }, [loadApp]);

  async function runAction(callback, successText) {
    setBusy(true);
    setError('');

    try {
      const result = await callback();
      if (successText) showToast(successText);
      tg?.HapticFeedback?.notificationOccurred?.('success');
      return result;
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi');
      tg?.HapticFeedback?.notificationOccurred?.('error');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function openCase(caseItem) {
    const caseGifts = giftsByCase[caseItem.id] || [];
    const activeGiftPool = caseGifts.filter((gift) => gift.is_active !== false && Number(gift.stock || 0) > 0 && Number(gift.chance || 0) > 0);

    if (activeGiftPool.length === 0) {
      setSelectedCase(caseItem);
      setError('Bu case ochilishi uchun kamida 1 ta aktiv sovg‘a kerak: chance > 0, stock > 0 va sovg‘a rasmi kiritilgan bo‘lsin. Admin → Profile → Admin Panel → Case Rewards bo‘limidan tekshiring.');
      return;
    }

    if (Number(profile?.balance || 0) < Number(caseItem.price || 0)) {
      setError(`Balans yetarli emas. Kerak: ${money(caseItem.price)} so‘m`);
      tg?.HapticFeedback?.notificationOccurred?.('error');
      return;
    }

    setSelectedCase(null);
    setOpening({
      stage: 'preparing',
      caseItem,
      gift: null,
      reel: buildOpeningReel(activeGiftPool, null),
      spinKey: Date.now(),
    });

    const result = await runAction(
      () => apiPost('/api/open-case', { caseId: caseItem.id }),
      ''
    );

    if (!result?.gift) {
      setOpening(null);
      return;
    }

    const reel = buildOpeningReel(activeGiftPool, result.gift);

    setOpening({
      stage: 'rolling',
      caseItem,
      gift: result.gift,
      reel,
      opening: result.opening,
      balanceBefore: result.balanceBefore,
      balanceAfter: result.balanceAfter,
      spinKey: Date.now(),
    });

    setProfile((current) => ({ ...current, balance: result.balanceAfter ?? result.balance }));
    tg?.HapticFeedback?.impactOccurred?.('medium');

    await delay(3600);

    setOpening({
      stage: 'result',
      caseItem,
      gift: result.gift,
      reel,
      opening: result.opening,
      balanceBefore: result.balanceBefore,
      balanceAfter: result.balanceAfter,
      spinKey: Date.now(),
    });

    tg?.HapticFeedback?.notificationOccurred?.('success');
    await loadApp();
  }

  async function createWithdraw(historyId) {
    await runAction(
      () => apiPost('/api/withdraw', { historyId }),
      'Yechish so‘rovi yuborildi ✅'
    );
    await loadApp();
  }

  async function uploadCaseImage() {
    if (!caseImageFile) return null;

    const formData = new FormData();
    formData.append('file', caseImageFile);

    const result = await apiFormPost('/api/admin/upload-case-image', formData);
    return result.publicUrl;
  }


  async function uploadGiftAsset(file, kind = 'image') {
    if (!file) return null;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);

    const result = await apiFormPost('/api/admin/upload-gift-asset', formData);
    return result.publicUrl;
  }

  async function createCase(event) {
    event.preventDefault();

    await runAction(async () => {
      const uploadedImageUrl = await uploadCaseImage();

      return apiPost('/api/admin/case', {
        action: 'create',
        ...caseForm,
        image_url: uploadedImageUrl || caseForm.image_url || '',
      });
    }, 'Case qo‘shildi ✅');

    setCaseForm(emptyCaseForm);
    setCaseImageFile(null);
    await loadApp();
  }

  async function updateCase(caseItem, updates) {
    await runAction(
      () => apiPost('/api/admin/case', { action: 'update', caseId: caseItem.id, ...updates }),
      'Case yangilandi ✅'
    );
    await loadApp();
  }

  async function deleteCase(caseId) {
    if (!confirm('Case o‘chirilsinmi? Ichidagi sovg‘alar ham o‘chadi.')) return;

    await runAction(
      () => apiPost('/api/admin/case', { action: 'delete', caseId }),
      'Case o‘chirildi'
    );
    await loadApp();
  }

  async function createGift(event) {
    event.preventDefault();

    await runAction(async () => {
      const chanceNumber = Number(giftForm.chance);
      const stockNumber = Math.floor(Number(giftForm.stock));
      const cleanTitle = String(giftForm.title || '').trim();

      if (!giftForm.case_id) throw new Error('Avval sovg‘a qaysi casega qo‘shilishini tanlang.');
      if (cleanTitle.length < 2) throw new Error('Sovg‘a nomini yozing.');
      if (!Number.isFinite(chanceNumber) || chanceNumber <= 0 || chanceNumber > 100) throw new Error('Chance 0 dan katta va 100 dan oshmasligi kerak.');
      if (!Number.isFinite(stockNumber) || stockNumber <= 0) throw new Error('Stock kamida 1 bo‘lishi kerak. Stock 0 bo‘lsa case ochilmaydi.');
      if (!giftImageFile && !giftForm.image_url) throw new Error('Sovg‘a rasmi majburiy: PNG/WEBP rasm yuklang.');

      const uploadedImageUrl = await uploadGiftAsset(giftImageFile, 'image');
      const uploadedAnimationUrl = await uploadGiftAsset(giftAnimationFile, 'animation');
      const rarity = giftForm.rarity || giftRarity({ chance: chanceNumber });

      return apiPost('/api/admin/gift', {
        action: 'create',
        ...giftForm,
        title: cleanTitle,
        chance: chanceNumber,
        stock: stockNumber,
        rarity,
        is_active: true,
        background_value: giftForm.background_value || defaultGiftBackground(rarity),
        image_url: uploadedImageUrl || giftForm.image_url || '',
        animation_url: uploadedAnimationUrl || giftForm.animation_url || '',
      });
    }, 'Sovg‘a qo‘shildi ✅');

    setGiftForm((current) => ({
      ...emptyGiftForm,
      case_id: current.case_id,
      background_value: current.background_value || emptyGiftForm.background_value,
    }));
    setGiftImageFile(null);
    setGiftAnimationFile(null);
    await loadApp();
  }

  async function updateGift(gift, updates) {
    await runAction(
      () => apiPost('/api/admin/gift', { action: 'update', giftId: gift.id, ...updates }),
      'Sovg‘a yangilandi ✅'
    );
    await loadApp();
  }

  async function deleteGift(giftId) {
    if (!confirm('Sovg‘a o‘chirilsinmi?')) return;

    await runAction(
      () => apiPost('/api/admin/gift', { action: 'delete', giftId }),
      'Sovg‘a o‘chirildi'
    );
    await loadApp();
  }


  async function syncTelegramGifts() {
    await runAction(
      () => apiPost('/api/admin/sync-telegram-gifts'),
      'Telegram giftlar yangilandi ✅'
    );
    await loadApp();
  }

  async function createCaseReward(event) {
    event.preventDefault();

    await runAction(async () => {
      const payload = {
        action: 'create',
        ...caseRewardForm,
        chance: Number(caseRewardForm.chance),
        stock: Math.floor(Number(caseRewardForm.stock)),
      };

      if (payload.reward_type === 'coin') {
        payload.coin_amount = Number(caseRewardForm.coin_amount);
        payload.catalog_gift_id = '';
      }

      return apiPost('/api/admin/case-gift', payload);
    }, 'Reward casega qo‘shildi ✅');

    setCaseRewardForm((current) => ({
      ...emptyCaseRewardForm,
      case_id: current.case_id,
      catalog_gift_id: current.catalog_gift_id,
      reward_type: current.reward_type,
    }));
    await loadApp();
  }

  async function updateCaseReward(reward, updates) {
    await runAction(
      () => apiPost('/api/admin/case-gift', { action: 'update', caseGiftId: reward.id, ...updates }),
      'Reward yangilandi ✅'
    );
    await loadApp();
  }

  async function deleteCaseReward(rewardId) {
    if (!confirm('Bu reward case ichidan o‘chirilsinmi?')) return;
    await runAction(
      () => apiPost('/api/admin/case-gift', { action: 'delete', caseGiftId: rewardId }),
      'Reward o‘chirildi ✅'
    );
    await loadApp();
  }

  async function loadAdminUsers() {
    const result = await runAction(() => apiPost('/api/admin/user', { action: 'list' }));
    if (result?.users) setAdminUsers(result.users);
  }

  async function addBalance(event) {
    event.preventDefault();

    await runAction(
      () => apiPost('/api/admin/user', { action: 'add_balance', ...userForm }),
      'Balans yangilandi ✅'
    );

    setUserForm(emptyUserForm);
    await loadAdminUsers();
  }

  async function toggleBan(user) {
    await runAction(
      () => apiPost('/api/admin/user', { action: 'ban', userId: user.id, is_banned: !user.is_banned }),
      'User holati yangilandi ✅'
    );
    await loadAdminUsers();
  }

  async function loadAdminWithdrawals() {
    const result = await runAction(() => apiPost('/api/admin/withdrawals', { action: 'list' }));
    if (result?.withdrawals) setAdminWithdrawals(result.withdrawals);
  }

  async function updateWithdrawal(requestId, status) {
    await runAction(
      () => apiPost('/api/admin/withdrawals', { action: 'update', requestId, status }),
      'So‘rov yangilandi ✅'
    );
    await loadAdminWithdrawals();
  }

  useEffect(() => {
    if (!isAdmin) return;
    if (adminTab === 'dashboard') {
      loadAdminWithdrawals();
      loadAdminUsers();
    }
    if (adminTab === 'users') loadAdminUsers();
    if (adminTab === 'withdrawals') loadAdminWithdrawals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab, isAdmin]);

  if (loading) {
    return (
      <main className="center-screen casino-bg">
        <div className="loader-card premium-card hex-loader-card">
          <HexLoader />
          <div className="loader-copy">
            <span className="eyebrow">Secure WebApp</span>
            <h2>Casino Arena yuklanmoqda</h2>
            <p>Telegram sessiya va Supabase ma’lumotlari tekshirilmoqda.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="casino-bg app-frame">
      {toast ? <div className="toast">{toast}</div> : null}
      {error ? <div className="global-alert">{error}</div> : null}
      {busy ? (
        <div className="busy-indicator premium-card">
          <HexLoader size="small" />
          <span>Amal bajarilmoqda...</span>
        </div>
      ) : null}

      <aside className="desktop-rail premium-card">
        <Brand appName={appName} />
        <UserMini telegramUser={telegramUser} profile={profile} />
        <nav className="rail-nav">
          {navItems.map((item) => (
            <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />
          ))}
        </nav>
        <div className="rail-footer">
          <span>Live mode</span>
          <strong>Secure WebApp</strong>
        </div>
      </aside>

      <section className="app-main">
        <header className="mobile-top premium-card">
          <Brand appName={appName} compact />
          <BalancePill balance={profile?.balance} />
        </header>

        {tab === 'home' ? (
          <HomeView
            telegramUser={telegramUser}
            profile={profile}
            cases={activeCases}
            giftsByCase={giftsByCase}
            history={history}
            gifts={gifts}
            withdrawals={withdrawals}
            onGoCases={() => setTab('games')}
            onGoInventory={() => setTab('inventory')}
            onOpenCase={openCase}
            onSelectCase={setSelectedCase}
            busy={busy}
          />
        ) : null}

        {tab === 'games' ? (
          <GamesEmptyView onGoHome={() => setTab('home')} />
        ) : null}

        {tab === 'inventory' ? (
          <InventoryView
            history={history}
            gifts={gifts}
            cases={cases}
            withdrawals={withdrawals}
            busy={busy}
            onWithdraw={createWithdraw}
          />
        ) : null}

        {tab === 'history' ? (
          <HistoryView
            history={history}
            gifts={gifts}
            cases={cases}
            withdrawals={withdrawals}
          />
        ) : null}

        {tab === 'profile' ? (
          <ProfileView
            telegramUser={telegramUser}
            profile={profile}
            totalOpenings={totalOpenings}
            cases={cases}
            history={history}
            gifts={gifts}
            withdrawals={withdrawals}
            pendingWithdrawals={pendingWithdrawals}
            isAdmin={isAdmin}
            onOpenAdmin={() => setTab('admin')}
          />
        ) : null}

        {tab === 'admin' && isAdmin ? (
          <AdminView
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            cases={cases}
            gifts={gifts}
            giftsByCase={giftsByCase}
            giftCatalog={giftCatalog}
            caseRewardForm={caseRewardForm}
            setCaseRewardForm={setCaseRewardForm}
            catalogSearch={catalogSearch}
            setCatalogSearch={setCatalogSearch}
            adminUsers={adminUsers}
            adminWithdrawals={adminWithdrawals}
            caseForm={caseForm}
            setCaseForm={setCaseForm}
            caseImageFile={caseImageFile}
            setCaseImageFile={setCaseImageFile}
            giftForm={giftForm}
            setGiftForm={setGiftForm}
            giftImageFile={giftImageFile}
            setGiftImageFile={setGiftImageFile}
            giftAnimationFile={giftAnimationFile}
            setGiftAnimationFile={setGiftAnimationFile}
            userForm={userForm}
            setUserForm={setUserForm}
            busy={busy}
            createCase={createCase}
            updateCase={updateCase}
            deleteCase={deleteCase}
            createGift={createGift}
            updateGift={updateGift}
            deleteGift={deleteGift}
            syncTelegramGifts={syncTelegramGifts}
            createCaseReward={createCaseReward}
            updateCaseReward={updateCaseReward}
            deleteCaseReward={deleteCaseReward}
            addBalance={addBalance}
            toggleBan={toggleBan}
            loadAdminUsers={loadAdminUsers}
            loadAdminWithdrawals={loadAdminWithdrawals}
            updateWithdrawal={updateWithdrawal}
            adminPendingWithdrawals={adminPendingWithdrawals}
          />
        ) : null}
      </section>

      <nav className="mobile-nav premium-card">
        {navItems.map((item) => (
          <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} mobile />
        ))}
      </nav>

      {selectedCase ? (
        <CaseDetailsModal
          caseItem={selectedCase}
          gifts={giftsByCase[selectedCase.id] || []}
          busy={busy}
          onClose={() => setSelectedCase(null)}
          onOpen={() => openCase(selectedCase)}
        />
      ) : null}

      {opening ? (
        <OpeningModal
          opening={opening}
          gifts={giftsByCase[opening.caseItem.id] || []}
          onClose={() => setOpening(null)}
          onOpenAgain={() => openCase(opening.caseItem)}
          busy={busy}
        />
      ) : null}
    </main>
  );
}

function Brand({ appName, compact = false }) {
  return (
    <div className={`brand ${compact ? 'compact' : ''}`}>
      <div className="brand-mark"><AppIcon name="gem" /></div>
      <div>
        <strong>{appName}</strong>
        <span>Premium case opening</span>
      </div>
    </div>
  );
}

function BalancePill({ balance }) {
  return (
    <div className="balance-pill">
      <span>Balans</span>
      <strong>{money(balance)} so‘m</strong>
    </div>
  );
}

function UserMini({ telegramUser, profile }) {
  return (
    <div className="user-mini">
      <div className="avatar-glow">{telegramUser?.first_name?.[0] || 'U'}</div>
      <div>
        <strong>{telegramUser?.first_name || 'Telegram user'}</strong>
        <span>{telegramUser?.username ? `@${telegramUser.username}` : `ID: ${telegramUser?.id || '-'}`}</span>
        <small>{money(profile?.balance)} so‘m</small>
      </div>
    </div>
  );
}

function NavButton({ item, active, onClick, mobile = false }) {
  return (
    <button className={`${mobile ? 'mobile-nav-btn' : 'rail-nav-btn'} ${item.center ? 'center-home' : ''} ${active ? 'active' : ''}`} onClick={onClick}>
      <span><AppIcon name={item.icon} /></span>
      <strong>{item.label}</strong>
    </button>
  );
}

function HomeView({ telegramUser, profile, cases, giftsByCase, history, gifts, withdrawals, onGoCases, onGoInventory, onOpenCase, onSelectCase, busy }) {
  const featuredCases = cases;
  const liveDrops = history.slice(0, 10).map((item) => rewardFromHistory(item, gifts)).filter(Boolean);
  const topCases = cases.slice(0, 2);

  return (
    <div className="mobile-casino-home">
      <section className="casino-home-top">
        <div className="home-profile-balance">
          <div className="home-avatar-wrap">
            <div className="home-avatar">{telegramUser?.first_name?.[0] || 'U'}</div>
            <span className="home-gear"><AppIcon name="admin" /></span>
          </div>
          <div>
            <span>Your balance</span>
            <strong><b>{coinIcon()}</b> {formatPrice(profile?.balance)}</strong>
          </div>
        </div>
        <button className="deposit-btn"><AppIcon name="deposit" /> Deposit</button>
      </section>

      <section className="live-strip-card">
        <div className="live-title"><span /><AppIcon name="live" /> Live</div>
        <div className="live-strip-track">
          {(liveDrops.length ? liveDrops : gifts.slice(0, 8)).map((gift, index) => (
            <div className="live-drop-item" key={`${gift?.id || 'gift'}-${index}`} style={{ background: gift?.background_value || undefined }}>
              <GiftMedia gift={gift} compact />
            </div>
          ))}
          {gifts.length === 0 && liveDrops.length === 0 ? [0,1,2,3,4,5].map((item) => <div className="live-drop-item" key={item}><AppIcon name="gem" /></div>) : null}
        </div>
      </section>

      <section className="promo-banners-grid">
        <button className="promo-banner rocket" onClick={onGoCases}>
          <span className="promo-badge"><AppIcon name="spark" /> HOT!</span>
          <strong><AppIcon name="rocket" /> ROCKET</strong>
          <small>Premium game larni oching</small>
        </button>
        <button className="promo-banner pvp" onClick={onGoCases}>
          <span className="promo-badge new"><AppIcon name="spark" /> NEW!</span>
          <strong><AppIcon name="swords" /> PVP</strong>
          <small>Omadingizni sinang</small>
        </button>
        <button className="mini-feature contracts" onClick={onGoInventory}><AppIcon name="inventory" /> CONTRACTS <span>›</span></button>
        <button className="mini-feature upgrade" onClick={onGoCases}><AppIcon name="spark" /> UPGRADE <span>›</span></button>
      </section>

      <section className="home-section-head">
        <div><span><AppIcon name="gift" /></span><strong>Daily Rewards</strong></div>
        <button onClick={onGoCases}>Games</button>
      </section>

      <section className="case-grid-market home-market-grid">
        {featuredCases.length === 0 ? <Empty text="Hali game qo‘shilmagan." /> : null}
        {featuredCases.map((caseItem) => (
          <CaseCard key={caseItem.id} caseItem={caseItem} gifts={giftsByCase[caseItem.id] || []} busy={busy} onOpen={onOpenCase} onDetails={onSelectCase} />
        ))}
      </section>

      <section className="quick-stats-row">
        <MetricCard label="Aktiv game" value={cases.length} icon="cases" tone="cyan" />
        <MetricCard label="Yutuqlar" value={history.length} icon="spark" tone="purple" />
        <MetricCard label="Yechishlar" value={withdrawals.length} icon="withdraw" tone="green" />
      </section>
    </div>
  );
}

function GamesEmptyView({ onGoHome }) {
  return (
    <div className="screen-stack games-empty-screen">
      <section className="games-empty-card premium-card">
        <div className="games-empty-orb"><AppIcon name="games" /></div>
        <span className="eyebrow">Games</span>
        <h1>Games bo‘limi tayyorlanmoqda</h1>
        <p>Hozircha barcha case’lar Home sahifada turadi. Keyin bu bo‘limga Rocket, Upgrade, PVP yoki Daily Box kabi alohida o‘yinlar qo‘shamiz.</p>
        <button className="primary-btn" onClick={onGoHome}>Home’dagi case’larni ko‘rish</button>
      </section>
    </div>
  );
}

function CaseCard({ caseItem, gifts, busy, onOpen, onDetails }) {
  const accent = caseAccent(caseItem);
  const badge = caseBadgeText(caseItem, gifts);
  const badgeColor = caseBadgeColor(caseItem);
  const disabled = busy || gifts.length === 0;

  return (
    <article
      className={`market-case-card ${caseItem.card_style || 'default'}`}
      style={{ '--case-accent': accent, '--case-badge': badgeColor }}
      onClick={() => onDetails(caseItem)}
    >
      <div className="market-case-art">
        {caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : <div className="case-placeholder"><AppIcon name="box" /></div>}
        {badge ? <div className="market-case-badge"><AppIcon name="spark" /> {badge}</div> : null}
        <div className="case-art-shine" />
      </div>
      <div className="market-case-footer">
        <div className="market-case-title">
          <strong>{caseItem.title}</strong>
          {gifts.length ? <span>{gifts.length} gifts</span> : <span>No gifts</span>}
        </div>
        <button
          className="market-price-chip"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(caseItem);
          }}
        >
          <span>{formatPrice(caseItem.price)}</span>
          <b>{coinIcon()}</b>
        </button>
      </div>
    </article>
  );
}


function isTgsAnimation(url = '', gift = {}) {
  const mediaType = String(gift?.media_type || gift?.sticker_format || '').toLowerCase();
  const cleanUrl = String(url || '').split('?')[0].toLowerCase();
  return mediaType === 'tgs' || cleanUrl.endsWith('.tgs');
}

function isVideoAnimation(url = '', gift = {}) {
  const mediaType = String(gift?.media_type || gift?.sticker_format || '').toLowerCase();
  const cleanUrl = String(url || '').split('?')[0].toLowerCase();
  return mediaType === 'webm' || mediaType === 'mp4' || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mp4');
}

function catalogGiftKind(gift = {}) {
  const type = String(gift?.type || '').toLowerCase();
  const mediaType = String(gift?.media_type || '').toLowerCase();
  const raw = gift?.raw || {};
  if (
    type.includes('unique') ||
    type.includes('nft') ||
    gift?.is_unique ||
    gift?.is_resale ||
    raw?.is_unique ||
    raw?.upgrade_star_count ||
    raw?.sticker?.premium_animation ||
    mediaType === 'tgs' ||
    mediaType === 'webm'
  ) {
    return 'nft';
  }
  return 'regular';
}

function catalogKindLabel(gift = {}) {
  return catalogGiftKind(gift) === 'nft' ? 'NFT / Animated' : 'Regular';
}

function GiftMedia({ gift, compact = false, preferStatic = false }) {
  const lottieRef = useRef(null);
  const mediaClass = compact ? 'gift-media compact' : 'gift-media';
  const animationUrl = gift?.animation_url || '';
  const imageUrl = gift?.image_url || '';
  const shouldUseAnimation = Boolean(animationUrl) && !preferStatic;
  const shouldUseTgs = shouldUseAnimation && isTgsAnimation(animationUrl, gift);
  const shouldUseVideo = shouldUseAnimation && isVideoAnimation(animationUrl, gift);

  useEffect(() => {
    if (!shouldUseTgs || !lottieRef.current || !animationUrl) return undefined;

    let animation = null;
    let cancelled = false;

    async function loadTgs() {
      try {
        const [{ default: lottie }, pakoModule] = await Promise.all([
          import('lottie-web'),
          import('pako'),
        ]);

        const response = await fetch(animationUrl, { cache: 'force-cache' });
        const buffer = await response.arrayBuffer();

        let jsonText = '';
        try {
          jsonText = pakoModule.inflate(new Uint8Array(buffer), { to: 'string' });
        } catch {
          jsonText = new TextDecoder().decode(buffer);
        }

        if (cancelled || !lottieRef.current) return;

        animation = lottie.loadAnimation({
          container: lottieRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: JSON.parse(jsonText),
        });
      } catch (error) {
        if (lottieRef.current) {
          lottieRef.current.dataset.failed = 'true';
        }
      }
    }

    loadTgs();

    return () => {
      cancelled = true;
      if (animation) animation.destroy();
    };
  }, [animationUrl, shouldUseTgs]);

  if (!gift) return <span className={mediaClass}><AppIcon name="gem" /></span>;

  if (shouldUseTgs) {
    return (
      <span className={`${mediaClass} tgs-media`}>
        <span ref={lottieRef} className="tgs-lottie" />
        {imageUrl ? <img src={imageUrl} alt={gift.title || 'Gift'} className="tgs-fallback-image" loading="lazy" /> : null}
      </span>
    );
  }

  if (shouldUseVideo) {
    return <video className={mediaClass} src={animationUrl} autoPlay muted loop playsInline preload="metadata" />;
  }

  if (animationUrl && !preferStatic) {
    return <img className={mediaClass} src={animationUrl} alt={gift.title || 'Gift'} loading="lazy" />;
  }

  if (imageUrl) {
    return <img className={mediaClass} src={imageUrl} alt={gift.title || 'Gift'} loading="lazy" />;
  }

  return <span className={mediaClass}><AppIcon name={giftIcon(gift)} /></span>;
}

function CompactCaseRow({ caseItem, gifts, onOpen, busy }) {
  return (
    <div className="compact-case-row">
      <div className="mini-case-img">{caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : <AppIcon name="box" />}</div>
      <div>
        <strong>{caseItem.title}</strong>
        <span>{money(caseItem.price)} so‘m · {gifts.length} sovg‘a</span>
      </div>
      <button className="mini-open" disabled={busy || gifts.length === 0} onClick={() => onOpen(caseItem)}>Open</button>
    </div>
  );
}

function InventoryView({ history, gifts, cases, withdrawals, busy, onWithdraw }) {
  const wins = history.map((item) => {
    const gift = rewardFromHistory(item, gifts);
    const caseItem = cases.find((caseValue) => caseValue.id === item.case_id);
    const request = withdrawals.find((withdraw) =>
      String(withdraw.history_id || '') === String(item.id || '') ||
      (item.gift_id && String(withdraw.gift_id || '') === String(item.gift_id))
    );
    return { item, gift, caseItem, request };
  });

  return (
    <div className="screen-stack inventory-screen-pro">
      <section className="inventory-hero premium-card">
        <div>
          <span className="eyebrow">Inventory</span>
          <h1>Yutgan sovg‘alarim</h1>
          <p>Har bir yutuq alohida kartada ko‘rinadi. WEBM animatsiya bo‘lsa, avtomatik preview chiqadi.</p>
        </div>
        <div className="inventory-count-chip"><AppIcon name="inventory" /> {wins.length}</div>
      </section>

      <section className="inventory-grid-pro">
        {wins.length === 0 ? <Empty text="Inventory hozircha bo‘sh. Case ochib birinchi sovg‘angizni oling." /> : null}
        {wins.map(({ item, gift, caseItem, request }) => (
          <article className={`inventory-prize-card ${giftRarity(gift)}`} key={item.id} style={{ '--gift-bg': gift?.background_value || 'linear-gradient(135deg,#1f2937,#111827)' }}>
            <div className="inventory-prize-art">
              <GiftMedia gift={gift} />
              <div className="inventory-glow" />
            </div>
            <div className="inventory-prize-body">
              <div className="inventory-prize-top">
                <RarityBadge rarity={gift?.rarity || giftRarity(gift)} />
                {request ? <StatusBadge status={request.status} /> : <span className="status-badge available">available</span>}
              </div>
              <h3>{gift?.title || 'Sovg‘a'}</h3>
              <p>{caseItem?.title || 'Case'} · {new Date(item.created_at).toLocaleString('uz-UZ')}</p>
              <div className="inventory-prize-actions">
                <button className="primary-btn small" disabled={busy || gift?.reward_type === 'coin' || Boolean(request)} onClick={() => onWithdraw(item.id)}>
                  <AppIcon name="withdraw" /> {request ? 'So‘rov yuborilgan' : 'Yechish'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function HistoryView({ history, gifts, cases, withdrawals }) {
  const rows = history.map((item) => {
    const gift = rewardFromHistory(item, gifts);
    const caseItem = cases.find((caseValue) => caseValue.id === item.case_id);
    const request = withdrawals.find((withdraw) => String(withdraw.history_id || '') === String(item.id || '') || (item.gift_id && String(withdraw.gift_id || '') === String(item.gift_id)));
    return { item, gift, caseItem, request };
  });

  return (
    <div className="screen-stack history-screen-pro">
      <PageHeader eyebrow="History" title="Opening history" description="Oxirgi ochilgan case’lar, chiqqan sovg‘alar va yechish holatlari." />
      <div className="history-list-pro">
        {rows.length === 0 ? <Empty text="Hali tarix yo‘q." /> : null}
        {rows.map(({ item, gift, caseItem, request }) => (
          <article className="history-row-pro premium-card" key={item.id}>
            <div className="history-art" style={{ background: gift?.background_value || undefined }}><GiftMedia gift={gift} compact preferStatic /></div>
            <div>
              <strong>{gift?.title || 'Sovg‘a'}</strong>
              <span>{caseItem?.title || 'Case'} · {new Date(item.created_at).toLocaleString('uz-UZ')}</span>
            </div>
            <StatusBadge status={request?.status || 'won'} />
          </article>
        ))}
      </div>
    </div>
  );
}

function ProfileView({ telegramUser, profile, totalOpenings, cases, history, gifts, withdrawals, pendingWithdrawals, isAdmin, onOpenAdmin }) {
  return (
    <div className="screen-stack">
      <PageHeader eyebrow="Profile" title="Account overview" description="Telegram profilingiz, balans va faoliyat statistikasi." />
      <section className="profile-grid">
        <div className="profile-hero premium-card">
          <div className="avatar-xl">{telegramUser?.first_name?.[0] || 'U'}</div>
          <div>
            <h2>{telegramUser?.first_name || 'Telegram user'}</h2>
            <p>{telegramUser?.username ? `@${telegramUser.username}` : `ID: ${telegramUser?.id || '-'}`}</p>
          </div>
          <div className="profile-actions-box">
            <BalancePill balance={profile?.balance} />
            {isAdmin ? <button className="admin-profile-btn" onClick={onOpenAdmin}><AppIcon name="admin" /> Admin Panel</button> : null}
          </div>
        </div>

        <div className="metrics-grid nested">
          <MetricCard label="Total opens" value={totalOpenings} icon="spark" tone="purple" />
          <MetricCard label="Wins" value={history.length} icon="spark" tone="gold" />
          <MetricCard label="Games" value={cases.length} icon="games" tone="cyan" />
          <MetricCard label="Pending" value={pendingWithdrawals} icon="⏳" tone="green" />
        </div>
      </section>

      <section className="split-grid">
        <div className="premium-card section-card">
          <SectionTitle title="So‘nggi yutuqlar" description="Oxirgi case ochishlaringiz." />
          <div className="activity-list">
            {history.slice(0, 6).map((item) => {
              const gift = rewardFromHistory(item, gifts);
              return <ActivityRow key={item.id} icon={giftIcon(gift)} title={gift?.title || 'Sovg‘a'} meta={new Date(item.created_at).toLocaleString('uz-UZ')} />;
            })}
            {history.length === 0 ? <Empty text="Hali yutuq yo‘q." /> : null}
          </div>
        </div>

        <div className="premium-card section-card">
          <SectionTitle title="Yechish so‘rovlari" description="Admin tekshiradigan so‘rovlar." />
          <div className="activity-list">
            {withdrawals.map((item) => {
              const gift = item.reward_title ? { title: item.reward_title } : gifts.find((giftItem) => giftItem.id === item.gift_id);
              return <ActivityRow key={item.id} icon="withdraw" title={gift?.title || 'Sovg‘a'} meta={<StatusBadge status={item.status} />} />;
            })}
            {withdrawals.length === 0 ? <Empty text="Yechish so‘rovi yo‘q." /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function AdminView(props) {
  const {
    adminTab, setAdminTab, cases, gifts, giftsByCase, giftCatalog, caseRewardForm, setCaseRewardForm, catalogSearch, setCatalogSearch, adminUsers, adminWithdrawals,
    caseForm, setCaseForm, caseImageFile, setCaseImageFile,
    giftForm, setGiftForm, giftImageFile, setGiftImageFile, giftAnimationFile, setGiftAnimationFile,
    userForm, setUserForm, busy,
    createCase, updateCase, deleteCase, createGift, updateGift, deleteGift,
    syncTelegramGifts, createCaseReward, updateCaseReward, deleteCaseReward,
    addBalance, toggleBan, loadAdminUsers, loadAdminWithdrawals, updateWithdrawal,
    adminPendingWithdrawals,
  } = props;

  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'cases', label: 'Cases' },
    { id: 'rewards', label: 'Case Rewards' },
    { id: 'catalog', label: 'Gift Catalog' },
    { id: 'gifts', label: 'Manual Gifts' },
    { id: 'users', label: 'Users' },
    { id: 'withdrawals', label: 'Withdrawals' },
  ];

  const selectedGiftCase = cases.find((item) => String(item.id) === String(giftForm.case_id));
  const selectedCaseGifts = giftForm.case_id ? (giftsByCase[giftForm.case_id] || []) : [];
  const selectedCaseActiveChance = chanceSum(selectedCaseGifts);
  const selectedCaseReadyGifts = selectedCaseGifts.filter(eligibleGift);
  const selectedCaseRemainingChance = Math.max(0, 100 - selectedCaseActiveChance);
  const selectedRewardCase = cases.find((item) => String(item.id) === String(caseRewardForm.case_id));
  const selectedRewardGifts = caseRewardForm.case_id ? (giftsByCase[caseRewardForm.case_id] || []) : [];
  const selectedRewardChance = chanceSum(selectedRewardGifts);
  const [catalogKind, setCatalogKind] = useState('all');
  const catalogCounts = useMemo(() => {
    const all = giftCatalog || [];
    return {
      all: all.length,
      nft: all.filter((gift) => catalogGiftKind(gift) === 'nft').length,
      regular: all.filter((gift) => catalogGiftKind(gift) === 'regular').length,
    };
  }, [giftCatalog]);
  const catalogList = (giftCatalog || []).filter((gift) => {
    const query = String(catalogSearch || '').trim().toLowerCase();
    const kind = catalogGiftKind(gift);
    if (catalogKind !== 'all' && kind !== catalogKind) return false;
    if (!query) return true;
    return String(gift.title || '').toLowerCase().includes(query) ||
      String(gift.telegram_gift_id || '').toLowerCase().includes(query) ||
      String(gift.slug || '').toLowerCase().includes(query);
  });

  return (
    <div className="screen-stack">
      <PageHeader eyebrow="Admin console" title="Professional management" description="Case, sovg‘a, user va yechish so‘rovlarini tartibli boshqarish." />
      <div className="admin-tabs premium-card">
        {adminTabs.map((item) => (
          <button key={item.id} className={adminTab === item.id ? 'active' : ''} onClick={() => setAdminTab(item.id)}>{item.label}</button>
        ))}
      </div>

      {adminTab === 'dashboard' ? (
        <section className="screen-stack">
          <div className="metrics-grid">
            <MetricCard label="All cases" value={cases.length} icon="cases" tone="cyan" />
            <MetricCard label="Case rewards" value={gifts.length} icon="gem" tone="purple" />
            <MetricCard label="Users" value={adminUsers.length} icon="profile" tone="green" />
            <MetricCard label="Pending" value={adminPendingWithdrawals} icon="⏳" tone="gold" />
          </div>
          <div className="split-grid">
            <div className="premium-card section-card">
              <SectionTitle title="Quick actions" description="Eng ko‘p ishlatiladigan admin amallar." />
              <div className="quick-actions">
                <button className="primary-btn" onClick={() => setAdminTab('cases')}>+ Case qo‘shish</button>
                <button className="ghost-btn" onClick={() => setAdminTab('rewards')}>+ Case reward qo‘shish</button>
                <button className="ghost-btn" onClick={() => setAdminTab('catalog')}>Gift Catalog</button>
                <button className="ghost-btn" onClick={() => setAdminTab('withdrawals')}>Yechishlarni ko‘rish</button>
              </div>
            </div>
            <div className="premium-card section-card">
              <SectionTitle title="System status" description="Web App holati." />
              <div className="system-list">
                <ActivityRow icon="spark" title="Telegram auth" meta="Active" />
                <ActivityRow icon="spark" title="Supabase database" meta="Connected" />
                <ActivityRow icon="spark" title="Image upload" meta="Storage ready" />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {adminTab === 'cases' ? (
        <div className="admin-workspace">
          <form className="manager-form premium-card" onSubmit={createCase}>
            <SectionTitle title="Case qo‘shish" description="URL emas, rasmni to‘g‘ridan-to‘g‘ri upload qiling." />
            <FileInput label="Case rasmi" file={caseImageFile} onChange={setCaseImageFile} />
            <Input label="Case nomi" value={caseForm.title} onChange={(value) => setCaseForm({ ...caseForm, title: value })} placeholder="Premium Case" />
            <Input label="Narxi" type="number" value={caseForm.price} onChange={(value) => setCaseForm({ ...caseForm, price: value })} placeholder="3.5 yoki 5000" />
            <div className="two-fields">
              <Input label="Badge" value={caseForm.badge_text} onChange={(value) => setCaseForm({ ...caseForm, badge_text: value })} placeholder="LIMITED / HOT / NEW" />
              <Input label="Accent color" value={caseForm.accent_color} onChange={(value) => setCaseForm({ ...caseForm, accent_color: value })} placeholder="#22c55e" />
            </div>
            <Input label="Badge color" value={caseForm.badge_color} onChange={(value) => setCaseForm({ ...caseForm, badge_color: value })} placeholder="#f6b7b1" />
            <Textarea label="Izoh" value={caseForm.description} onChange={(value) => setCaseForm({ ...caseForm, description: value })} placeholder="Case haqida qisqa izoh" />
            <button className="primary-btn full" disabled={busy}>Case saqlash</button>
          </form>

          <div className="manager-list">
            {cases.map((caseItem) => (
              <div className="admin-item premium-card" key={caseItem.id}>
                <div className="admin-thumb">{caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : <AppIcon name="box" />}</div>
                <div className="admin-item-main">
                  <strong>{caseItem.title}</strong>
                  <span>{formatPrice(caseItem.price)} <AppIcon name="coin" /> · {(giftsByCase[caseItem.id] || []).length} sovg‘a · {caseItem.is_active ? 'Aktiv' : 'Yashirilgan'}</span>
                  {caseItem.badge_text ? <small className="admin-case-badge" style={{ background: caseBadgeColor(caseItem) }}>{caseItem.badge_text}</small> : null}
                </div>
                <div className="admin-actions">
                  <button className="ghost-btn small" onClick={() => {
                    const newPrice = prompt('Yangi narx:', String(caseItem.price || 0));
                    if (newPrice !== null) updateCase(caseItem, { price: newPrice });
                  }}>Narx</button>
                  <button className="ghost-btn small" onClick={() => {
                    const newBadge = prompt('Badge text:', String(caseItem.badge_text || ''));
                    if (newBadge !== null) updateCase(caseItem, { badge_text: newBadge });
                  }}>Badge</button>
                  <button className="ghost-btn small" onClick={() => {
                    const newAccent = prompt('Accent color:', String(caseItem.accent_color || '#22c55e'));
                    if (newAccent !== null) updateCase(caseItem, { accent_color: newAccent });
                  }}>Rang</button>
                  <button className="ghost-btn small" onClick={() => updateCase(caseItem, { is_active: !caseItem.is_active })}>{caseItem.is_active ? 'Yashirish' : 'Aktiv'}</button>
                  <button className="danger-btn small" onClick={() => deleteCase(caseItem.id)}>O‘chirish</button>
                </div>
              </div>
            ))}
            {cases.length === 0 ? <Empty text="Case yo‘q." /> : null}
          </div>
        </div>
      ) : null}

      {adminTab === 'gifts' ? (
        <div className="gift-admin-layout">
          <form className="gift-wizard premium-card" onSubmit={createGift}>
            <div className="wizard-head">
              <div>
                <span className="eyebrow">Gift wizard</span>
                <h2>Sovg‘a qo‘shish</h2>
                <p>1) Case tanlang → 2) PNG/WEBP rasm yuklang → 3) WEBM/MP4 animatsiya qo‘shing → 4) Chance va stockni yozing.</p>
              </div>
              <div className="wizard-score">
                <span>Ready gifts</span>
                <strong>{selectedCaseReadyGifts.length}</strong>
              </div>
            </div>

            <div className="wizard-step">
              <span className="step-number">1</span>
              <div className="wizard-field">
                <Select label="Qaysi casega qo‘shiladi?" value={giftForm.case_id} onChange={(value) => setGiftForm({ ...giftForm, case_id: value })}>
                  <option value="">Case tanlang</option>
                  {cases.map((caseItem) => <option value={caseItem.id} key={caseItem.id}>{caseItem.title}</option>)}
                </Select>
                {selectedGiftCase ? (
                  <div className="case-health-card">
                    <div className="case-health-thumb">{selectedGiftCase.image_url ? <img src={selectedGiftCase.image_url} alt={selectedGiftCase.title} /> : <AppIcon name="box" />}</div>
                    <div>
                      <strong>{selectedGiftCase.title}</strong>
                      <span>{selectedCaseGifts.length} sovg‘a · Ready: {selectedCaseReadyGifts.length} · Chance: {selectedCaseActiveChance}%</span>
                      <small>Yangi sovg‘a uchun taxminiy qolgan chance: {selectedCaseRemainingChance}%</small>
                    </div>
                  </div>
                ) : <div className="mini-help">Sovg‘a casega bog‘lanmasa, case ichida chiqmaydi.</div>}
              </div>
            </div>

            <div className="wizard-step">
              <span className="step-number">2</span>
              <div className="wizard-field two-upload-grid">
                <FileInput label="Sovg‘a rasmi — PNG/WEBP" file={giftImageFile} onChange={setGiftImageFile} accept="image/png,image/jpeg,image/webp" helper="Majburiy · PNG yoki WEBP · max 8MB" />
                <FileInput label="Yutganda chiqadigan animatsiya — WEBM/MP4" file={giftAnimationFile} onChange={setGiftAnimationFile} accept="video/webm,video/mp4" helper="Tavsiya qilinadi · WEBM/MP4 · max 8MB" />
              </div>
            </div>

            <div className="wizard-step">
              <span className="step-number">3</span>
              <div className="wizard-field">
                <Input label="Sovg‘a nomi" value={giftForm.title} onChange={(value) => setGiftForm({ ...giftForm, title: value })} placeholder="Victory Medal / Telegram Premium / 100 Stars" />
                <div className="two-fields">
                  <Input label="Type" value={giftForm.type} onChange={(value) => setGiftForm({ ...giftForm, type: value })} placeholder="gift / premium / stars / bonus" />
                  <Input label="Value" value={giftForm.value} onChange={(value) => setGiftForm({ ...giftForm, value: value })} placeholder="1 oy / 100 Stars / 3.5" />
                </div>
                <div className="two-fields">
                  <Input label="Chance %" type="number" value={giftForm.chance} onChange={(value) => setGiftForm({ ...giftForm, chance: value })} placeholder="10" />
                  <Input label="Stock" type="number" value={giftForm.stock} onChange={(value) => setGiftForm({ ...giftForm, stock: value })} placeholder="999" />
                </div>
                <div className="quick-preset-row">
                  {[1, 5, 10, 25, 50].map((value) => <button type="button" key={value} onClick={() => setGiftForm({ ...giftForm, chance: String(value), rarity: giftRarity({ chance: value }) })}>{value}%</button>)}
                  {[10, 100, 999].map((value) => <button type="button" key={`stock-${value}`} onClick={() => setGiftForm({ ...giftForm, stock: String(value) })}>Stock {value}</button>)}
                </div>
              </div>
            </div>

            <div className="wizard-step">
              <span className="step-number">4</span>
              <div className="wizard-field">
                <Select label="Rarity" value={giftForm.rarity} onChange={(value) => setGiftForm({ ...giftForm, rarity: value, background_value: giftForm.background_value || defaultGiftBackground(value) })}>
                  <option value="common">Common</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                  <option value="mythic">Mythic</option>
                </Select>
                <Input label="Gift foni" value={giftForm.background_value} onChange={(value) => setGiftForm({ ...giftForm, background_value: value })} placeholder="linear-gradient(135deg,#ffc400,#23c59a)" />
                <div className="background-preset-row">
                  {GIFT_BACKGROUND_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.name}
                      style={{ background: preset.value }}
                      onClick={() => setGiftForm({ ...giftForm, background_value: preset.value })}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <div className="gift-preview-live" style={{ background: giftForm.background_value || defaultGiftBackground(giftForm.rarity) }}>
                  {giftImageFile ? <img src={URL.createObjectURL(giftImageFile)} alt="Gift preview" /> : <AppIcon name="gem" />}
                  <div>
                    <strong>{giftForm.title || 'Gift preview'}</strong>
                    <span>{giftForm.chance || 0}% · Stock: {giftForm.stock || 0} · {giftForm.rarity}</span>
                  </div>
                </div>
              </div>
            </div>

            <button className="primary-btn full wizard-save" disabled={busy}>Sovg‘ani saqlash</button>
          </form>

          <div className="gift-admin-side">
            <div className="premium-card gift-checklist">
              <SectionTitle title="Case ochilishi uchun shartlar" description="Shu 4 narsa to‘g‘ri bo‘lsa, “aktiv, stock bor sovg‘a yo‘q” xatosi chiqmaydi." />
              <ul>
                <li><AppIcon name="admin" /> Sovg‘a aktiv bo‘lishi kerak</li>
                <li><AppIcon name="spark" /> Chance 0 dan katta bo‘lishi kerak</li>
                <li><AppIcon name="box" /> Stock 1 yoki undan katta bo‘lishi kerak</li>
                <li><AppIcon name="gem" /> PNG/WEBP rasm yuklangan bo‘lishi kerak</li>
              </ul>
            </div>

            <div className="manager-list gift-list-pro">
              {gifts.map((gift) => (
                <div className={`admin-item premium-card gift-admin-card rarity-left ${gift.rarity || giftRarity(gift)} ${eligibleGift(gift) ? 'ready' : 'not-ready'}`} key={gift.id}>
                  <div className="gift-symbol gift-admin-symbol" style={{ background: gift.background_value || undefined }}><GiftMedia gift={gift} compact preferStatic /></div>
                  <div className="admin-item-main">
                    <strong>{gift.title}</strong>
                    <span>{cases.find((item) => item.id === gift.case_id)?.title || 'Case'} · {gift.chance}% · Stock: {gift.stock}</span>
                    <small className={eligibleGift(gift) ? 'ready-text' : 'warning-text'}>{giftProblem(gift)}</small>
                  </div>
                  <RarityBadge rarity={gift.rarity || giftRarity(gift)} />
                  <div className="admin-actions compact-actions">
                    <button className="ghost-btn small" onClick={() => updateGift(gift, { is_active: gift.is_active === false })}>{gift.is_active === false ? 'Aktiv qilish' : 'Yashirish'}</button>
                    <button className="ghost-btn small" onClick={() => {
                      const newChance = prompt('Yangi chance:', String(gift.chance || 0));
                      if (newChance !== null) updateGift(gift, { chance: newChance });
                    }}>Chance</button>
                    <button className="ghost-btn small" onClick={() => {
                      const newStock = prompt('Yangi stock:', String(gift.stock || 0));
                      if (newStock !== null) updateGift(gift, { stock: newStock });
                    }}>Stock</button>
                    <button className="danger-btn small" onClick={() => deleteGift(gift.id)}>O‘chirish</button>
                  </div>
                </div>
              ))}
              {gifts.length === 0 ? <Empty text="Sovg‘a yo‘q. Chapdagi wizard orqali birinchi sovg‘ani qo‘shing." /> : null}
            </div>
          </div>
        </div>
      ) : null}


      {adminTab === 'catalog' ? (
        <div className="screen-stack">
          <div className="toolbar premium-card catalog-toolbar">
            <div>
              <strong>Telegram Gift Catalog</strong>
              <span>Bu bazadan case, keyinchalik upgrade va contract ham foydalanadi. Giftlar qidiruvsiz ham ketma-ket ko‘rinadi.</span>
            </div>
            <button className="primary-btn" type="button" disabled={busy} onClick={syncTelegramGifts}><AppIcon name="spark" /> Sync Telegram Gifts</button>
          </div>

          <div className="premium-card catalog-search-card">
            <div className="catalog-kind-tabs">
              <button type="button" className={catalogKind === 'all' ? 'active' : ''} onClick={() => setCatalogKind('all')}>Barchasi <b>{catalogCounts.all}</b></button>
              <button type="button" className={catalogKind === 'nft' ? 'active' : ''} onClick={() => setCatalogKind('nft')}>NFT / Animated <b>{catalogCounts.nft}</b></button>
              <button type="button" className={catalogKind === 'regular' ? 'active' : ''} onClick={() => setCatalogKind('regular')}>Oddiy <b>{catalogCounts.regular}</b></button>
            </div>
            <Input label="Gift qidirish" value={catalogSearch} onChange={setCatalogSearch} placeholder="Lollipop, medal, star..." />
            <small>Jami catalog: {giftCatalog.length} ta · Ko‘rinayotgan: {catalogList.length} ta · Animatsiya WEBM/TGS bo‘lsa avtomatik chiqadi.</small>
          </div>

          <div className="gift-catalog-grid">
            {catalogList.map((gift) => (
              <button
                type="button"
                className={`catalog-gift-card ${String(caseRewardForm.catalog_gift_id) === String(gift.id) ? 'selected' : ''}`}
                key={gift.id}
                onClick={() => {
                  setCaseRewardForm({ ...caseRewardForm, reward_type: 'nft', catalog_gift_id: gift.id });
                  setAdminTab('rewards');
                }}
                style={{ '--gift-bg': gift.background_value || 'linear-gradient(135deg,#1f2937,#111827)' }}
              >
                <span className="catalog-resale-ribbon">{catalogKindLabel(gift)}</span>
                <div className="catalog-gift-art"><GiftMedia gift={gift} /></div>
                <strong>{gift.title}</strong>
                <span>{formatPrice(gift.display_price || gift.star_price || gift.manual_price)} ⭐</span>
              </button>
            ))}
            {giftCatalog.length === 0 ? <Empty text="Hali Telegram giftlar sync qilinmagan. Yuqoridagi Sync Telegram Gifts tugmasini bosing." /> : null}
            {giftCatalog.length > 0 && catalogList.length === 0 ? <Empty text="Qidiruv bo‘yicha gift topilmadi." /> : null}
          </div>
        </div>
      ) : null}

      {adminTab === 'rewards' ? (
        <div className="admin-workspace rewards-workspace">
          <form className="gift-wizard premium-card" onSubmit={createCaseReward}>
            <SectionTitle title="Case Reward qo‘shish" description="Eski dizayn saqlandi. Endi admin faqat moneta yoki Telegram NFT gift tanlab, chance/stock kiritadi." />

            <div className="wizard-step">
              <span className="step-number">1</span>
              <div className="wizard-field">
                <Select label="Qaysi casega qo‘shiladi?" value={caseRewardForm.case_id} onChange={(value) => setCaseRewardForm({ ...caseRewardForm, case_id: value })}>
                  <option value="">Case tanlang</option>
                  {cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </Select>
                {selectedRewardCase ? (
                  <div className="case-health-card">
                    <div className="case-health-thumb">{selectedRewardCase.image_url ? <img src={selectedRewardCase.image_url} alt={selectedRewardCase.title} /> : <AppIcon name="box" />}</div>
                    <div>
                      <strong>{selectedRewardCase.title}</strong>
                      <span>{selectedRewardGifts.length} reward · Chance: {selectedRewardChance}% · Qolgan: {Math.max(0, 100 - selectedRewardChance)}%</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="wizard-step">
              <span className="step-number">2</span>
              <div className="wizard-field">
                <div className="reward-type-toggle">
                  <button type="button" className={caseRewardForm.reward_type === 'coin' ? 'active' : ''} onClick={() => setCaseRewardForm({ ...caseRewardForm, reward_type: 'coin' })}><AppIcon name="coin" /> Moneta</button>
                  <button type="button" className={caseRewardForm.reward_type === 'nft' ? 'active' : ''} onClick={() => setCaseRewardForm({ ...caseRewardForm, reward_type: 'nft' })}><AppIcon name="gem" /> NFT Gift</button>
                </div>

                {caseRewardForm.reward_type === 'coin' ? (
                  <div className="two-fields">
                    <Select label="Moneta turi" value={caseRewardForm.coin_type} onChange={(value) => setCaseRewardForm({ ...caseRewardForm, coin_type: value })}>
                      <option value="balance">Balance coin</option>
                      <option value="stars">Stars coin</option>
                    </Select>
                    <Input label="Miqdor" type="number" value={caseRewardForm.coin_amount} onChange={(value) => setCaseRewardForm({ ...caseRewardForm, coin_amount: value })} placeholder="100" />
                  </div>
                ) : (
                  <>
                    <Input label="Gift qidirish" value={catalogSearch} onChange={setCatalogSearch} placeholder="Gift nomi bo‘yicha qidirish" />
                    <div className="catalog-picker-strip">
                      {catalogList.slice(0, 80).map((gift) => (
                        <button
                          type="button"
                          key={gift.id}
                          className={String(caseRewardForm.catalog_gift_id) === String(gift.id) ? 'selected' : ''}
                          onClick={() => setCaseRewardForm({ ...caseRewardForm, catalog_gift_id: gift.id })}
                          style={{ '--gift-bg': gift.background_value || 'linear-gradient(135deg,#1f2937,#111827)' }}
                        >
                          <GiftMedia gift={gift} compact />
                          <em>{catalogKindLabel(gift)}</em>
                          <strong>{gift.title}</strong>
                          <span>{formatPrice(gift.display_price || gift.star_price)} ⭐</span>
                        </button>
                      ))}
                      {giftCatalog.length === 0 ? (
                        <div className="catalog-empty-inline">
                          <span>Gift catalog bo‘sh.</span>
                          <button type="button" className="ghost-btn small" onClick={syncTelegramGifts}>Sync qilish</button>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="wizard-step">
              <span className="step-number">3</span>
              <div className="wizard-field">
                <div className="two-fields">
                  <Input label="Tushish foizi %" type="number" value={caseRewardForm.chance} onChange={(value) => setCaseRewardForm({ ...caseRewardForm, chance: value })} placeholder="10" />
                  <Input label="Stock" type="number" value={caseRewardForm.stock} onChange={(value) => setCaseRewardForm({ ...caseRewardForm, stock: value })} placeholder="999" />
                </div>
                <div className="quick-preset-row">
                  {[1, 3, 5, 10, 25, 50].map((value) => <button type="button" key={value} onClick={() => setCaseRewardForm({ ...caseRewardForm, chance: String(value) })}>{value}%</button>)}
                  {[10, 100, 999].map((value) => <button type="button" key={`stock-${value}`} onClick={() => setCaseRewardForm({ ...caseRewardForm, stock: String(value) })}>Stock {value}</button>)}
                </div>
              </div>
            </div>

            <button className="primary-btn full wizard-save" disabled={busy}>Rewardni casega qo‘shish</button>
          </form>

          <div className="gift-admin-side">
            <div className="premium-card gift-checklist">
              <SectionTitle title="Endi PNG/WEBM yuklash shart emas" description="NFT giftlar Telegram Gift Catalog’dan keladi. Admin faqat case, gift, chance va stock tanlaydi." />
              <ul>
                <li><AppIcon name="admin" /> Gift catalog sync qilingan bo‘lsin</li>
                <li><AppIcon name="spark" /> Case ichida chance &gt; 0 bo‘lsin</li>
                <li><AppIcon name="box" /> Stock 1 yoki undan katta bo‘lsin</li>
                <li><AppIcon name="gem" /> Moneta yoki NFT gift tanlangan bo‘lsin</li>
              </ul>
            </div>

            <div className="manager-list gift-list-pro">
              {gifts.map((gift) => (
                <div className={`admin-item premium-card gift-admin-card rarity-left ${gift.rarity || giftRarity(gift)} ${eligibleGift(gift) ? 'ready' : 'not-ready'}`} key={gift.id}>
                  <div className="gift-symbol gift-admin-symbol" style={{ background: gift.background_value || undefined }}><GiftMedia gift={gift} compact preferStatic /></div>
                  <div className="admin-item-main">
                    <strong>{gift.title}</strong>
                    <span>{cases.find((item) => item.id === gift.case_id)?.title || 'Case'} · {gift.reward_type === 'coin' ? 'Moneta' : 'NFT Gift'} · {gift.chance}% · Stock: {gift.stock}</span>
                    <small className={eligibleGift(gift) ? 'ready-text' : 'warning-text'}>{giftProblem(gift)}</small>
                  </div>
                  <RarityBadge rarity={gift.rarity || giftRarity(gift)} />
                  <div className="admin-actions compact-actions">
                    <button className="ghost-btn small" onClick={() => updateCaseReward(gift, { is_active: gift.is_active === false })}>{gift.is_active === false ? 'Aktiv qilish' : 'Yashirish'}</button>
                    <button className="ghost-btn small" onClick={() => {
                      const newChance = prompt('Yangi chance:', String(gift.chance || 0));
                      if (newChance !== null) updateCaseReward(gift, { chance: newChance });
                    }}>Chance</button>
                    <button className="ghost-btn small" onClick={() => {
                      const newStock = prompt('Yangi stock:', String(gift.stock || 0));
                      if (newStock !== null) updateCaseReward(gift, { stock: newStock });
                    }}>Stock</button>
                    <button className="danger-btn small" onClick={() => deleteCaseReward(gift.id)}>O‘chirish</button>
                  </div>
                </div>
              ))}
              {gifts.length === 0 ? <Empty text="Bu case rewardlar ro‘yxati bo‘sh. Chapdan moneta yoki NFT gift qo‘shing." /> : null}
            </div>
          </div>
        </div>
      ) : null}

      {adminTab === 'users' ? (
        <div className="admin-workspace">
          <form className="manager-form premium-card" onSubmit={addBalance}>
            <SectionTitle title="User balance" description="Telegram ID orqali balans qo‘shish yoki ayirish." />
            <Input label="Telegram user ID" value={userForm.userId} onChange={(value) => setUserForm({ ...userForm, userId: value })} placeholder="123456789" />
            <Input label="Summa" type="number" value={userForm.amount} onChange={(value) => setUserForm({ ...userForm, amount: value })} placeholder="10000 yoki -5000" />
            <button className="primary-btn full" disabled={busy}>Balansni yangilash</button>
            <button className="ghost-btn full" type="button" onClick={loadAdminUsers}>Userlarni yangilash</button>
          </form>

          <div className="manager-list">
            {adminUsers.map((user) => (
              <div className="admin-item premium-card" key={user.id}>
                <div className="avatar-sm">{user.first_name?.[0] || 'U'}</div>
                <div className="admin-item-main">
                  <strong>{user.first_name || 'User'} {user.username ? `@${user.username}` : ''}</strong>
                  <span>ID: {user.id} · Balans: {money(user.balance)} so‘m · {user.is_banned ? 'Ban' : 'Aktiv'}</span>
                </div>
                <div className="admin-actions">
                  <button className="ghost-btn small" onClick={() => setUserForm({ userId: String(user.id), amount: '' })}>Tanlash</button>
                  <button className="danger-btn small" onClick={() => toggleBan(user)}>{user.is_banned ? 'Unban' : 'Ban'}</button>
                </div>
              </div>
            ))}
            {adminUsers.length === 0 ? <Empty text="Userlar yuklanmagan. Tugmani bosing." /> : null}
          </div>
        </div>
      ) : null}

      {adminTab === 'withdrawals' ? (
        <div className="screen-stack">
          <div className="toolbar premium-card">
            <div>
              <strong>Withdraw requests</strong>
              <span>Yangi so‘rovlarni tekshirib, qabul/rad qiling.</span>
            </div>
            <button className="ghost-btn" onClick={loadAdminWithdrawals}>Yangilash</button>
          </div>
          <div className="manager-list single">
            {adminWithdrawals.map((item) => (
              <div className="admin-item premium-card" key={item.id}>
                <div className="gift-symbol"><AppIcon name="withdraw" /></div>
                <div className="admin-item-main">
                  <strong>{item.reward_title || item.gifts?.title || 'Sovg‘a'}</strong>
                  <span>{item.users?.first_name || 'User'} {item.users?.username ? `@${item.users.username}` : ''} · ID: {item.users?.id}</span>
                  <span>{new Date(item.created_at).toLocaleString('uz-UZ')}</span>
                </div>
                <StatusBadge status={item.status} />
                <div className="admin-actions">
                  <button className="primary-btn small" onClick={() => updateWithdrawal(item.id, 'approved')}>Qabul</button>
                  <button className="danger-btn small" onClick={() => updateWithdrawal(item.id, 'rejected')}>Rad</button>
                </div>
              </div>
            ))}
            {adminWithdrawals.length === 0 ? <Empty text="Yechish so‘rovlari yo‘q." /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CaseDetailsModal({ caseItem, gifts, busy, onClose, onOpen }) {
  const accent = caseAccent(caseItem);
  const badge = caseBadgeText(caseItem, gifts);
  const eligibleGifts = gifts.filter(eligibleGift);
  const livePreview = (eligibleGifts.length ? eligibleGifts : gifts).slice(0, 12);
  const canOpen = eligibleGifts.length > 0;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <article className="case-detail-sheet" style={{ '--case-accent': accent, '--case-badge': caseBadgeColor(caseItem) }} onMouseDown={(event) => event.stopPropagation()}>
        <button className="close-btn market-close" onClick={onClose}>×</button>
        <div className="case-detail-top">
          <div className="daily-label"><span><AppIcon name="gift" /></span> {badge || 'DAILY BOX'}</div>
          <div className="latest-drops">Latest TOP drops <i /> <i /> <i /></div>
        </div>

        <div className="case-detail-feature">
          <div className="case-detail-thumb">
            {caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : <span><AppIcon name="box" /></span>}
          </div>
          <div>
            <span className="hot-pill"><AppIcon name="spark" /> HOT</span>
            <h2>{caseItem.title}</h2>
            <strong>{formatPrice(caseItem.price)} {coinIcon()}</strong>
            <p>{caseItem.description || 'Bu case ichida premium sovg‘alar, bonuslar va chance bo‘yicha yutuqlar bor.'}</p>
          </div>
        </div>

        <div className="case-preview-reel">
          <div className="case-preview-pointer" />
          {livePreview.map((gift, index) => (
            <div className={`preview-reel-item ${gift.rarity || giftRarity(gift)} ${eligibleGift(gift) ? '' : 'disabled-gift'}`} key={`${gift.id}-${index}`} style={{ background: gift.background_value || undefined }}>
              <GiftMedia gift={gift} preferStatic />
              <small>{gift.chance}%</small>
            </div>
          ))}
          {gifts.length === 0 ? <Empty text="Bu gamega hali sovg‘a qo‘shilmagan." /> : null}
        </div>

        {!canOpen ? (
          <div className="case-warning-box">
            <strong>Bu case hali ochilmaydi</strong>
            <span>Kamida 1 ta sovg‘ada active=true, chance &gt; 0, stock &gt; 0 va rasm bo‘lishi kerak.</span>
          </div>
        ) : null}

        <button className="open-big-btn" disabled={busy || !canOpen} onClick={onOpen}><AppIcon name="gift" /> Open {caseItem.title}</button>

        <div className="case-prize-grid">
          {gifts.map((gift) => (
            <div className={`prize-card ${gift.rarity || giftRarity(gift)} ${eligibleGift(gift) ? 'ready' : 'not-ready'}`} key={gift.id} style={{ background: gift.background_value || undefined }}>
              <GiftMedia gift={gift} preferStatic />
              <strong>{gift.title}</strong>
              <small>{gift.chance}% · Stock: {gift.stock} · {giftProblem(gift)}</small>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function OpeningModal({ opening, gifts, onClose, onOpenAgain, busy }) {
  const { stage, gift, caseItem, reel = [], spinKey, opening: openingMeta, balanceBefore, balanceAfter } = opening;
  const activeReel = reel.length ? reel : buildOpeningReel(gifts, gift);
  const isSpinning = stage === 'preparing' || stage === 'rolling';
  const reelDistance = Math.max(0, (activeReel.length - 4) * 126);

  return (
    <div className="modal-backdrop opening-backdrop">
      <article className={`opening-modal premium-card ${stage === 'result' ? `result-${giftRarity(gift)}` : ''}`}>
        {isSpinning ? (
          <>
            <div className="opening-topline">
              <span className="eyebrow">Opening {caseItem.title}</span>
              <strong>{money(caseItem.price)} so‘m</strong>
            </div>
            <h2>{stage === 'preparing' ? 'Server natijani tayyorlamoqda...' : 'Omad g‘ildiragi aylanmoqda...'}</h2>
            <div className="pro-reel-shell">
              <div className="reel-center-line">◆</div>
              <div
                key={spinKey}
                className={`pro-reel-track ${stage === 'rolling' ? 'is-rolling' : 'is-preparing'}`}
                style={{ '--reel-distance': `${reelDistance}px` }}
              >
                {activeReel.map((item, index) => (
                  <div className={`pro-reel-item media-only ${giftRarity(item)}`} key={`${item?.id || 'gift'}-${index}`} style={{ background: item?.background_value || undefined }}>
                    <GiftMedia gift={item} preferStatic />
                  </div>
                ))}
              </div>
            </div>
            <div className="opening-info-row">
              <span><AppIcon name="spark" /> Server random</span>
              <span><AppIcon name="box" /> Stock nazorat</span>
              <span><AppIcon name="admin" /> Secure logic</span>
            </div>
            <p>Natija serverda tanlanadi. Animatsiya faqat chiroyli ko‘rsatish uchun.</p>
          </>
        ) : (
          <>
            <button className="close-btn" onClick={onClose}>×</button>
            <div className={`win-result ${giftRarity(gift)}`}>
              <div className="win-confetti">
                <span /><span /><span /><span /><span />
              </div>
              <div className="win-spark"><AppIcon name="spark" /> JACKPOT HIT</div>
              <div className="win-gift-media" style={{ background: gift?.background_value || undefined }}><GiftMedia gift={gift} /></div>
              <RarityBadge rarity={giftRarity(gift)} />
              <h2>{gift?.title}</h2>
              <p>Tabriklaymiz! Sovg‘a inventory’ga tushdi va tarixga yozildi.</p>

              <div className="win-stats">
                <div>
                  <span>Balance oldin</span>
                  <strong>{money(balanceBefore)} so‘m</strong>
                </div>
                <div>
                  <span>Balance hozir</span>
                  <strong>{money(balanceAfter)} so‘m</strong>
                </div>
                <div>
                  <span>Chance pool</span>
                  <strong>{Number(openingMeta?.totalChance || 0)}%</strong>
                </div>
              </div>

              <div className="win-actions">
                <button className="primary-btn" disabled={busy} onClick={onOpenAgain}>Yana ochish</button>
                <button className="ghost-btn" onClick={onClose}>Inventoryga o‘tish</button>
              </div>
            </div>
          </>
        )}
      </article>
    </div>
  );
}

function PageHeader({ eyebrow, title, description }) {
  return (
    <header className="page-header premium-card">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

function SectionTitle({ title, description }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function MetricCard({ label, value, icon, tone = 'cyan' }) {
  return (
    <div className={`metric-card premium-card ${tone}`}>
      <span><AppIcon name={metricIconName(icon)} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ActivityRow({ icon, title, meta }) {
  return (
    <div className="activity-row">
      <div className="activity-icon"><AppIcon name={metricIconName(icon)} /></div>
      <div>
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div className="empty-state">{text}</div>;
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${status || 'pending'}`}>{status || 'pending'}</span>;
}

function RarityBadge({ rarity }) {
  return <span className={`rarity-badge ${rarity}`}>{rarity}</span>;
}

function giftIcon(gift) {
  const text = `${gift?.type || ''} ${gift?.title || ''}`.toLowerCase();
  if (text.includes('premium') || text.includes('star')) return 'spark';
  if (text.includes('bonus') || text.includes('balans')) return 'coin';
  if (text.includes('promocode') || text.includes('promo')) return 'gift';
  if (text.includes('nothing') || text.includes('bo‘sh') || text.includes('bosh')) return 'box';
  return 'gem';
}

function FileInput({ label, file, onChange, accept = 'image/png,image/jpeg,image/webp,image/gif', helper = 'PNG, JPG, WEBP yoki GIF · max 4MB' }) {
  const previewUrl = file ? URL.createObjectURL(file) : '';
  const isVideo = file?.type?.startsWith('video/');

  return (
    <label className="upload-field">
      <span>{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <div className="upload-box">
        {previewUrl && isVideo ? <video src={previewUrl} autoPlay muted loop playsInline /> : null}
        {previewUrl && !isVideo ? <img src={previewUrl} alt="Preview" /> : null}
        {!previewUrl ? <strong>Fayl tanlash</strong> : null}
        <small>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : helper}</small>
      </div>
    </label>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}
