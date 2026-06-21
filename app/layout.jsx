import './globals.css';

export const metadata = {
  title: 'Telegram PHP Bot + Next.js Web App',
  description: 'Telegram Mini App frontend for a PHP-hosted bot',
};

export default function RootLayout({ children }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
