'use client';

import { ReactNode, useMemo } from 'react';
import { UnifiedWalletProvider, Adapter } from '@jup-ag/wallet-adapter';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface WalletContextProviderProps {
  children: ReactNode;
}

const WalletNotification = {
  onConnect: ({ walletName, shortAddress }: { walletName: string; shortAddress: string }) => {
    toast.success(`Connected to ${walletName} (${shortAddress})`);
  },
  onConnecting: ({ walletName }: { walletName: string }) => {
    toast(`Connecting to ${walletName}...`, {
      icon: '🔌',
      duration: 2000
    });
  },
  onDisconnect: ({ walletName }: { walletName: string }) => {
    toast(`Disconnected from ${walletName}`, { icon: 'ea' });
  },
  onError: ({ walletName, error }: { walletName: string; error: any }) => {
    console.error('Wallet error:', error);
    // Suppress common mobile "user rejected" errors to avoid spamming toast
    if (!error?.message?.includes('User rejected')) {
       toast.error(`Connection failed: ${error?.message || 'Unknown error'}`);
    }
  },
  onNotInstalled: ({ walletName }: { walletName: string }) => {
    toast.error(`${walletName} is not installed!`);
  },
};

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  // 1. ADAPTERS: Explicitly allow these for mobile deep-linking
  const wallets: Adapter[] = useMemo(() => {
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter()
    ];
  }, []);

  const queryClient = useMemo(() => new QueryClient(), []);

  // 2. DYNAMIC ORIGIN: Essential for the redirect handshake
  const clusterDomain = useMemo(() =>
    typeof window !== 'undefined' ? window.location.origin : 'https://www.chadmint.fun',
  []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* FIX: REMOVE ConnectionProvider.
        UnifiedWalletProvider manages the connection context internally.
        Nesting them causes state loss on mobile redirects.
      */}
      <UnifiedWalletProvider
        wallets={wallets}
        config={{
          autoConnect: true,
          env: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as WalletAdapterNetwork) || 'mainnet-beta',
          metadata: {
            name: 'ChadMint',
            description: 'ChadMint',
            url: clusterDomain,
            iconUrls: ['https://www.chadmint.fun/Chadmint_logo1.png'],
          },
          notificationCallback: WalletNotification,
          theme: 'dark',
        }}
      >
        {children}
      </UnifiedWalletProvider>
    </QueryClientProvider>
  );
}