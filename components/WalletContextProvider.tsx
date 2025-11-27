'use client';

import { ReactNode, useMemo } from 'react';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG, SOLANA_NETWORK } from '@/lib/constants';

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

  // ✅ Use the RPC proxy endpoint from constants (for HTTP requests)
  const endpoint = useMemo(() => SOLANA_RPC_ENDPOINT, []);

  // ✅ Determine correct WSS endpoint based on network
  // This prevents web3.js from trying to use wss://chadmint.fun/api/rpc which fails
  const wsEndpoint = useMemo(() => {
    if (SOLANA_NETWORK === 'devnet') return 'wss://api.devnet.solana.com';
    if (SOLANA_NETWORK === 'testnet') return 'wss://api.testnet.solana.com';
    return 'wss://api.mainnet-beta.solana.com';
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider
        endpoint={endpoint}
        config={{
          commitment: TRANSACTION_CONFIG.COMMITMENT as any,
          wsEndpoint: wsEndpoint, // ✅ Explicitly use public WSS to avoid proxy errors
        }}
      >
        <UnifiedWalletProvider
          wallets={[]} /* Pass an empty array to rely on standard detection */
          config={{
            autoConnect: true,
            env: (SOLANA_NETWORK as WalletAdapterNetwork),
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