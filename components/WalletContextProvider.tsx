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

  // ✅ FIX 1: Validate ProjectId before initialization
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
      // ✅ FIX 2: Only initialize if projectId exists
      projectId: projectId || 'default-project-id',
      features: {
        analytics: false,
        socials: ['google', 'x', 'apple'],
        email: false,
      },
      enableWallets: false,
    },
  });

  // ✅ FIX 3: Stabilize the wallets array - only include jupiterAdapter without filtering
  const wallets: Adapter[] = useMemo(() => {
    if (!jupiterAdapter) {
      return [];
    }
    // Don't filter - jupiterAdapter should always be included if it exists
    return [jupiterAdapter];
  }, [jupiterAdapter]);

  return (
    <UnifiedWalletProvider
      wallets={wallets}
      config={{
        // ✅ FIX 4: Disable autoConnect initially if wallet not ready
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