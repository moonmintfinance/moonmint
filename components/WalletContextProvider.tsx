'use client';

import { ReactNode, useMemo } from 'react';
import { Connection } from '@solana/web3.js';
import { UnifiedWalletProvider, Adapter } from '@jup-ag/wallet-adapter';
import { useWrappedReownAdapter } from '@jup-ag/jup-mobile-adapter';
import { SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG } from '@/lib/constants';

interface WalletContextProviderProps {
  children: ReactNode;
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const connection = useMemo(
    () => new Connection(SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG.COMMITMENT),
    []
  );

  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

  if (!projectId) {
    console.warn('⚠️ NEXT_PUBLIC_REOWN_PROJECT_ID is not set. Wallet initialization may fail.');
  }

  const { jupiterAdapter } = useWrappedReownAdapter({
    appKitOptions: {
      metadata: {
        name: 'Chad Mint',
        description: 'Professional Solana Token Minter',
        url: 'https://www.chadmint.fun',
        icons: ['/Chadmint_logo1.png'],
      },
      projectId: projectId || 'default-project-id',
      features: {
        analytics: true,
        socials: ['google', 'x', 'apple'],
        email: false,
      },
      enableWallets: false,
    },
  });

  const wallets: Adapter[] = useMemo(() => {
    if (!jupiterAdapter) {
      return [];
    }
    return [jupiterAdapter];
  }, [jupiterAdapter]);

  return (
    <UnifiedWalletProvider
      wallets={wallets}
      config={{
        autoConnect: projectId ? true : false,
        env: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as any) || 'mainnet-beta',
        metadata: {
          name: 'Chad Mint',
          description: 'Solana Token Minter',
          url: 'https://www.chadmint.fun',
          iconUrls: ['/Chadmint_logo1.png'],
        },
        theme: 'dark',
        lang: 'en',
      }}
    >
      {children}
    </UnifiedWalletProvider>
  );
}