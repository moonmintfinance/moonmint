'use client';

import { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

/**
 * Wallet button wrapper that only renders after client hydration
 * This prevents hydration mismatches with the Solana wallet adapter
 */
export function WalletButton() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Render loading state during SSR, render button after hydration
  if (!isMounted) {
    return (
      <div className="h-10 px-4 bg-dark-200 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-xs text-gray-400">Initializing wallet</span>
      </div>
    );
  }

  return <WalletMultiButton />;
}