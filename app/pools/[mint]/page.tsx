'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { PoolContent } from '@/components/Poolcontent';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function PoolPage() {
  const params = useParams();
  const mint = params.mint as string;
  const [isValidMint, setIsValidMint] = useState(true);

  // Basic mint validation (32-44 chars, valid Solana address format)
  useEffect(() => {
    if (mint && (mint.length < 32 || mint.length > 44)) {
      setIsValidMint(false);
    }
  }, [mint]);

  return (
    <main className="min-h-screen flex flex-col bg-gradient-dark">
      <Header />

      {!isValidMint ? (
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
      ) : (
        <PoolContent mint={mint} />
      )}

      <Footer />
    </main>
  );
}