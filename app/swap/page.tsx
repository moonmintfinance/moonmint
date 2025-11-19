'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { JupiterPlugin } from '@/components/JupiterPlugin';

export default function TradePage() {
  return (
    <main className="min-h-screen flex flex-col relative">
      <Header />

      {/* Reduced top padding from pt-32 to pt-24 (mobile) and md:pt-28 (desktop) */}
      <div className="flex-grow container mx-auto px-6 pt-24 md:pt-28 pb-20 max-w-2xl relative z-10">
        {/* Reduced bottom margin from mb-12 to mb-8 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Trade Tokens
          </h1>
          <p className="text-gray-400">
            Instant swaps powered by Jupiter.
          </p>
        </div>

        {/* Jupiter Widget Container with proper z-index context */}
        <div className="relative z-30 flex justify-center">
          <div className="w-full max-w-md">
            {/* Main Interface */}
            <JupiterPlugin displayMode="integrated" />
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}