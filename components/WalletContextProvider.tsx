'use client';

import { ReactNode, useMemo } from 'react';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG } from '@/lib/constants';

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
    toast(`Disconnected from ${walletName}`, { icon: '👋' });
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
  const queryClient = useMemo(() => new QueryClient(), []);

  // ✅ Use the RPC proxy endpoint from constants
  const endpoint = useMemo(() => SOLANA_RPC_ENDPOINT, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint} config={{ commitment: TRANSACTION_CONFIG.COMMITMENT }}>
        <UnifiedWalletProvider
          wallets={[]} /* Pass an empty array to rely on standard detection */
          config={{
            autoConnect: true,
            env: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as WalletAdapterNetwork) || 'mainnet-beta',
            metadata: {
              name: 'ChadMint',
              description: 'ChadMint',
              url: 'https://chadmint.fun',
              iconUrls: ['https://chadmint.fun/Chadmint_logo1.png'],
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