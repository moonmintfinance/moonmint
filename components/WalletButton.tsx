'use client';

import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';

export function WalletButton() {
  const [isMounted, setIsMounted] = useState(false);
  const { setShowModal } = useUnifiedWalletContext();
  const { connected, publicKey, connecting, disconnecting } = useWallet();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-10 px-4 bg-dark-200 rounded-lg animate-pulse flex items-center">
        <span className="text-xs text-gray-400">Loading...</span>
      </div>
    );
  }

  const handleClick = () => {
    // The UnifiedWalletProvider's context provides this function
    if (setShowModal) {
      setShowModal(true);
    }
  };

  let displayText = 'Connect Wallet';

  if (connecting) displayText = 'Connecting...';
  else if (disconnecting) displayText = 'Disconnecting...';
  else if (connected && publicKey) {
    displayText = `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`;
  }

  return (
    <button
      onClick={handleClick}
      className={`h-10 px-4 text-black font-bold rounded-lg transition-all text-sm shadow-lg ${
        connected
          ? 'bg-green-500 hover:bg-green-600 shadow-green-500/40'
          : 'bg-primary-500 hover:bg-primary-400 shadow-primary-500/40'
      }`}
    >
      {displayText}
    </button>
  );
}