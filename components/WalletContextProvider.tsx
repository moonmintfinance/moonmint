'use client';

import { ReactNode, useMemo } from 'react';
import { UnifiedWalletProvider, Adapter } from '@jup-ag/wallet-adapter';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
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
    toast.error(`Connection failed: ${error?.message || 'Unknown error'}`);
  },
  onNotInstalled: ({ walletName }: { walletName: string }) => {
    toast.error(`${walletName} is not installed!`);
  },
};

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  // 1. ADAPTERS: Explicitly initialize these for mobile deep-linking support
  const wallets: Adapter[] = useMemo(() => {
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter()
    ];
  }, []);

  const queryClient = useMemo(() => new QueryClient(), []);

  // 2. DYNAMIC ORIGIN: Fixes the "redirected then nothing happens" bug on mobile
  // Mobile wallets require the metadata URL to strictly match the current domain.
  const clusterDomain = useMemo(() =>
    typeof window !== 'undefined' ? window.location.origin : 'https://www.chadmint.fun',
  []);

  // 3. PROXY ENDPOINT: Point the app to your existing 'app/api/rpc/route.ts'
  // This ensures your app uses the Helius key on the backend and avoids public RPC rate limits.
  const endpoint = useMemo(() =>
    typeof window !== 'undefined' ? `${window.location.origin}/api/rpc` : 'https://api.mainnet-beta.solana.com',
  []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Wrap in ConnectionProvider to force the app to use your Proxy */}
      <ConnectionProvider endpoint={endpoint}>
        <UnifiedWalletProvider
          wallets={wallets}
          config={{
            autoConnect: true,
            env: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as WalletAdapterNetwork) || 'mainnet-beta',
            metadata: {
              name: 'ChadMint',
              description: 'ChadMint',
              url: clusterDomain, // Use the dynamic domain
              iconUrls: [`${clusterDomain}/Chadmint_logo1.png`],
            },
            notificationCallback: WalletNotification,
            theme: 'dark',
          }}
        >
          {children}
        </UnifiedWalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}