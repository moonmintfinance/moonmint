'use client';

import { ReactNode, useMemo } from 'react'; // Added useMemo
import { UnifiedWalletProvider, Adapter } from '@jup-ag/wallet-adapter';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
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
    toast.error(`Connection failed: ${error?.message || 'Unknown error'}`);
  },
  onNotInstalled: ({ walletName }: { walletName: string }) => {
    toast.error(`${walletName} is not installed!`);
  },
};

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const wallets: Adapter[] = [];

  // Create a client
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    // Wrap the UnifiedWalletProvider
    <QueryClientProvider client={queryClient}>
      <UnifiedWalletProvider
        wallets={wallets}
        config={{
          autoConnect: true,
          env: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as WalletAdapterNetwork) || 'mainnet-beta',
          metadata: {
            name: 'ChadMint',
            description: 'ChadMint',
            url: 'https://www.chadmint.fun',
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