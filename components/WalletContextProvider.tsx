'use client';

import { ReactNode } from 'react';
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';

interface WalletContextProviderProps {
  children: ReactNode;
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  return (
    <UnifiedWalletProvider
      wallets={[]} // Empty array = auto-detect all Wallet Standard wallets
      config={{
        autoConnect: true,
        env: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as any) || 'mainnet-beta',
        metadata: {
          name: 'Chad Mint',
          description: 'Professional Solana Token Minter',
          url: 'https://chadmint.fun',
          iconUrls: ['/Chadmint_logo1.png'],
        },
      }}
    >
      {children}
    </UnifiedWalletProvider>
  );
}