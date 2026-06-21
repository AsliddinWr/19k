'use client';

import { useEffect, useMemo, useState } from 'react';

const DEFAULT_FORM = {
  caseName: 'Premium Case',
  giftName: '',
  price: '',
  note: '',
};

export default function WebAppClient() {
  const [tg, setTg] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('Telegram tekshirilmoqda...');
  const [isValid, setIsValid] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [lastAction, setLastAction] = useState(null);

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Case Web App';

  useEffect(() => {
    const app = window.Telegram?.WebApp;

    if (!app) {
      setStatus('Bu sahifa Telegram ichida ochilmagan. Browserda demo rejim ishlaydi.');
      setIsValid(false);
      return;
    }

    app.ready();
    app.expand();
    app.BackButton.hide();
    app.MainButton.setText('PHP botga yuborish');
    app.MainButton.show();

    setTg(app);
    setUser(app.initDataUnsafe?.user || null);
  }, []);

  useEffect(() => {
    async function validate() {
      const initData = window.Telegram?.WebApp?.initData;

      if (!initData) return;

      const response = await fetch('/api/validate-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      const data = await response.json();
      setIsValid(Boolean(data.ok));
      setStatus(data.ok ? 'Telegram foydalanuvchisi tasdiqlandi.' : data.error || 'Tasdiqlashda xatolik bor.');
    }

    validate().catch(() => {
      setIsValid(false);
      setStatus('initData tekshirishda server xatoligi. Vercel env ni tekshiring.');
    });
  }, []);

  useEffect(() => {
    if (!tg) return;

    const onMainButtonClick = () => sendToPhpBot('gift_create');
    tg.MainButton.onClick(onMainButtonClick);

    return () => tg.MainButton.offClick(onMainButtonClick);
  }, [tg, form]);

  const preview = useMemo(() => ({
    type: 'gift_create',
    payload: form,
    user: user ? {
      id: user.id,
      first_name: user.first_name,
      username: user.username,
    } : null,
    created_at: new Date().toISOString(),
  }), [form, user]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function sendToPhpBot(type) {
    const payload = {
      ...preview,
      type,
    };

    setLastAction(payload);

    if (!tg) {
      setStatus('Demo rejim: Telegram WebApp topilmadi, ma’lumot botga yuborilmadi.');
      return;
    }

    tg.sendData(JSON.stringify(payload));
    tg.HapticFeedback?.notificationOccurred?.('success');
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="badge">{appName}</div>
        <h1>Web App panel tayyor ✅</h1>
        <p>
          Bu sahifa Vercel’da turadi. Quyidagi tugma bosilganda ma’lumot Telegram orqali PHP bot serveringizga
          <b> web_app_data</b> sifatida qaytadi.
        </p>

        <div className={isValid ? 'status' : 'status error'}>{status}</div>

        <div className="grid two">
          <div className="card">
            <div className="profile-row">
              <div className="avatar">{user?.first_name?.[0] || 'D'}</div>
              <div>
                <strong>{user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Demo user'}</strong>
                <p>{user?.username ? `@${user.username}` : 'username yo‘q'}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <strong>Connection</strong>
            <p>Bot: PHP server</p>
            <p>Web App: Vercel / Next.js</p>
          </div>
        </div>

        <div className="grid two">
          <div className="card">
            <h2>Sovg‘a qo‘shish demo</h2>
            <div className="form" style={{ marginTop: 14 }}>
              <label className="field">
                <span className="label">Qaysi case?</span>
                <select className="select" value={form.caseName} onChange={(event) => updateField('caseName', event.target.value)}>
                  <option>Premium Case</option>
                  <option>Gold Case</option>
                  <option>Simple Case</option>
                </select>
              </label>

              <label className="field">
                <span className="label">Sovg‘a nomi</span>
                <input
                  className="input"
                  value={form.giftName}
                  onChange={(event) => updateField('giftName', event.target.value)}
                  placeholder="Masalan: iPhone 15"
                />
              </label>

              <label className="field">
                <span className="label">Yechish narxi</span>
                <input
                  className="input"
                  type="number"
                  value={form.price}
                  onChange={(event) => updateField('price', event.target.value)}
                  placeholder="Masalan: 25000"
                />
              </label>

              <label className="field">
                <span className="label">Izoh</span>
                <textarea
                  className="textarea"
                  value={form.note}
                  onChange={(event) => updateField('note', event.target.value)}
                  placeholder="Ixtiyoriy izoh"
                />
              </label>

              <div className="actions">
                <button className="button" onClick={() => sendToPhpBot('gift_create')}>PHP botga yuborish</button>
                <button className="button secondary" onClick={() => setForm(DEFAULT_FORM)}>Tozalash</button>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Yuboriladigan JSON</h2>
            <p style={{ margin: '8px 0 12px' }}>PHP webhook shu ma’lumotni <b>web_app_data</b> ichidan oladi.</p>
            <pre className="preview">{JSON.stringify(lastAction || preview, null, 2)}</pre>
          </div>
        </div>
      </section>
    </main>
  );
}
