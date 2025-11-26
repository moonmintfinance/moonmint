'use client';

import { ReactNode, useMemo } from 'react';
import { Connection } from '@solana/web3.js';
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
import { SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG } from '@/lib/constants';

interface WalletContextProviderProps {
  children: ReactNode;
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const connection = useMemo(
    () => new Connection(SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG.COMMITMENT),
    []
  );

  return (
    <UnifiedWalletProvider
      wallets={[]}
      config={{
        autoConnect: true,
        env: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as any) || 'mainnet-beta',
        metadata: {
          name: 'Chad Mint',
          description: 'Solana Token Minter',
          url: 'https://www.chadmint.fun',
          iconUrls: ['/Chadmint_logo1.png'],
        },
      }}
    >
      {children}
    </UnifiedWalletProvider>
  );
}