'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { JupiterPlugin } from '@/components/JupiterPlugin';

export default function TradePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />

      <div className="flex-grow container mx-auto px-6 pt-32 pb-20 max-w-2xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Trade Tokens
          </h1>
          <p className="text-gray-400">
            Instant swaps powered by Jupiter.
          </p>
        </div>

        {/* Main Interface */}
          <JupiterPlugin displayMode="integrated" />
      </div>

      <Footer />
    </main>
  );
}