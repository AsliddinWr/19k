# Telegram PHP Bot + Next.js Web App + Supabase

Bu loyiha Vercel’da ishlaydigan Telegram Web App uchun. PHP bot boshqa serverda qoladi.

## Vercel env

```env
TELEGRAM_BOT_TOKEN=BotFather token
NEXT_PUBLIC_APP_NAME=Case Web App
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=service_role yoki secret key
ADMIN_IDS=telegram_id
```

Env qo‘shilgandan keyin Vercel’da Redeploy qiling.

## PHP server env

```env
BOT_TOKEN=BotFather token
WEB_APP_URL=https://your-project.vercel.app/webapp
WEBHOOK_SECRET=long_random_secret
```

## Local

```bash
npm install
npm run dev
```

Web App haqiqiy ishlashi uchun sahifani Telegram botdagi `web_app` tugmasidan ochish kerak.
