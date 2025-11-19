'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { JupiterPlugin } from '@/components/JupiterPlugin';

export default function TradePage() {
  return (
    <main className="min-h-screen flex flex-col relative">
      <Header />

      <div className="flex-grow container mx-auto px-6 pt-32 pb-20 max-w-2xl relative z-10">
        <div className="text-center mb-12">
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