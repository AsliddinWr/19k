# Telegram PHP Bot + Next.js Web App

Bu loyiha ikki qismdan iborat:

1. **PHP bot** — alohida serverda turadi va Telegram webhook shu serverga ulanadi.
2. **Next.js Web App** — Vercel’da turadi va Telegram ichida Mini App sifatida ochiladi.

## Arxitektura

```txt
Telegram Bot
   ↓ webhook
PHP server /webhook.php
   ↓ web_app button URL
Vercel Next.js /webapp
   ↓ tg.sendData(...)
Telegram → PHP serverga web_app_data qaytadi
```

## 1. Next.js Web App ni Vercel’ga deploy qilish

```bash
npm install
cp .env.example .env.local
npm run dev
```

Vercel env:

```env
TELEGRAM_BOT_TOKEN=123456789:AA....
NEXT_PUBLIC_APP_NAME=Case Web App
```

Deploy bo‘lgandan keyin Web App URL quyidagiga o‘xshaydi:

```txt
https://your-next-app.vercel.app/webapp
```

## 2. PHP botni serverga qo‘yish

`php-bot` papkasidagi fayllarni PHP serverga yuklang:

```txt
php-bot/config.php
php-bot/bot.php
php-bot/webhook.php
php-bot/set-webhook.php
php-bot/.env.example
```

`.env.example` faylini `.env` qilib o‘zgartiring:

```env
BOT_TOKEN=123456789:AA....
WEB_APP_URL=https://your-next-app.vercel.app/webapp
WEBHOOK_SECRET=change_me_to_a_long_random_secret
```

## 3. Telegram webhookni PHP serverga ulash

Brauzerda oching:

```txt
https://your-php-server.com/set-webhook.php?url=https://your-php-server.com/webhook.php
```

Yoki terminal orqali:

```bash
curl "https://your-php-server.com/set-webhook.php?url=https://your-php-server.com/webhook.php"
```

Muhim: webhook URL **Vercel emas**, PHP serverdagi `webhook.php` bo‘lishi kerak.

## 4. Bot ishlashi

Telegram botga `/start` yuboring. Bot quyidagi tugmani chiqaradi:

```txt
🚀 Web App ni ochish
```

Tugma bosilganda Vercel’dagi Next.js `/webapp` sahifasi ochiladi. Web App ichidagi “PHP botga yuborish” bosilganda ma’lumot Telegram orqali PHP serverdagi `webhook.php` fayliga `web_app_data` sifatida qaytadi.

## Muhim fayllar

### Next.js

- `app/webapp/page.jsx` — Telegram Mini App sahifasi
- `app/webapp/WebAppClient.jsx` — Telegram WebApp JS bilan ishlash
- `app/api/validate-telegram/route.js` — initData tekshirish
- `lib/verifyTelegram.js` — Telegram hash validatsiyasi

### PHP

- `php-bot/webhook.php` — Telegram webhook
- `php-bot/bot.php` — Telegram API helper va handlerlar
- `php-bot/config.php` — env config
- `php-bot/set-webhook.php` — webhook ulash helperi

## Keyingi ulash joyi

Sovg‘ani databasega saqlash kerak bo‘lsa, `php-bot/bot.php` ichidagi `handle_web_app_data()` funksiyasida shu qatorni toping:

```php
// Shu joyda databasega saqlashingiz mumkin.
```

Shu joyga MySQL `INSERT` yoziladi.
