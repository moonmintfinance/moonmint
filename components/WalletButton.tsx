'use client';

import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import { useEffect, useState } from 'react';

export function WalletButton() {
  // Prevent hydration errors by rendering only on client
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-10 px-4 bg-dark-200 rounded-lg animate-pulse flex items-center justify-center min-w-[140px]">
        <span className="text-xs text-gray-400">Loading...</span>
      </div>
    );
  }

  // FIX: Cast to 'any' to resolve React 18 vs 19 type mismatch (TS2786)
  const WalletButtonComponent = UnifiedWalletButton as any;

  return (
    <div className="wallet-button-wrapper">
      <WalletButtonComponent
        buttonClassName="!bg-primary-500 hover:!bg-primary-400 !text-black !font-black !rounded-lg !h-10 !px-4 !text-sm !transition-all !shadow-lg !shadow-primary-500/40 hover:!shadow-primary-500/60"
        currentUserClassName="!bg-dark-200 !text-white !border !border-primary-500/30 hover:!border-primary-500"
      />
    </div>
  );
}