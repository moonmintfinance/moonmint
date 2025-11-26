'use client';

import { useEffect, useState } from 'react';
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletReady } from '@/components/WalletContextProvider';

export function WalletButton() {
  const [isMounted, setIsMounted] = useState(false);
  const { setShowModal } = useUnifiedWalletContext();
  const { connected, publicKey } = useWallet();
  const { isAdapterReady, adapterError } = useWalletReady();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Render loading state during SSR
  if (!isMounted) {
    return (
      <div className="h-10 px-3 md:px-4 bg-dark-200 rounded-lg animate-pulse flex items-center justify-center max-w-[120px] md:max-w-none">
        <span className="text-xs text-gray-400 truncate">Loading...</span>
      </div>
    );
  }

  // Show loading only briefly while adapter initializes (max 5s due to timeout)
  if (!isAdapterReady) {
    return (
      <div className="h-10 px-3 md:px-4 bg-dark-200 rounded-lg flex items-center justify-center max-w-[120px] md:max-w-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-400 truncate hidden md:inline">Connecting...</span>
        </div>
      </div>
    );
  }

  // If there was an error but we timed out, still show connect button
  const displayText = connected && publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : 'Connect Wallet';

  return (
    <button
      onClick={() => setShowModal(true)}
      className="h-10 px-3 md:px-4 bg-primary-500 hover:bg-primary-400 active:bg-primary-600 text-black font-bold rounded-lg transition-all text-xs md:text-sm whitespace-nowrap overflow-hidden max-w-[120px] md:max-w-none shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60"
    >
      {displayText}
    </button>
  );
}