'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function PoolPage() {
  const params = useParams();
  const mint = params.mint as string;
  const [isValidMint, setIsValidMint] = useState(true);

  // Basic mint validation (44 chars, base58)
  useEffect(() => {
    if (mint && (mint.length < 32 || mint.length > 44)) {
      setIsValidMint(false);
    }
  }, [mint]);

  if (!isValidMint) {
    return (
      <main className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-grow container mx-auto px-6 pt-24 pb-20 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">Invalid Token Address</h1>
            <p className="text-gray-400 mb-6">
              The token address provided is not valid. Please check the address and try again.
            </p>
            <a
              href="/"
              className="inline-block bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
            >
              Back to Home
            </a>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-gradient-dark">
      <Header />

      <div className="flex-grow container mx-auto px-6 pt-24 pb-20 max-w-7xl">
        {/* Token Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Token Trading</h1>
              <p className="text-gray-400 text-sm font-mono break-all">{mint}</p>
            </div>
            <a
              href={`https://solscan.io/token/${mint}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              View on Solscan ↗
            </a>
          </div>
        </div>

        {/* BirdEye Chart - Full Width */}
        <div className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 rounded-xl overflow-hidden h-[800px]">
          <iframe
            src={`https://birdeye.so/token/${mint}?chain=${
              process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
                ? 'solana'
                : process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet'
                  ? 'solana_devnet'
                  : 'solana_testnet'
            }`}
            className="w-full h-full border-0"
            title="BirdEye Token Chart"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      <Footer />
    </main>
  );
}