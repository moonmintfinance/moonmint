'use client';

import { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';

export function WalletButton() {
  const [isMounted, setIsMounted] = useState(false);
  const { connected, connecting, publicKey } = useWallet();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Log connection state changes (for debugging)
  useEffect(() => {
    if (connected && publicKey) {
      console.log('✅ [WalletButton] Connected:', publicKey.toBase58());
    } else if (connecting) {
      console.log('🔄 [WalletButton] Connecting...');
    } else {
      console.log('❌ [WalletButton] Disconnected');
    }
  }, [connected, connecting, publicKey]);

  // Render loading state during SSR, render button after hydration
  if (!isMounted) {
    return (
      <div className="h-10 px-3 md:px-4 bg-dark-200 rounded-lg animate-pulse flex items-center justify-center max-w-[120px] md:max-w-none">
        <span className="text-xs text-gray-400 truncate">Initializing</span>
      </div>
    );
  }

  return (
    <div className="relative max-w-[120px] md:max-w-none">
      <style>{`
        .wallet-adapter-button {
          max-width: 120px !important;
          padding: 0.5rem 0.75rem !important;
          font-size: 0.875rem !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          border-radius: 0.5rem !important;
        }
        
        @media (min-width: 768px) {
          .wallet-adapter-button {
            max-width: none !important;
            padding: 0.5rem 1rem !important;
            font-size: 1rem !important;
          }
        }
      `}</style>
      <WalletMultiButton />
    </div>
  );
}