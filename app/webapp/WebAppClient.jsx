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

export default function WebAppClient() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Case Web App';

  const [tg, setTg] = useState(null);
  const [initData, setInitData] = useState('');
  const [tab, setTab] = useState('cases');
  const [adminTab, setAdminTab] = useState('cases');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [lastGift, setLastGift] = useState(null);

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

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  }, []);

  const apiPost = useCallback(async (url, payload = {}) => {
    if (!initData) {
      throw new Error('Telegram initData topilmadi. Web App’ni bot tugmasidan oching.');
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
      throw new Error('Telegram initData topilmadi. Web App’ni bot tugmasidan oching.');
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
    const result = await runAction(
      () => apiPost('/api/open-case', { caseId: caseItem.id }),
      'Case ochildi ✅'
    );

    if (result?.gift) {
      setLastGift(result.gift);
      setProfile((current) => ({ ...current, balance: result.balance }));
      await loadApp();
    }
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
    if (adminTab === 'users') loadAdminUsers();
    if (adminTab === 'withdrawals') loadAdminWithdrawals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab, isAdmin]);

  if (loading) {
    return (
      <main className="app-shell center-screen">
        <div className="loader-card">
          <div className="spinner" />
          <h2>Web App yuklanmoqda...</h2>
          <p>Telegram va Supabase tekshirilmoqda.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {toast ? <div className="toast">{toast}</div> : null}

      <header className="top-panel">
        <div>
          <div className="badge">{appName}</div>
          <h1>Case Web App</h1>
          <p>Case ochish, sovg‘a yutish va admin boshqaruvi.</p>
        </div>

        <div className="profile-card">
          <div className="avatar">{telegramUser?.first_name?.[0] || 'U'}</div>
          <div>
            <strong>{telegramUser?.first_name || 'Telegram user'}</strong>
            <span>{telegramUser?.username ? `@${telegramUser.username}` : `ID: ${telegramUser?.id || '-'}`}</span>
          </div>
        </div>
      </header>

      {error ? <div className="alert error">{error}</div> : null}
      {lastGift ? (
        <div className="win-modal">
          <div className="win-card">
            <div className="win-icon">🎉</div>
            <h2>{lastGift.title}</h2>
            <p>Tabriklaymiz, siz sovg‘a yutdingiz!</p>
            <button className="button" onClick={() => setLastGift(null)}>Yopish</button>
          </div>
        </div>
      ) : null}

      <section className="stats-grid">
        <div className="stat-card">
          <span>Balans</span>
          <strong>{money(profile?.balance)} so‘m</strong>
        </div>
        <div className="stat-card">
          <span>Case lar</span>
          <strong>{cases.length}</strong>
        </div>
        <div className="stat-card">
          <span>Yutuqlar</span>
          <strong>{history.length}</strong>
        </div>
      </section>

      <nav className="tabs">
        <button className={tab === 'cases' ? 'active' : ''} onClick={() => setTab('cases')}>🎁 Case lar</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>🏆 Yutuqlarim</button>
        <button className={tab === 'withdrawals' ? 'active' : ''} onClick={() => setTab('withdrawals')}>📤 Yechishlar</button>
        {isAdmin ? <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>👑 Admin</button> : null}
      </nav>

      {tab === 'cases' ? (
        <section className="content-grid">
          {cases.length === 0 ? <Empty text="Hali case qo‘shilmagan." /> : null}

          {cases.map((caseItem) => {
            const caseGifts = giftsByCase[caseItem.id] || [];
            return (
              <article className="case-card" key={caseItem.id}>
                <div className="case-image">
                  {caseItem.image_url ? <img src={caseItem.image_url} alt={caseItem.title} /> : <span>🎁</span>}
                </div>

                <div className="case-body">
                  <div className="case-head">
                    <div>
                      <h2>{caseItem.title}</h2>
                      <p>{caseItem.description || 'Maxsus sovg‘alar case ichida.'}</p>
                    </div>
                    <strong>{money(caseItem.price)} so‘m</strong>
                  </div>

                  <div className="gift-mini-list">
                    {caseGifts.slice(0, 5).map((gift) => (
                      <span key={gift.id}>{gift.title} · {gift.chance}%</span>
                    ))}
                    {caseGifts.length === 0 ? <span>Sovg‘a qo‘shilmagan</span> : null}
                  </div>

                  <button className="button wide" disabled={busy || caseGifts.length === 0} onClick={() => openCase(caseItem)}>
                    {busy ? 'Kutib turing...' : 'Case ochish'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {tab === 'history' ? (
        <section className="panel">
          <SectionTitle title="Yutgan sovg‘alarim" description="Oxirgi case ochishlaringiz tarixi." />
          <div className="list">
            {history.length === 0 ? <Empty text="Hali sovg‘a yutmadingiz." /> : null}
            {history.map((item) => {
              const gift = gifts.find((giftItem) => giftItem.id === item.gift_id);
              const caseItem = cases.find((caseValue) => caseValue.id === item.case_id);

              return (
                <div className="list-row" key={item.id}>
                  <div>
                    <strong>{gift?.title || 'Sovg‘a'}</strong>
                    <span>{caseItem?.title || 'Case'} · {new Date(item.created_at).toLocaleString('uz-UZ')}</span>
                  </div>
                  <button className="button small" disabled={busy || !item.gift_id} onClick={() => createWithdraw(item.gift_id)}>
                    Yechish
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === 'withdrawals' ? (
        <section className="panel">
          <SectionTitle title="Yechish so‘rovlari" description="Admin qabul qilishi yoki rad etishi mumkin." />
          <div className="list">
            {withdrawals.length === 0 ? <Empty text="Yechish so‘rovi yo‘q." /> : null}
            {withdrawals.map((item) => {
              const gift = gifts.find((giftItem) => giftItem.id === item.gift_id);

              return (
                <div className="list-row" key={item.id}>
                  <div>
                    <strong>{gift?.title || 'Sovg‘a'}</strong>
                    <span>{new Date(item.created_at).toLocaleString('uz-UZ')}</span>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === 'admin' && isAdmin ? (
        <section className="panel admin-panel">
          <SectionTitle title="Admin panel" description="Case, sovg‘a, user va yechish so‘rovlarini boshqarish." />

          <div className="subtabs">
            <button className={adminTab === 'cases' ? 'active' : ''} onClick={() => setAdminTab('cases')}>Case</button>
            <button className={adminTab === 'gifts' ? 'active' : ''} onClick={() => setAdminTab('gifts')}>Sovg‘a</button>
            <button className={adminTab === 'users' ? 'active' : ''} onClick={() => setAdminTab('users')}>User</button>
            <button className={adminTab === 'withdrawals' ? 'active' : ''} onClick={() => setAdminTab('withdrawals')}>Yechish</button>
          </div>

          {adminTab === 'cases' ? (
            <div className="admin-grid">
              <form className="card-form" onSubmit={createCase}>
                <h3>Case qo‘shish</h3>
                <Input label="Case nomi" value={caseForm.title} onChange={(value) => setCaseForm({ ...caseForm, title: value })} placeholder="Premium Case" />
                <Input label="Narxi" type="number" value={caseForm.price} onChange={(value) => setCaseForm({ ...caseForm, price: value })} placeholder="5000" />
                <FileInput label="Case rasmi" file={caseImageFile} onChange={setCaseImageFile} />
                <Textarea label="Izoh" value={caseForm.description} onChange={(value) => setCaseForm({ ...caseForm, description: value })} placeholder="Case haqida qisqa izoh" />
                <button className="button wide" disabled={busy}>Qo‘shish</button>
              </form>

              <div className="list admin-list">
                {cases.map((caseItem) => (
                  <div className="list-row stacked" key={caseItem.id}>
                    <div>
                      <strong>{caseItem.title}</strong>
                      <span>{money(caseItem.price)} so‘m · {(giftsByCase[caseItem.id] || []).length} sovg‘a</span>
                    </div>
                    <div className="row-actions">
                      <button className="button small secondary" onClick={() => {
                        const newPrice = prompt('Yangi narx:', String(caseItem.price || 0));
                        if (newPrice !== null) updateCase(caseItem, { price: newPrice });
                      }}>Narx</button>
                      <button className="button small secondary" onClick={() => updateCase(caseItem, { is_active: !caseItem.is_active })}>
                        {caseItem.is_active ? 'Yashirish' : 'Aktiv'}
                      </button>
                      <button className="button small danger" onClick={() => deleteCase(caseItem.id)}>O‘chirish</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {adminTab === 'gifts' ? (
            <div className="admin-grid">
              <form className="card-form" onSubmit={createGift}>
                <h3>Sovg‘a qo‘shish</h3>
                <Select label="Qaysi casega?" value={giftForm.case_id} onChange={(value) => setGiftForm({ ...giftForm, case_id: value })}>
                  <option value="">Case tanlang</option>
                  {cases.map((caseItem) => <option value={caseItem.id} key={caseItem.id}>{caseItem.title}</option>)}
                </Select>
                <Input label="Sovg‘a nomi" value={giftForm.title} onChange={(value) => setGiftForm({ ...giftForm, title: value })} placeholder="Telegram Premium 1 oy" />
                <Input label="Type" value={giftForm.type} onChange={(value) => setGiftForm({ ...giftForm, type: value })} placeholder="premium / stars / bonus" />
                <Input label="Value" value={giftForm.value} onChange={(value) => setGiftForm({ ...giftForm, value: value })} placeholder="100 Stars yoki 1 oy" />
                <Input label="Chance %" type="number" value={giftForm.chance} onChange={(value) => setGiftForm({ ...giftForm, chance: value })} placeholder="10" />
                <Input label="Stock" type="number" value={giftForm.stock} onChange={(value) => setGiftForm({ ...giftForm, stock: value })} placeholder="5" />
                <button className="button wide" disabled={busy}>Sovg‘a qo‘shish</button>
              </form>

              <div className="list admin-list">
                {gifts.map((gift) => (
                  <div className="list-row stacked" key={gift.id}>
                    <div>
                      <strong>{gift.title}</strong>
                      <span>{cases.find((item) => item.id === gift.case_id)?.title || 'Case'} · {gift.chance}% · Stock: {gift.stock}</span>
                    </div>
                    <div className="row-actions">
                      <button className="button small secondary" onClick={() => {
                        const newChance = prompt('Yangi chance:', String(gift.chance || 0));
                        if (newChance !== null) updateGift(gift, { chance: newChance });
                      }}>Chance</button>
                      <button className="button small secondary" onClick={() => {
                        const newStock = prompt('Yangi stock:', String(gift.stock || 0));
                        if (newStock !== null) updateGift(gift, { stock: newStock });
                      }}>Stock</button>
                      <button className="button small danger" onClick={() => deleteGift(gift.id)}>O‘chirish</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {adminTab === 'users' ? (
            <div className="admin-grid">
              <form className="card-form" onSubmit={addBalance}>
                <h3>Balans qo‘shish / ayirish</h3>
                <Input label="Telegram user ID" value={userForm.userId} onChange={(value) => setUserForm({ ...userForm, userId: value })} placeholder="123456789" />
                <Input label="Summa" type="number" value={userForm.amount} onChange={(value) => setUserForm({ ...userForm, amount: value })} placeholder="10000 yoki -5000" />
                <button className="button wide" disabled={busy}>Balansni yangilash</button>
                <button className="button wide secondary" type="button" onClick={loadAdminUsers}>Userlarni yuklash</button>
              </form>

              <div className="list admin-list">
                {adminUsers.map((user) => (
                  <div className="list-row stacked" key={user.id}>
                    <div>
                      <strong>{user.first_name || 'User'} {user.username ? `@${user.username}` : ''}</strong>
                      <span>ID: {user.id} · Balans: {money(user.balance)} · {user.is_banned ? 'Ban' : 'Aktiv'}</span>
                    </div>
                    <div className="row-actions">
                      <button className="button small secondary" onClick={() => setUserForm({ userId: String(user.id), amount: '' })}>Tanlash</button>
                      <button className="button small danger" onClick={() => toggleBan(user)}>{user.is_banned ? 'Unban' : 'Ban'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {adminTab === 'withdrawals' ? (
            <div className="list admin-list">
              <button className="button secondary" onClick={loadAdminWithdrawals}>So‘rovlarni yangilash</button>
              {adminWithdrawals.map((item) => (
                <div className="list-row stacked" key={item.id}>
                  <div>
                    <strong>{item.gifts?.title || 'Sovg‘a'}</strong>
                    <span>{item.users?.first_name || 'User'} {item.users?.username ? `@${item.users.username}` : ''} · ID: {item.users?.id}</span>
                    <span>{new Date(item.created_at).toLocaleString('uz-UZ')}</span>
                  </div>
                  <div className="row-actions">
                    <StatusBadge status={item.status} />
                    <button className="button small" onClick={() => updateWithdrawal(item.id, 'approved')}>Qabul</button>
                    <button className="button small danger" onClick={() => updateWithdrawal(item.id, 'rejected')}>Rad</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
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

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${status}`}>{status}</span>;
}

function FileInput({ label, file, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <small className="field-help">
        {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PNG, JPG, WEBP yoki GIF yuklash mumkin'}
      </small>
    </label>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea className="textarea" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}
