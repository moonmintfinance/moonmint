import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { RootProvider } from '@/components/RootProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Solana Token Minter - Professional Coin Creation Platform',
  description: 'Create and mint your own Solana tokens with atomic transaction security',
  icons: {
    icon: '/Chadmint_logo1.png',
    apple: '/Chadmint_logo1.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script
          src="https://plugin.jup.ag/plugin-v1.js"
          strategy="beforeInteractive"
          data-preload
          defer
        />
      </head>
      <body className={`${inter.className} bg-gradient-dark min-h-screen text-white`}>
        <RootProvider>{children}</RootProvider>
        <Analytics />
      </body>
    </html>
  );
}