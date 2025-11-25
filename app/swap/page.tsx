'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { JupiterPlugin } from '@/components/JupiterPlugin';

export default function TradePage() {
  return (
    <main className="min-h-screen flex flex-col relative">
      <Header />

      <div className="flex-grow container mx-auto px-6 pt-24 md:pt-28 pb-20 max-w-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Chad Mint Swap
          </h1>
          <p className="text-gray-400">
            Instantly swap any Solana token
          </p>
        </div>

        {/* Jupiter Widget Container with proper z-index context */}
        <div className="relative z-30 flex justify-center">
          <div className="w-full max-w-md relative">
            {/* Backdrop Shadow/Glow Effect */}
            <div className="absolute inset-0 -z-10 transform scale-105 bg-gradient-to-r from-primary-500/20 via-purple-500/20 to-pink-500/20 blur-3xl rounded-3xl" />

            {/* Main Interface */}
            <JupiterPlugin displayMode="integrated" />
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}