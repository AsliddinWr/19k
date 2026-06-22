'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const emptyCaseForm = {
  title: '',
  description: '',
  price: '0',
  image_url: '',
  badge_text: '',
  badge_color: '#22c55e',
  accent_color: '#22c55e',
  card_style: 'default',
};

const emptyCaseGiftForm = {
  case_id: '',
  reward_type: 'nft',
  catalog_gift_id: '',
  coin_type: 'balance',
  coin_amount: '1',
  chance: '10',
  stock: '999',
};

const emptyUserForm = { userId: '', amount: '' };

function money(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(number);
}

function formatPrice(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  if (number === 0) return 'FREE';
  if (number < 100) return String(number).replace(/\.0+$/, '');
  return money(number);
}

function cleanPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function safeStyleBackground(value, fallback = 'linear-gradient(135deg,#232323,#111)') {
  if (!value || typeof value !== 'string') return fallback;
  const v = value.trim();
  if (v.startsWith('linear-gradient') || v.startsWith('radial-gradient') || v.startsWith('#') || v.startsWith('rgb')) return v;
  return fallback;
}

function groupByCase(items) {
  return (items || []).reduce((acc, item) => {
    const key = item.case_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function isReadyReward(item) {
  if (!item || item.is_active === false) return false;
  if (Number(item.stock || 0) <= 0) return false;
  if (Number(item.chance || 0) <= 0) return false;
  if (item.reward_type === 'nft') return Boolean(item.image_url || item.animation_url || item.catalog?.image_url || item.catalog?.animation_url);
  return Number(item.coin_amount || item.value || 0) > 0;
}

function rewardTitle(item) {
  if (!item) return 'Gift';
  if (item.reward_type === 'coin') {
    return item.reward_title || (item.coin_type === 'stars' ? `${money(item.coin_amount)} Stars` : `${money(item.coin_amount)} Balance coin`);
  }
  return item.reward_title || item.title || item.catalog?.title || 'Telegram Gift';
}

function rewardImage(item) {
  if (!item) return '';
  return item.reward_image_url || item.image_url || item.catalog?.image_url || '';
}

function rewardAnimation(item) {
  if (!item) return '';
  return item.reward_animation_url || item.animation_url || item.catalog?.animation_url || '';
}

function rewardBackground(item) {
  if (item?.reward_type === 'coin') {
    return item.coin_type === 'stars'
      ? 'linear-gradient(135deg,#f59e0b 0%,#fde68a 45%,#4a2600 100%)'
      : 'linear-gradient(135deg,#38bdf8 0%,#2563eb 48%,#07172f 100%)';
  }
  return safeStyleBackground(item?.reward_background_value || item?.background_value || item?.catalog?.background_value, 'linear-gradient(135deg,#252525,#111)');
}

function rewardRarity(item) {
  return item?.reward_rarity || item?.rarity || item?.catalog?.rarity || (item?.reward_type === 'coin' ? 'rare' : 'common');
}

function randomItem(items) {
  if (!items?.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function buildOpeningReel(pool, winning) {
  const safePool = pool?.length ? pool : [winning].filter(Boolean);
  const reel = [];
  for (let i = 0; i < 34; i += 1) reel.push(randomItem(safePool));
  if (winning) reel.push(winning);
  for (let i = 0; i < 5; i += 1) reel.push(randomItem(safePool));
  return reel.filter(Boolean);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
      return <svg {...common}><path d="M4 10.7 12 4l8 6.7V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.3Z"/><path d="M3 11.2 12 3l9 8.2"/></svg>;
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
    case 'admin':
      return <svg {...common}><path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z"/><path d="M9 12l2 2 4-5"/></svg>;
    case 'gift':
      return <svg {...common}><path d="M4 10h16v10H4V10Z"/><path d="M3 7h18v3H3V7Z"/><path d="M12 7v13"/><path d="M12 7c-2.5 0-4-1-4-2.4A1.8 1.8 0 0 1 11.2 3L12 7Zm0 0c2.5 0 4-1 4-2.4A1.8 1.8 0 0 0 12.8 3L12 7Z"/></svg>;
    case 'sync':
      return <svg {...common}><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.2 6.2L4 8.4"/><path d="M5.5 15A7 7 0 0 0 17.8 17.8L20 15.6"/></svg>;
    default:
      return <svg {...common}><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 8v8l9 5 9-5V8"/></svg>;
  }
}

function NavButton({ item, active, onClick }) {
  return (
    <button className={`mobile-nav-btn ${item.center ? 'center-home' : ''} ${active ? 'active' : ''}`} onClick={onClick} type="button">
      <span><AppIcon name={item.icon} /></span>
      <strong>{item.label}</strong>
    </button>
  );
}

function MediaPreview({ item, className = '' }) {
  const animation = rewardAnimation(item);
  const image = rewardImage(item);
  const title = rewardTitle(item);

  if (animation && /\.(webm|mp4)(\?|$)/i.test(animation)) {
    return <video className={`gift-media ${className}`} src={animation} autoPlay loop muted playsInline />;
  }
  if (image) return <img className={`gift-media ${className}`} src={image} alt={title} />;
  if (item?.reward_type === 'coin') return <AppIcon name="coin" className={`gift-media-icon ${className}`} />;
  return <AppIcon name="gift" className={`gift-media-icon ${className}`} />;
}

function TextInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function SectionTitle({ title, description }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function Empty({ title = 'Bo‘sh', text = 'Hozircha ma’lumot yo‘q.' }) {
  return <div className="empty-state premium-card"><strong>{title}</strong><span>{text}</span></div>;
}

export default function WebAppClient() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Case Arena';
  const [tg, setTg] = useState(null);
  const [initData, setInitData] = useState('');
  const [tab, setTab] = useState('home');
  const [adminTab, setAdminTab] = useState('catalog');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [opening, setOpening] = useState(null);
  const [search, setSearch] = useState('');

  const [profile, setProfile] = useState(null);
  const [telegramUser, setTelegramUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cases, setCases] = useState([]);
  const [caseGifts, setCaseGifts] = useState([]);
  const [giftCatalog, setGiftCatalog] = useState([]);
  const [history, setHistory] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState([]);

  const [caseForm, setCaseForm] = useState(emptyCaseForm);
  const [caseImageFile, setCaseImageFile] = useState(null);
  const [caseGiftForm, setCaseGiftForm] = useState(emptyCaseGiftForm);
  const [userForm, setUserForm] = useState(emptyUserForm);

  const giftsByCase = useMemo(() => groupByCase(caseGifts), [caseGifts]);
  const activeCases = useMemo(() => cases.filter((item) => item.is_active !== false), [cases]);
  const selectedCaseRewards = caseGiftForm.case_id ? giftsByCase[caseGiftForm.case_id] || [] : [];
  const selectedCaseChanceSum = selectedCaseRewards.filter((item) => item.is_active !== false).reduce((sum, item) => sum + Number(item.chance || 0), 0);
  const catalogFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return giftCatalog;
    return giftCatalog.filter((gift) => `${gift.title || ''} ${gift.telegram_gift_id || ''}`.toLowerCase().includes(q));
  }, [giftCatalog, search]);

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
    if (!initData) throw new Error('Telegram initData topilmadi. Web App’ni bot tugmasidan oching.');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Server xatosi');
    return data;
  }, [initData]);

  const apiFormPost = useCallback(async (url, formData) => {
    if (!initData) throw new Error('Telegram initData topilmadi. Web App’ni bot tugmasidan oching.');
    formData.append('initData', initData);
    const response = await fetch(url, { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Server xatosi');
    return data;
  }, [initData]);

  const loadApp = useCallback(async () => {
    if (!initData) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/api/bootstrap');
      setProfile(data.user || null);
      setTelegramUser(data.telegramUser || null);
      setIsAdmin(Boolean(data.isAdmin));
      setCases(data.cases || []);
      setCaseGifts(data.gifts || data.caseGifts || []);
      setGiftCatalog(data.giftCatalog || []);
      setHistory(data.history || []);
      setWithdrawals(data.withdrawals || []);
      if ((data.cases || [])[0]?.id) {
        setCaseGiftForm((current) => ({ ...current, case_id: current.case_id || data.cases[0].id }));
      }
    } catch (err) {
      setError(err.message || 'Ma’lumot yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [apiPost, initData]);

  useEffect(() => {
    const app = window.Telegram?.WebApp;
    if (!app) {
      setLoading(false);
      setError('Bu sahifa Telegram ichida ochilmagan. Botdagi Web App tugmasidan oching.');
      return;
    }
    app.ready();
    app.expand();
    app.MainButton?.hide?.();
    app.BackButton?.hide?.();
    setTg(app);
    setInitData(app.initData || '');
    setTelegramUser(app.initDataUnsafe?.user || null);
  }, []);

  useEffect(() => { loadApp(); }, [loadApp]);

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

  async function uploadCaseImage() {
    if (!caseImageFile) return null;
    const formData = new FormData();
    formData.append('file', caseImageFile);
    const result = await apiFormPost('/api/admin/upload-case-image', formData);
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
    }, 'Case saqlandi ✅');
    setCaseForm(emptyCaseForm);
    setCaseImageFile(null);
    await loadApp();
  }

  async function updateCase(caseItem, updates) {
    await runAction(() => apiPost('/api/admin/case', { action: 'update', caseId: caseItem.id, ...updates }), 'Case yangilandi ✅');
    await loadApp();
  }

  async function deleteCase(caseId) {
    if (!confirm('Case o‘chirilsinmi?')) return;
    await runAction(() => apiPost('/api/admin/case', { action: 'delete', caseId }), 'Case o‘chirildi');
    await loadApp();
  }

  async function syncTelegramGifts() {
    const result = await runAction(() => apiPost('/api/admin/sync-telegram-gifts', {}), 'Telegram giftlar sync qilindi ✅');
    await loadApp();
    if (result?.count !== undefined) showToast(`${result.count} ta gift yangilandi`);
  }

  async function createCaseGift(event) {
    event.preventDefault();
    await runAction(async () => {
      const chance = cleanPercent(caseGiftForm.chance);
      const stock = Math.floor(Number(caseGiftForm.stock || 0));
      if (!caseGiftForm.case_id) throw new Error('Avval case tanlang.');
      if (chance <= 0) throw new Error('Tushish foizi 0 dan katta bo‘lsin.');
      if (stock <= 0) throw new Error('Stock kamida 1 bo‘lsin.');
      if (caseGiftForm.reward_type === 'nft' && !caseGiftForm.catalog_gift_id) throw new Error('Gift ro‘yxatdan bitta NFT gift tanlang.');
      if (caseGiftForm.reward_type === 'coin' && Number(caseGiftForm.coin_amount || 0) <= 0) throw new Error('Moneta miqdori 0 dan katta bo‘lsin.');
      return apiPost('/api/admin/case-gift', {
        action: 'create',
        ...caseGiftForm,
        chance,
        stock,
        coin_amount: Number(caseGiftForm.coin_amount || 0),
      });
    }, 'Case ichiga sovg‘a qo‘shildi ✅');
    setCaseGiftForm((current) => ({ ...emptyCaseGiftForm, case_id: current.case_id, reward_type: current.reward_type }));
    await loadApp();
  }

  async function updateCaseGift(item, updates) {
    await runAction(() => apiPost('/api/admin/case-gift', { action: 'update', caseGiftId: item.id, ...updates }), 'Sovg‘a sozlamasi yangilandi ✅');
    await loadApp();
  }

  async function deleteCaseGift(caseGiftId) {
    if (!confirm('Bu sovg‘a case ichidan olib tashlansinmi?')) return;
    await runAction(() => apiPost('/api/admin/case-gift', { action: 'delete', caseGiftId }), 'Case sovg‘asi olib tashlandi');
    await loadApp();
  }

  async function openCase(caseItem) {
    const rewards = (giftsByCase[caseItem.id] || []).filter(isReadyReward);
    if (!rewards.length) {
      setSelectedCase(caseItem);
      setError('Bu case ichida aktiv va stock bor sovg‘a yo‘q. Admin → Profile → Admin Panel → Case Rewards bo‘limidan NFT gift yoki moneta qo‘shing.');
      return;
    }
    if (Number(profile?.balance || 0) < Number(caseItem.price || 0)) {
      setError(`Balans yetarli emas. Kerak: ${formatPrice(caseItem.price)}`);
      return;
    }

    setSelectedCase(null);
    setOpening({ stage: 'rolling', caseItem, gift: null, reel: buildOpeningReel(rewards, null), spinKey: Date.now() });

    const result = await runAction(() => apiPost('/api/open-case', { caseId: caseItem.id }), '');
    if (!result?.gift) {
      setOpening(null);
      return;
    }

    const reel = buildOpeningReel(rewards, result.gift);
    setOpening({ stage: 'rolling', caseItem, gift: result.gift, reel, spinKey: Date.now(), balanceAfter: result.balanceAfter });
    tg?.HapticFeedback?.impactOccurred?.('medium');
    await delay(3600);
    setOpening({ stage: 'result', caseItem, gift: result.gift, reel, spinKey: Date.now(), balanceAfter: result.balanceAfter });
    setProfile((current) => ({ ...current, balance: result.balanceAfter ?? result.balance }));
    await loadApp();
  }

  async function createWithdraw(historyId) {
    await runAction(() => apiPost('/api/withdraw', { historyId }), 'Yechish so‘rovi yuborildi ✅');
    await loadApp();
  }

  async function loadAdminUsers() {
    const result = await runAction(() => apiPost('/api/admin/user', { action: 'list' }));
    if (result?.users) setAdminUsers(result.users);
  }

  async function addBalance(event) {
    event.preventDefault();
    await runAction(() => apiPost('/api/admin/user', { action: 'add_balance', ...userForm }), 'Balans yangilandi ✅');
    setUserForm(emptyUserForm);
    await loadAdminUsers();
  }

  async function toggleBan(user) {
    await runAction(() => apiPost('/api/admin/user', { action: 'ban', userId: user.id, is_banned: !user.is_banned }), 'User holati yangilandi ✅');
    await loadAdminUsers();
  }

  async function loadAdminWithdrawals() {
    const result = await runAction(() => apiPost('/api/admin/withdrawals', { action: 'list' }));
    if (result?.withdrawals) setAdminWithdrawals(result.withdrawals);
  }

  async function updateWithdrawal(requestId, status) {
    await runAction(() => apiPost('/api/admin/withdrawals', { action: 'update', requestId, status }), 'So‘rov yangilandi ✅');
    await loadAdminWithdrawals();
  }

  useEffect(() => {
    if (!isAdmin) return;
    if (adminTab === 'users') loadAdminUsers();
    if (adminTab === 'withdrawals') loadAdminWithdrawals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab, isAdmin]);

  if (loading) {
    return (
      <main className="center-screen casino-bg">
        <div className="loader-card premium-card">
          <div className="mini-orb" />
          <span className="eyebrow">Secure WebApp</span>
          <h2>Casino Arena yuklanmoqda</h2>
          <p>Telegram sessiya va Supabase ma’lumotlari tekshirilmoqda.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="casino-bg app-frame gift-catalog-app">
      {toast ? <div className="toast">{toast}</div> : null}
      {error ? <div className="global-alert">{error}</div> : null}
      {busy ? <div className="busy-indicator premium-card"><div className="mini-orb small" /><span>Amal bajarilmoqda...</span></div> : null}

      <section className="app-main full-width-main">
        <header className="mobile-top premium-card">
          <div className="brand compact">
            <div className="brand-mark"><AppIcon name="gift" /></div>
            <div><strong>{appName}</strong><span>Gift catalog system</span></div>
          </div>
          <div className="balance-pill"><span>Balans</span><strong>{formatPrice(profile?.balance)} <AppIcon name="coin" /></strong></div>
        </header>

        {tab === 'home' ? <HomeView telegramUser={telegramUser} profile={profile} cases={activeCases} giftsByCase={giftsByCase} history={history} onOpenCase={openCase} onSelectCase={setSelectedCase} /> : null}
        {tab === 'games' ? <GamesEmptyView /> : null}
        {tab === 'inventory' ? <InventoryView history={history} withdrawals={withdrawals} onWithdraw={createWithdraw} busy={busy} /> : null}
        {tab === 'history' ? <HistoryView history={history} /> : null}
        {tab === 'profile' ? <ProfileView telegramUser={telegramUser} profile={profile} isAdmin={isAdmin} totalOpenings={history.length} onOpenAdmin={() => setTab('admin')} /> : null}
        {tab === 'admin' && isAdmin ? (
          <AdminView
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            cases={cases}
            giftCatalog={giftCatalog}
            catalogFiltered={catalogFiltered}
            search={search}
            setSearch={setSearch}
            caseGifts={caseGifts}
            giftsByCase={giftsByCase}
            selectedCaseChanceSum={selectedCaseChanceSum}
            caseForm={caseForm}
            setCaseForm={setCaseForm}
            caseImageFile={caseImageFile}
            setCaseImageFile={setCaseImageFile}
            caseGiftForm={caseGiftForm}
            setCaseGiftForm={setCaseGiftForm}
            userForm={userForm}
            setUserForm={setUserForm}
            adminUsers={adminUsers}
            adminWithdrawals={adminWithdrawals}
            busy={busy}
            createCase={createCase}
            updateCase={updateCase}
            deleteCase={deleteCase}
            syncTelegramGifts={syncTelegramGifts}
            createCaseGift={createCaseGift}
            updateCaseGift={updateCaseGift}
            deleteCaseGift={deleteCaseGift}
            addBalance={addBalance}
            toggleBan={toggleBan}
            loadAdminUsers={loadAdminUsers}
            loadAdminWithdrawals={loadAdminWithdrawals}
            updateWithdrawal={updateWithdrawal}
          />
        ) : null}
      </section>

      <nav className="mobile-nav premium-card">
        {navItems.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />)}
      </nav>

      {selectedCase ? <CaseDetailsModal caseItem={selectedCase} gifts={giftsByCase[selectedCase.id] || []} onClose={() => setSelectedCase(null)} onOpen={() => openCase(selectedCase)} busy={busy} /> : null}
      {opening ? <OpeningModal opening={opening} onClose={() => setOpening(null)} onOpenAgain={() => openCase(opening.caseItem)} busy={busy} /> : null}
    </main>
  );
}

function HomeView({ telegramUser, profile, cases, giftsByCase, history, onOpenCase, onSelectCase }) {
  const live = history.slice(0, 8);
  return (
    <div className="mobile-casino-home screen-stack">
      <section className="casino-home-top">
        <div className="home-profile-balance">
          <div className="home-avatar-wrap"><div className="home-avatar">{telegramUser?.first_name?.[0] || 'U'}</div></div>
          <div><span>Your balance</span><strong><AppIcon name="coin" /> {formatPrice(profile?.balance)}</strong></div>
        </div>
        <button className="deposit-btn" type="button">Deposit</button>
      </section>

      <section className="live-strip premium-card">
        <div className="live-title"><span className="live-dot" /> Live</div>
        <div className="live-rewards-row">
          {live.length ? live.map((item) => <RewardMini key={item.id} item={item} />) : <span className="muted">Hozircha live drop yo‘q</span>}
        </div>
      </section>

      <SectionTitle title="Daily Box" description="Case’lar Home’da turadi. Games bo‘limi keyingi o‘yinlar uchun bo‘sh." />
      <div className="case-market-grid">
        {cases.map((caseItem) => (
          <button key={caseItem.id} type="button" className="market-case-card" onClick={() => onSelectCase(caseItem)} style={{ '--accent': caseItem.accent_color || '#22c55e' }}>
            <div className="market-case-media">
              {caseItem.badge_text ? <span className="market-case-badge" style={{ background: caseItem.badge_color || '#22c55e' }}>{caseItem.badge_text}</span> : null}
              {caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : <AppIcon name="gift" />}
            </div>
            <div className="market-case-footer">
              <strong>{caseItem.title}</strong>
              <span>{formatPrice(caseItem.price)} <AppIcon name="coin" /></span>
            </div>
            <div className="market-case-actions"><button type="button" onClick={(event) => { event.stopPropagation(); onOpenCase(caseItem); }}>Open</button><small>{(giftsByCase[caseItem.id] || []).length} rewards</small></div>
          </button>
        ))}
        {!cases.length ? <Empty title="Case yo‘q" text="Admin paneldan case qo‘shing." /> : null}
      </div>
    </div>
  );
}

function GamesEmptyView() {
  return (
    <div className="screen-stack">
      <SectionTitle title="Games" description="Bu bo‘lim keyingi Upgrade, Contract, PVP kabi o‘yinlar uchun tayyor turadi." />
      <div className="games-empty premium-card">
        <AppIcon name="games" />
        <h2>Games bo‘limi hozircha bo‘sh</h2>
        <p>Case’lar Home’da turadi. Keyin bu yerga Upgrade va Contract qo‘shamiz.</p>
      </div>
    </div>
  );
}

function RewardMini({ item }) {
  return <div className="reward-mini" style={{ background: rewardBackground(item) }}><MediaPreview item={item} /></div>;
}

function CaseDetailsModal({ caseItem, gifts, onClose, onOpen, busy }) {
  const ready = gifts.filter(isReadyReward);
  const totalChance = gifts.filter((item) => item.is_active !== false).reduce((sum, item) => sum + Number(item.chance || 0), 0);
  return (
    <div className="modal-backdrop">
      <div className="case-detail-modal premium-card">
        <button className="modal-close" onClick={onClose} type="button">×</button>
        <div className="case-hero" style={{ '--accent': caseItem.accent_color || '#22c55e' }}>
          {caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : <AppIcon name="gift" />}
          <div><span>{caseItem.badge_text || 'DAILY BOX'}</span><h2>{caseItem.title}</h2><strong>{formatPrice(caseItem.price)} <AppIcon name="coin" /></strong></div>
        </div>
        <div className="reel-preview premium-card">
          <div className="reel-pointer" />
          <div className="reel-static-row">
            {(ready.length ? ready : gifts).slice(0, 12).map((gift) => <RewardMini key={gift.id} item={gift} />)}
            {!gifts.length ? <span className="muted">Bu case ichida sovg‘a yo‘q</span> : null}
          </div>
        </div>
        <button className="open-box-btn" disabled={busy || !ready.length} onClick={onOpen} type="button"><AppIcon name="gift" /> Open Daily Box</button>
        <div className="case-stats-row"><span>Ready: {ready.length}</span><span>Chance: {totalChance}%</span></div>
        <div className="case-gift-grid">
          {gifts.map((gift) => <GiftCard key={gift.id} item={gift} admin={false} />)}
        </div>
      </div>
    </div>
  );
}

function OpeningModal({ opening, onClose, onOpenAgain, busy }) {
  const gift = opening.gift;
  return (
    <div className="modal-backdrop opening-backdrop">
      <div className={`opening-modal premium-card ${opening.stage === 'result' ? 'is-result' : ''}`}>
        {opening.stage !== 'result' ? (
          <>
            <span className="eyebrow">Opening</span>
            <h2>{opening.caseItem?.title}</h2>
            <div className="opening-reel-window">
              <div className="reel-pointer" />
              <div className="opening-reel-track" key={opening.spinKey}>
                {(opening.reel || []).map((item, index) => <div className="opening-reel-cell" key={`${item?.id || index}-${index}`}><RewardMini item={item} /></div>)}
              </div>
            </div>
          </>
        ) : (
          <>
            <span className="eyebrow">You won</span>
            <div className={`win-preview rarity-${rewardRarity(gift)}`} style={{ background: rewardBackground(gift) }}><MediaPreview item={gift} /></div>
            <h2>{rewardTitle(gift)}</h2>
            <p>{gift?.reward_type === 'coin' ? 'Moneta balansga qo‘shildi.' : 'NFT gift inventoryga tushdi.'}</p>
            <div className="modal-actions"><button className="primary-btn" disabled={busy} onClick={onOpenAgain} type="button">Open Again</button><button className="ghost-btn" onClick={onClose} type="button">Close</button></div>
          </>
        )}
      </div>
    </div>
  );
}

function GiftCard({ item, admin = false, actions = null }) {
  return (
    <div className={`catalog-gift-card rarity-${rewardRarity(item)} ${!isReadyReward(item) && admin ? 'not-ready' : ''}`}>
      <div className="catalog-gift-media" style={{ background: rewardBackground(item) }}><MediaPreview item={item} /></div>
      <div className="catalog-gift-info"><strong>{rewardTitle(item)}</strong><span>{item.reward_type === 'coin' ? item.coin_type : `${item.chance || 0}% · Stock ${item.stock || 0}`}</span></div>
      {admin ? <small className={isReadyReward(item) ? 'ready-badge ok' : 'ready-badge'}>{isReadyReward(item) ? 'Ready' : 'Fix needed'}</small> : null}
      {actions}
    </div>
  );
}

function InventoryView({ history, withdrawals, onWithdraw, busy }) {
  const inventory = history.filter((item) => item.reward_type !== 'coin');
  return (
    <div className="screen-stack">
      <SectionTitle title="Inventory" description="Yutgan NFT giftlaringiz." />
      <div className="inventory-grid">
        {inventory.map((item) => {
          const requested = withdrawals.some((w) => String(w.history_id || '') === String(item.id));
          return <GiftCard key={item.id} item={item} actions={<button className="ghost-btn small" disabled={busy || requested} onClick={() => onWithdraw(item.id)}>{requested ? 'Requested' : 'Withdraw'}</button>} />;
        })}
      </div>
      {!inventory.length ? <Empty title="Inventory bo‘sh" text="Case ochib NFT gift yuting." /> : null}
    </div>
  );
}

function HistoryView({ history }) {
  return (
    <div className="screen-stack">
      <SectionTitle title="History" description="Oxirgi case ochishlar." />
      <div className="history-list">
        {history.map((item) => <div className="history-row premium-card" key={item.id}><RewardMini item={item} /><div><strong>{rewardTitle(item)}</strong><span>{new Date(item.created_at).toLocaleString()}</span></div><b>{item.reward_type === 'coin' ? '+' : ''}{item.reward_value || item.coin_amount || ''}</b></div>)}
      </div>
      {!history.length ? <Empty title="History yo‘q" text="Hali case ochilmagan." /> : null}
    </div>
  );
}

function ProfileView({ telegramUser, profile, isAdmin, totalOpenings, onOpenAdmin }) {
  return (
    <div className="screen-stack">
      <section className="profile-card premium-card">
        <div className="profile-avatar">{telegramUser?.first_name?.[0] || 'U'}</div>
        <h2>{telegramUser?.first_name || 'Telegram user'}</h2>
        <p>{telegramUser?.username ? `@${telegramUser.username}` : `ID: ${telegramUser?.id || '-'}`}</p>
        <div className="profile-stats"><span>Balance <b>{formatPrice(profile?.balance)}</b></span><span>Opens <b>{totalOpenings}</b></span></div>
        {isAdmin ? <button className="primary-btn full" onClick={onOpenAdmin} type="button"><AppIcon name="admin" /> Admin Panel</button> : null}
      </section>
    </div>
  );
}

function AdminView(props) {
  const {
    adminTab, setAdminTab, cases, giftCatalog, catalogFiltered, search, setSearch,
    giftsByCase, selectedCaseChanceSum, caseForm, setCaseForm, caseImageFile, setCaseImageFile,
    caseGiftForm, setCaseGiftForm, userForm, setUserForm, adminUsers, adminWithdrawals, busy,
    createCase, updateCase, deleteCase, syncTelegramGifts, createCaseGift, updateCaseGift, deleteCaseGift,
    addBalance, toggleBan, loadAdminUsers, loadAdminWithdrawals, updateWithdrawal,
  } = props;

  const tabs = [
    { id: 'catalog', label: 'Gift Catalog' },
    { id: 'caseRewards', label: 'Case Rewards' },
    { id: 'cases', label: 'Cases' },
    { id: 'users', label: 'Users' },
    { id: 'withdrawals', label: 'Withdrawals' },
  ];

  const selectedCatalogGift = giftCatalog.find((gift) => String(gift.id) === String(caseGiftForm.catalog_gift_id));
  const selectedRewards = caseGiftForm.case_id ? (giftsByCase[caseGiftForm.case_id] || []) : [];

  return (
    <div className="screen-stack admin-screen">
      <SectionTitle title="Admin Panel" description="Gift bazasi bitta joyda. Case ichiga faqat moneta yoki NFT gift + tushish foizi qo‘shiladi." />
      <div className="admin-tabs premium-card">{tabs.map((item) => <button key={item.id} className={adminTab === item.id ? 'active' : ''} onClick={() => setAdminTab(item.id)}>{item.label}</button>)}</div>

      {adminTab === 'catalog' ? (
        <section className="screen-stack">
          <div className="premium-card catalog-toolbar">
            <div><h3>Telegram Gift Catalog</h3><p>Sync bosilganda Telegram giftlar bazaga tushadi: nomi, rasmi, animatsiyasi, Stars narxi.</p></div>
            <button className="primary-btn" disabled={busy} onClick={syncTelegramGifts}><AppIcon name="sync" /> Sync Telegram Gifts</button>
          </div>
          <TextInput label="Gift qidirish" value={search} onChange={setSearch} placeholder="lollipop, bear, gift id..." />
          <div className="catalog-grid">
            {catalogFiltered.map((gift) => <div className="telegram-gift-card premium-card" key={gift.id}><div className="telegram-gift-media" style={{ background: rewardBackground(gift) }}><MediaPreview item={gift} /></div><strong>{gift.title}</strong><span>⭐ {gift.star_price || gift.display_price || 0}</span></div>)}
          </div>
          {!giftCatalog.length ? <Empty title="Gift catalog bo‘sh" text="Sync Telegram Gifts tugmasini bosing." /> : null}
        </section>
      ) : null}

      {adminTab === 'caseRewards' ? (
        <section className="admin-workspace">
          <form className="manager-form premium-card" onSubmit={createCaseGift}>
            <SectionTitle title="Case ichiga sovg‘a qo‘shish" description="2 tur bor: moneta yoki Telegram NFT gift. NFT’da ro‘yxatdan tanlaysiz, faqat % va stock kiritasiz." />
            <SelectInput label="Case" value={caseGiftForm.case_id} onChange={(value) => setCaseGiftForm({ ...caseGiftForm, case_id: value })}>
              <option value="">Case tanlang</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </SelectInput>
            <div className="segmented-control">
              <button type="button" className={caseGiftForm.reward_type === 'coin' ? 'active' : ''} onClick={() => setCaseGiftForm({ ...caseGiftForm, reward_type: 'coin' })}>Moneta</button>
              <button type="button" className={caseGiftForm.reward_type === 'nft' ? 'active' : ''} onClick={() => setCaseGiftForm({ ...caseGiftForm, reward_type: 'nft' })}>NFT Gift</button>
            </div>

            {caseGiftForm.reward_type === 'coin' ? (
              <>
                <SelectInput label="Moneta turi" value={caseGiftForm.coin_type} onChange={(value) => setCaseGiftForm({ ...caseGiftForm, coin_type: value })}>
                  <option value="balance">Balance coin</option>
                  <option value="stars">Stars coin</option>
                </SelectInput>
                <TextInput label="Miqdor" type="number" value={caseGiftForm.coin_amount} onChange={(value) => setCaseGiftForm({ ...caseGiftForm, coin_amount: value })} placeholder="1" />
              </>
            ) : (
              <>
                <TextInput label="Gift qidirish" value={search} onChange={setSearch} placeholder="Telegram gift qidirish" />
                <div className="gift-picker-grid">
                  {catalogFiltered.map((gift) => (
                    <button type="button" key={gift.id} className={`gift-picker-card ${String(caseGiftForm.catalog_gift_id) === String(gift.id) ? 'active' : ''}`} onClick={() => setCaseGiftForm({ ...caseGiftForm, catalog_gift_id: gift.id })}>
                      <div style={{ background: rewardBackground(gift) }}><MediaPreview item={gift} /></div><strong>{gift.title}</strong><span>⭐ {gift.star_price || gift.display_price || 0}</span>
                    </button>
                  ))}
                </div>
                {selectedCatalogGift ? <div className="selected-gift-preview premium-card"><RewardMini item={selectedCatalogGift} /><div><strong>{selectedCatalogGift.title}</strong><span>Tanlangan gift</span></div></div> : null}
              </>
            )}

            <div className="two-fields">
              <TextInput label="Tushish foizi %" type="number" value={caseGiftForm.chance} onChange={(value) => setCaseGiftForm({ ...caseGiftForm, chance: value })} placeholder="10" />
              <TextInput label="Stock" type="number" value={caseGiftForm.stock} onChange={(value) => setCaseGiftForm({ ...caseGiftForm, stock: value })} placeholder="999" />
            </div>
            <div className="chance-helper"><span>Bu case aktiv chance: <b>{selectedCaseChanceSum}%</b></span><span>Qolgan limit: <b>{Math.max(0, 100 - selectedCaseChanceSum)}%</b></span></div>
            <div className="quick-chances">{[1, 3, 5, 10, 25, 50].map((value) => <button type="button" key={value} onClick={() => setCaseGiftForm({ ...caseGiftForm, chance: String(value) })}>{value}%</button>)}</div>
            <button className="primary-btn full" disabled={busy}>Casega qo‘shish</button>
          </form>

          <div className="manager-list">
            <SectionTitle title="Tanlangan case sovg‘alari" description="Bu yerda chance/stock tez tuzatiladi." />
            {selectedRewards.map((item) => <GiftCard key={item.id} item={item} admin actions={<div className="admin-actions"><button className="ghost-btn small" onClick={() => { const v = prompt('Yangi chance:', String(item.chance)); if (v !== null) updateCaseGift(item, { chance: Number(v) }); }}>%</button><button className="ghost-btn small" onClick={() => { const v = prompt('Yangi stock:', String(item.stock)); if (v !== null) updateCaseGift(item, { stock: Number(v) }); }}>Stock</button><button className="ghost-btn small" onClick={() => updateCaseGift(item, { is_active: !item.is_active })}>{item.is_active === false ? 'Aktiv' : 'Yashir'}</button><button className="danger-btn small" onClick={() => deleteCaseGift(item.id)}>O‘chir</button></div>} />)}
            {!selectedRewards.length ? <Empty title="Bu case bo‘sh" text="Chapdan moneta yoki NFT gift qo‘shing." /> : null}
          </div>
        </section>
      ) : null}

      {adminTab === 'cases' ? (
        <section className="admin-workspace">
          <form className="manager-form premium-card" onSubmit={createCase}>
            <SectionTitle title="Case qo‘shish" description="Case rasmi upload va market card style." />
            <label className="field-label"><span>Case rasmi</span><input type="file" accept="image/*" onChange={(event) => setCaseImageFile(event.target.files?.[0] || null)} /></label>
            <TextInput label="Case nomi" value={caseForm.title} onChange={(value) => setCaseForm({ ...caseForm, title: value })} placeholder="Farm" />
            <TextInput label="Narxi" type="number" value={caseForm.price} onChange={(value) => setCaseForm({ ...caseForm, price: value })} placeholder="3.5" />
            <TextInput label="Badge" value={caseForm.badge_text} onChange={(value) => setCaseForm({ ...caseForm, badge_text: value })} placeholder="LIMITED / HOT / NEW" />
            <TextInput label="Accent color" value={caseForm.accent_color} onChange={(value) => setCaseForm({ ...caseForm, accent_color: value })} placeholder="#22c55e" />
            <button className="primary-btn full" disabled={busy}>Case saqlash</button>
          </form>
          <div className="manager-list">{cases.map((item) => <div className="admin-item premium-card" key={item.id}><div className="admin-thumb">{item.image_url ? <img src={item.image_url} alt={item.title} /> : <AppIcon name="gift" />}</div><div><strong>{item.title}</strong><span>{formatPrice(item.price)} · {item.is_active ? 'Aktiv' : 'Yashirilgan'}</span></div><div className="admin-actions"><button className="ghost-btn small" onClick={() => updateCase(item, { is_active: !item.is_active })}>{item.is_active ? 'Yashir' : 'Aktiv'}</button><button className="danger-btn small" onClick={() => deleteCase(item.id)}>O‘chir</button></div></div>)}</div>
        </section>
      ) : null}

      {adminTab === 'users' ? (
        <section className="screen-stack">
          <form className="manager-form premium-card" onSubmit={addBalance}><SectionTitle title="User balans" description="User ID va miqdor kiriting." /><TextInput label="User ID" value={userForm.userId} onChange={(value) => setUserForm({ ...userForm, userId: value })} /><TextInput label="Miqdor" type="number" value={userForm.amount} onChange={(value) => setUserForm({ ...userForm, amount: value })} /><button className="primary-btn full">Qo‘shish / ayirish</button></form>
          <button className="ghost-btn" onClick={loadAdminUsers}>Userlarni yangilash</button>
          <div className="manager-list">{adminUsers.map((user) => <div className="admin-item premium-card" key={user.id}><div><strong>{user.first_name || user.id}</strong><span>@{user.username || '-'} · {formatPrice(user.balance)}</span></div><button className="ghost-btn small" onClick={() => toggleBan(user)}>{user.is_banned ? 'Unban' : 'Ban'}</button></div>)}</div>
        </section>
      ) : null}

      {adminTab === 'withdrawals' ? (
        <section className="screen-stack">
          <button className="ghost-btn" onClick={loadAdminWithdrawals}>Yangilash</button>
          <div className="manager-list">{adminWithdrawals.map((request) => <div className="admin-item premium-card" key={request.id}><div><strong>{request.reward_title || request.gift_title || request.gift_id || 'Withdraw'}</strong><span>User: {request.user_id} · {request.status}</span></div><div className="admin-actions"><button className="ghost-btn small" onClick={() => updateWithdrawal(request.id, 'approved')}>Qabul</button><button className="danger-btn small" onClick={() => updateWithdrawal(request.id, 'rejected')}>Rad</button></div></div>)}</div>
        </section>
      ) : null}
    </div>
  );
}
