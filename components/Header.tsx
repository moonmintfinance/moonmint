'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/WalletButton';

export function Header() {
  const { publicKey } = useWallet();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-dark-50/95 backdrop-blur-md border-b border-dark-200">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-lg font-semibold text-white">Moon Mint</h1>
              <p className="text-xs text-gray-400">Make the next moon shot</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <a
              href="/"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              Home
            </a>
            <a
              href="/#mint"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              Create Token
            </a>
            <a
              href="/referral"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              Referral Program
            </a>
          </nav>

          <div className="wallet-button-container">
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}