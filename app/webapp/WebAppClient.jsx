'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const emptyCaseForm = {
  title: '',
  description: '',
  price: '0',
  image_url: '',
};

const emptyGiftForm = {
  case_id: '',
  title: '',
  type: 'gift',
  value: '',
  chance: '10',
  stock: '1',
};

const emptyUserForm = {
  userId: '',
  amount: '',
};

function money(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('uz-UZ').format(number);
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

const hexLoaderCells = [
  ['center-gel', ''],
  ['c1', 'r1'], ['c2', 'r1'], ['c3', 'r1'], ['c4', 'r1'], ['c5', 'r1'], ['c6', 'r1'],
  ['c7', 'r2'], ['c8', 'r2'], ['c9', 'r2'], ['c10', 'r2'], ['c11', 'r2'], ['c12', 'r2'], ['c13', 'r2'], ['c14', 'r2'], ['c15', 'r2'], ['c16', 'r2'], ['c17', 'r2'], ['c18', 'r2'],
  ['c19', 'r3'], ['c20', 'r3'], ['c21', 'r3'], ['c22', 'r3'], ['c23', 'r3'], ['c24', 'r3'], ['c25', 'r3'], ['c26', 'r3'], ['c28', 'r3'], ['c29', 'r3'], ['c30', 'r3'], ['c31', 'r3'], ['c32', 'r3'], ['c33', 'r3'], ['c34', 'r3'], ['c35', 'r3'], ['c36', 'r3'], ['c37', 'r3'],
];

function HexLoader({ size = 'normal' }) {
  return (
    <div className={`casino-hex-loader ${size === 'small' ? 'is-small' : ''}`} aria-hidden="true">
      <div className="hex-glow" />
      <div className="socket">
        {hexLoaderCells.map(([cell, ring], index) => (
          <div key={`${cell}-${index}`} className={`gel ${cell} ${ring}`.trim()}>
            <div className="hex-brick h1" />
            <div className="hex-brick h2" />
            <div className="hex-brick h3" />
          </div>
        ))}
      </div>
    </div>
  );
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
  const [history, setHistory] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState([]);

  const [caseForm, setCaseForm] = useState(emptyCaseForm);
  const [caseImageFile, setCaseImageFile] = useState(null);
  const [giftForm, setGiftForm] = useState(emptyGiftForm);
  const [userForm, setUserForm] = useState(emptyUserForm);

  const giftsByCase = useMemo(() => groupGiftsByCase(gifts), [gifts]);
  const activeCases = useMemo(() => cases.filter((item) => item.is_active !== false), [cases]);
  const totalOpenings = history.length;
  const pendingWithdrawals = withdrawals.filter((item) => item.status === 'pending').length;
  const adminPendingWithdrawals = adminWithdrawals.filter((item) => item.status === 'pending').length;

  const navItems = useMemo(() => {
    const base = [
      { id: 'home', icon: '✦', label: 'Home' },
      { id: 'cases', icon: '🎁', label: 'Cases' },
      { id: 'inventory', icon: '💎', label: 'Inventory' },
      { id: 'profile', icon: '👤', label: 'Profile' },
    ];

    if (isAdmin) base.push({ id: 'admin', icon: '👑', label: 'Admin' });
    return base;
  }, [isAdmin]);

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
      setGifts(data.gifts || []);
      setHistory(data.history || []);
      setWithdrawals(data.withdrawals || []);

      if (data.cases?.[0]?.id && !giftForm.case_id) {
        setGiftForm((current) => ({ ...current, case_id: data.cases[0].id }));
      }
    } catch (err) {
      setError(err.message || 'Ma’lumot yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [apiPost, giftForm.case_id, initData]);

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
    if (caseGifts.length === 0) {
      setError('Bu case ichida aktiv sovg‘a yo‘q.');
      return;
    }

    setSelectedCase(null);
    setOpening({ stage: 'rolling', caseItem, gift: null });

    const result = await runAction(
      () => apiPost('/api/open-case', { caseId: caseItem.id }),
      ''
    );

    if (!result?.gift) {
      setOpening(null);
      return;
    }

    await delay(950);
    setOpening({ stage: 'result', caseItem, gift: result.gift });
    setProfile((current) => ({ ...current, balance: result.balance }));
    await loadApp();
  }

  async function createWithdraw(giftId) {
    await runAction(
      () => apiPost('/api/withdraw', { giftId }),
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

    await runAction(
      () => apiPost('/api/admin/gift', { action: 'create', ...giftForm }),
      'Sovg‘a qo‘shildi ✅'
    );

    setGiftForm((current) => ({ ...emptyGiftForm, case_id: current.case_id }));
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
            onGoCases={() => setTab('cases')}
            onGoInventory={() => setTab('inventory')}
            onOpenCase={openCase}
            busy={busy}
          />
        ) : null}

        {tab === 'cases' ? (
          <CasesView
            cases={activeCases}
            giftsByCase={giftsByCase}
            busy={busy}
            onOpenCase={openCase}
            onSelectCase={setSelectedCase}
          />
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
          />
        ) : null}

        {tab === 'admin' && isAdmin ? (
          <AdminView
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            cases={cases}
            gifts={gifts}
            giftsByCase={giftsByCase}
            adminUsers={adminUsers}
            adminWithdrawals={adminWithdrawals}
            caseForm={caseForm}
            setCaseForm={setCaseForm}
            caseImageFile={caseImageFile}
            setCaseImageFile={setCaseImageFile}
            giftForm={giftForm}
            setGiftForm={setGiftForm}
            userForm={userForm}
            setUserForm={setUserForm}
            busy={busy}
            createCase={createCase}
            updateCase={updateCase}
            deleteCase={deleteCase}
            createGift={createGift}
            updateGift={updateGift}
            deleteGift={deleteGift}
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
      <div className="brand-mark">◆</div>
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
    <button className={`${mobile ? 'mobile-nav-btn' : 'rail-nav-btn'} ${active ? 'active' : ''}`} onClick={onClick}>
      <span>{item.icon}</span>
      <strong>{item.label}</strong>
    </button>
  );
}

function HomeView({ telegramUser, profile, cases, giftsByCase, history, gifts, withdrawals, onGoCases, onGoInventory, onOpenCase, busy }) {
  const featuredCases = cases.slice(0, 3);
  const recentWins = history.slice(0, 5);

  return (
    <div className="screen-stack">
      <section className="hero-section premium-card">
        <div className="hero-copy">
          <div className="eyebrow">Live casino style · Telegram Web App</div>
          <h1>Case oching, sovg‘a yuting, yutuqlarni yechib oling.</h1>
          <p>Salom, {telegramUser?.first_name || 'user'}! Balansingizni tekshiring, premium case tanlang va real-time animatsiya bilan yutuqni oling.</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={onGoCases}>🎁 Case ochish</button>
            <button className="ghost-btn" onClick={onGoInventory}>💎 Inventory</button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-chip chip-a">💎</div>
          <div className="floating-chip chip-b">⭐</div>
          <div className="case-cube">
            <span>🎁</span>
          </div>
          <div className="jackpot-card">
            <span>Balance</span>
            <strong>{money(profile?.balance)} so‘m</strong>
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Balans" value={`${money(profile?.balance)} so‘m`} icon="💰" tone="gold" />
        <MetricCard label="Aktiv case" value={cases.length} icon="🎁" tone="cyan" />
        <MetricCard label="Yutuqlar" value={history.length} icon="🏆" tone="purple" />
        <MetricCard label="Yechishlar" value={withdrawals.length} icon="📤" tone="green" />
      </section>

      <section className="split-grid">
        <div className="premium-card section-card">
          <SectionTitle title="Featured cases" description="Eng so‘nggi va aktiv case lar." />
          <div className="compact-case-list">
            {featuredCases.length === 0 ? <Empty text="Hali case qo‘shilmagan." /> : null}
            {featuredCases.map((caseItem) => (
              <CompactCaseRow key={caseItem.id} caseItem={caseItem} gifts={giftsByCase[caseItem.id] || []} onOpen={onOpenCase} busy={busy} />
            ))}
          </div>
        </div>

        <div className="premium-card section-card">
          <SectionTitle title="Recent wins" description="Oxirgi ochilgan case natijalari." />
          <div className="activity-list">
            {recentWins.length === 0 ? <Empty text="Hali yutuqlar yo‘q." /> : null}
            {recentWins.map((item) => {
              const gift = gifts.find((giftItem) => giftItem.id === item.gift_id);
              return <ActivityRow key={item.id} icon="✨" title={gift?.title || 'Sovg‘a'} meta={new Date(item.created_at).toLocaleString('uz-UZ')} />;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function CasesView({ cases, giftsByCase, busy, onOpenCase, onSelectCase }) {
  return (
    <div className="screen-stack">
      <PageHeader eyebrow="Cases" title="Premium case collection" description="Har bir case ichida chance, stock va sovg‘alar boshqariladi." />
      {cases.length === 0 ? <Empty text="Hali aktiv case yo‘q." /> : null}
      <section className="case-grid-pro">
        {cases.map((caseItem) => (
          <CaseCard key={caseItem.id} caseItem={caseItem} gifts={giftsByCase[caseItem.id] || []} busy={busy} onOpen={onOpenCase} onDetails={onSelectCase} />
        ))}
      </section>
    </div>
  );
}

function CaseCard({ caseItem, gifts, busy, onOpen, onDetails }) {
  const bestGift = gifts.slice().sort((a, b) => Number(a.chance || 0) - Number(b.chance || 0))[0];

  return (
    <article className="case-card-pro premium-card">
      <div className="case-media-pro">
        {caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : <div className="case-placeholder">🎁</div>}
        <div className="case-price-badge">{money(caseItem.price)} so‘m</div>
        {bestGift ? <RarityBadge rarity={giftRarity(bestGift)} /> : null}
      </div>
      <div className="case-content-pro">
        <div>
          <h2>{caseItem.title}</h2>
          <p>{caseItem.description || 'Ichida premium sovg‘alar va bonuslar mavjud.'}</p>
        </div>
        <div className="gift-strip">
          {gifts.slice(0, 4).map((gift) => (
            <span className={`gift-chip ${giftRarity(gift)}`} key={gift.id}>{gift.title}</span>
          ))}
          {gifts.length === 0 ? <span className="gift-chip muted">Sovg‘a yo‘q</span> : null}
        </div>
        <div className="card-actions">
          <button className="primary-btn" disabled={busy || gifts.length === 0} onClick={() => onOpen(caseItem)}>Open now</button>
          <button className="ghost-btn" onClick={() => onDetails(caseItem)}>Details</button>
        </div>
      </div>
    </article>
  );
}

function CompactCaseRow({ caseItem, gifts, onOpen, busy }) {
  return (
    <div className="compact-case-row">
      <div className="mini-case-img">{caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : '🎁'}</div>
      <div>
        <strong>{caseItem.title}</strong>
        <span>{money(caseItem.price)} so‘m · {gifts.length} sovg‘a</span>
      </div>
      <button className="mini-open" disabled={busy || gifts.length === 0} onClick={() => onOpen(caseItem)}>Open</button>
    </div>
  );
}

function InventoryView({ history, gifts, cases, withdrawals, busy, onWithdraw }) {
  return (
    <div className="screen-stack">
      <PageHeader eyebrow="Inventory" title="Yutgan sovg‘alarim" description="Yutuqlar ro‘yxati va yechib olish so‘rovlari." />
      <section className="inventory-grid">
        {history.length === 0 ? <Empty text="Inventory hozircha bo‘sh. Case ochib birinchi sovg‘angizni oling." /> : null}
        {history.map((item) => {
          const gift = gifts.find((giftItem) => giftItem.id === item.gift_id);
          const caseItem = cases.find((caseValue) => caseValue.id === item.case_id);
          const request = withdrawals.find((withdraw) => withdraw.gift_id === item.gift_id);

          return (
            <article className={`inventory-card premium-card ${giftRarity(gift)}`} key={item.id}>
              <div className="inventory-icon">{giftIcon(gift)}</div>
              <div>
                <RarityBadge rarity={giftRarity(gift)} />
                <h3>{gift?.title || 'Sovg‘a'}</h3>
                <p>{caseItem?.title || 'Case'} · {new Date(item.created_at).toLocaleString('uz-UZ')}</p>
              </div>
              <div className="inventory-actions">
                {request ? <StatusBadge status={request.status} /> : null}
                <button className="primary-btn small" disabled={busy || !item.gift_id} onClick={() => onWithdraw(item.gift_id)}>Yechish</button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function ProfileView({ telegramUser, profile, totalOpenings, cases, history, gifts, withdrawals, pendingWithdrawals }) {
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
          <BalancePill balance={profile?.balance} />
        </div>

        <div className="metrics-grid nested">
          <MetricCard label="Total opens" value={totalOpenings} icon="🎲" tone="purple" />
          <MetricCard label="Wins" value={history.length} icon="🏆" tone="gold" />
          <MetricCard label="Cases" value={cases.length} icon="🎁" tone="cyan" />
          <MetricCard label="Pending" value={pendingWithdrawals} icon="⏳" tone="green" />
        </div>
      </section>

      <section className="split-grid">
        <div className="premium-card section-card">
          <SectionTitle title="So‘nggi yutuqlar" description="Oxirgi case ochishlaringiz." />
          <div className="activity-list">
            {history.slice(0, 6).map((item) => {
              const gift = gifts.find((giftItem) => giftItem.id === item.gift_id);
              return <ActivityRow key={item.id} icon={giftIcon(gift)} title={gift?.title || 'Sovg‘a'} meta={new Date(item.created_at).toLocaleString('uz-UZ')} />;
            })}
            {history.length === 0 ? <Empty text="Hali yutuq yo‘q." /> : null}
          </div>
        </div>

        <div className="premium-card section-card">
          <SectionTitle title="Yechish so‘rovlari" description="Admin tekshiradigan so‘rovlar." />
          <div className="activity-list">
            {withdrawals.map((item) => {
              const gift = gifts.find((giftItem) => giftItem.id === item.gift_id);
              return <ActivityRow key={item.id} icon="📤" title={gift?.title || 'Sovg‘a'} meta={<StatusBadge status={item.status} />} />;
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
    adminTab, setAdminTab, cases, gifts, giftsByCase, adminUsers, adminWithdrawals,
    caseForm, setCaseForm, caseImageFile, setCaseImageFile,
    giftForm, setGiftForm, userForm, setUserForm, busy,
    createCase, updateCase, deleteCase, createGift, updateGift, deleteGift,
    addBalance, toggleBan, loadAdminUsers, loadAdminWithdrawals, updateWithdrawal,
    adminPendingWithdrawals,
  } = props;

  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'cases', label: 'Cases' },
    { id: 'gifts', label: 'Gifts' },
    { id: 'users', label: 'Users' },
    { id: 'withdrawals', label: 'Withdrawals' },
  ];

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
            <MetricCard label="All cases" value={cases.length} icon="🎁" tone="cyan" />
            <MetricCard label="All gifts" value={gifts.length} icon="💎" tone="purple" />
            <MetricCard label="Users" value={adminUsers.length} icon="👥" tone="green" />
            <MetricCard label="Pending" value={adminPendingWithdrawals} icon="⏳" tone="gold" />
          </div>
          <div className="split-grid">
            <div className="premium-card section-card">
              <SectionTitle title="Quick actions" description="Eng ko‘p ishlatiladigan admin amallar." />
              <div className="quick-actions">
                <button className="primary-btn" onClick={() => setAdminTab('cases')}>+ Case qo‘shish</button>
                <button className="ghost-btn" onClick={() => setAdminTab('gifts')}>+ Sovg‘a qo‘shish</button>
                <button className="ghost-btn" onClick={() => setAdminTab('withdrawals')}>Yechishlarni ko‘rish</button>
              </div>
            </div>
            <div className="premium-card section-card">
              <SectionTitle title="System status" description="Web App holati." />
              <div className="system-list">
                <ActivityRow icon="🟢" title="Telegram auth" meta="Active" />
                <ActivityRow icon="🟢" title="Supabase database" meta="Connected" />
                <ActivityRow icon="🟢" title="Image upload" meta="Storage ready" />
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
            <Input label="Narxi" type="number" value={caseForm.price} onChange={(value) => setCaseForm({ ...caseForm, price: value })} placeholder="5000" />
            <Textarea label="Izoh" value={caseForm.description} onChange={(value) => setCaseForm({ ...caseForm, description: value })} placeholder="Case haqida qisqa izoh" />
            <button className="primary-btn full" disabled={busy}>Case saqlash</button>
          </form>

          <div className="manager-list">
            {cases.map((caseItem) => (
              <div className="admin-item premium-card" key={caseItem.id}>
                <div className="admin-thumb">{caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : '🎁'}</div>
                <div className="admin-item-main">
                  <strong>{caseItem.title}</strong>
                  <span>{money(caseItem.price)} so‘m · {(giftsByCase[caseItem.id] || []).length} sovg‘a · {caseItem.is_active ? 'Aktiv' : 'Yashirilgan'}</span>
                </div>
                <div className="admin-actions">
                  <button className="ghost-btn small" onClick={() => {
                    const newPrice = prompt('Yangi narx:', String(caseItem.price || 0));
                    if (newPrice !== null) updateCase(caseItem, { price: newPrice });
                  }}>Narx</button>
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
        <div className="admin-workspace">
          <form className="manager-form premium-card" onSubmit={createGift}>
            <SectionTitle title="Sovg‘a qo‘shish" description="Sovg‘ani qaysi casega tushishini, chance va stock bilan belgilang." />
            <Select label="Qaysi casega?" value={giftForm.case_id} onChange={(value) => setGiftForm({ ...giftForm, case_id: value })}>
              <option value="">Case tanlang</option>
              {cases.map((caseItem) => <option value={caseItem.id} key={caseItem.id}>{caseItem.title}</option>)}
            </Select>
            <Input label="Sovg‘a nomi" value={giftForm.title} onChange={(value) => setGiftForm({ ...giftForm, title: value })} placeholder="Telegram Premium 1 oy" />
            <Input label="Type" value={giftForm.type} onChange={(value) => setGiftForm({ ...giftForm, type: value })} placeholder="premium / stars / bonus" />
            <Input label="Value" value={giftForm.value} onChange={(value) => setGiftForm({ ...giftForm, value })} placeholder="100 Stars yoki 1 oy" />
            <div className="two-fields">
              <Input label="Chance %" type="number" value={giftForm.chance} onChange={(value) => setGiftForm({ ...giftForm, chance: value })} placeholder="10" />
              <Input label="Stock" type="number" value={giftForm.stock} onChange={(value) => setGiftForm({ ...giftForm, stock: value })} placeholder="5" />
            </div>
            <button className="primary-btn full" disabled={busy}>Sovg‘a saqlash</button>
          </form>

          <div className="manager-list">
            {gifts.map((gift) => (
              <div className={`admin-item premium-card rarity-left ${giftRarity(gift)}`} key={gift.id}>
                <div className="gift-symbol">{giftIcon(gift)}</div>
                <div className="admin-item-main">
                  <strong>{gift.title}</strong>
                  <span>{cases.find((item) => item.id === gift.case_id)?.title || 'Case'} · {gift.chance}% · Stock: {gift.stock}</span>
                </div>
                <RarityBadge rarity={giftRarity(gift)} />
                <div className="admin-actions">
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
            {gifts.length === 0 ? <Empty text="Sovg‘a yo‘q." /> : null}
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
                <div className="gift-symbol">📤</div>
                <div className="admin-item-main">
                  <strong>{item.gifts?.title || 'Sovg‘a'}</strong>
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
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <article className="case-modal premium-card" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        <div className="modal-case-hero">
          {caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : <span>🎁</span>}
        </div>
        <div className="modal-content">
          <div>
            <div className="eyebrow">Case details</div>
            <h2>{caseItem.title}</h2>
            <p>{caseItem.description || 'Ichidagi sovg‘alar chance bo‘yicha tanlanadi.'}</p>
          </div>
          <div className="modal-price">{money(caseItem.price)} so‘m</div>
          <div className="gift-detail-grid">
            {gifts.map((gift) => (
              <div className={`gift-detail ${giftRarity(gift)}`} key={gift.id}>
                <span>{giftIcon(gift)}</span>
                <strong>{gift.title}</strong>
                <small>{gift.chance}% · Stock: {gift.stock}</small>
              </div>
            ))}
            {gifts.length === 0 ? <Empty text="Bu casega hali sovg‘a qo‘shilmagan." /> : null}
          </div>
          <button className="primary-btn full" disabled={busy || gifts.length === 0} onClick={onOpen}>Open case</button>
        </div>
      </article>
    </div>
  );
}

function OpeningModal({ opening, gifts, onClose, onOpenAgain, busy }) {
  const { stage, gift, caseItem } = opening;

  return (
    <div className="modal-backdrop opening-backdrop">
      <article className="opening-modal premium-card">
        {stage === 'rolling' ? (
          <>
            <div className="eyebrow">Opening {caseItem.title}</div>
            <h2>Omad g‘ildiragi aylanmoqda...</h2>
            <div className="reel-window">
              <div className="reel-track">
                {[...gifts, ...gifts, ...gifts, ...gifts].slice(0, 20).map((item, index) => (
                  <div className={`reel-item ${giftRarity(item)}`} key={`${item.id}-${index}`}>{giftIcon(item)}</div>
                ))}
              </div>
              <div className="reel-pointer" />
            </div>
            <p>Natija hozir chiqadi. Iltimos kuting.</p>
          </>
        ) : (
          <>
            <button className="close-btn" onClick={onClose}>×</button>
            <div className={`win-result ${giftRarity(gift)}`}>
              <div className="win-spark">✦</div>
              <div className="win-gift">{giftIcon(gift)}</div>
              <RarityBadge rarity={giftRarity(gift)} />
              <h2>{gift?.title}</h2>
              <p>Tabriklaymiz! Sovg‘a inventory’ga tushdi.</p>
              <div className="win-actions">
                <button className="primary-btn" disabled={busy} onClick={onOpenAgain}>Yana ochish</button>
                <button className="ghost-btn" onClick={onClose}>Yopish</button>
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
      <span>{icon}</span>
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
      <div className="activity-icon">{icon}</div>
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
  if (text.includes('premium')) return '⭐';
  if (text.includes('star')) return '🌟';
  if (text.includes('bonus') || text.includes('balans')) return '💰';
  if (text.includes('promocode') || text.includes('promo')) return '🎟️';
  if (text.includes('nothing') || text.includes('bo‘sh') || text.includes('bosh')) return '▫️';
  return '💎';
}

function FileInput({ label, file, onChange }) {
  const previewUrl = file ? URL.createObjectURL(file) : '';

  return (
    <label className="upload-field">
      <span>{label}</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <div className="upload-box">
        {previewUrl ? <img src={previewUrl} alt="Preview" /> : <strong>Rasm tanlash</strong>}
        <small>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PNG, JPG, WEBP yoki GIF · max 4MB'}</small>
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
