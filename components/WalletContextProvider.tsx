'use client';

import { ReactNode, useMemo } from 'react';
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
import { useWrappedReownAdapter } from '@jup-ag/jup-mobile-adapter';
import { Adapter } from '@solana/wallet-adapter-base';

interface WalletContextProviderProps {
  children: ReactNode;
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  // Initialize the Reown (WalletConnect) adapter
  const { jupiterAdapter } = useWrappedReownAdapter({
    appKitOptions: {
      metadata: {
        name: 'Chad Mint',
        description: 'Professional Solana Token Minter',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://www.chadmint.fun',
        icons: ['/Chadmint_logo1.png'],
      },
      projectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || '',
      features: {
        analytics: true,
        socials: ['google', 'x', 'apple'],
        email: false,
      },
      enableWallets: false,
    },
  });

  // Memoize the wallets list
  const wallets = useMemo(() => {
    if (jupiterAdapter) {
      return [jupiterAdapter as unknown as Adapter];
    }
    return [];
  }, [jupiterAdapter]);

  return (
    <UnifiedWalletProvider
      wallets={wallets}
      config={{
        autoConnect: true,
        env: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as any) || 'mainnet-beta',
        metadata: {
          name: 'Chad Mint',
          description: 'Professional Solana Token Minter',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://www.chadmint.fun',
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