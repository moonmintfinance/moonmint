'use client';

import { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';

/**
 * Wallet button wrapper that only renders after client hydration
 * This prevents hydration mismatches with the Solana wallet adapter
 *
 * ✅ FIXED: Better handling of connection state after wallet app switch
 */
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
      <div className="h-10 px-4 bg-dark-200 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-xs text-gray-400">Initializing wallet</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <WalletMultiButton />

      {/* Debug indicator (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute -bottom-6 left-0 text-xs text-gray-500 whitespace-nowrap">
          {connecting && '🔄 Connecting'}
          {connected && '✅ Connected'}
          {!connected && !connecting && '⭕ Disconnected'}
        </div>
      )}
    </div>
  );
}