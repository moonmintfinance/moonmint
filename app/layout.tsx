import type { Metadata } from 'next';
import { Michroma } from 'next/font/google';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { RootProvider } from '@/components/RootProvider';

const michroma = Michroma({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-michroma',
});

export const metadata: Metadata = {
  title: 'Chad Mint',
  description: 'Don\'t just launch. Dominate.',
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
      {/* 3. Apply the font class to the body */}
      <body className={`${michroma.className} bg-gradient-dark min-h-screen text-white`}>
        <RootProvider>{children}</RootProvider>
        <Analytics />
      </body>
    </html>
  );
}