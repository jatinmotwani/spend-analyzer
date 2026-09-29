import type { Metadata, Viewport } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';
import { connection } from 'next/server';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Spend', template: '%s · Spend' },
  description: 'Say what you spent. See where it goes.',
  applicationName: 'Spend',
  appleWebApp: { capable: true, title: 'Spend', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: '/icons/apple-touch-icon.png',
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f3ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f0e' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render per request so every page carries the proxy's CSP nonce.
  await connection();
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
