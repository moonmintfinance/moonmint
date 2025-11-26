'use client';

import { ReactNode } from 'react';
import { UnifiedWalletProvider, Adapter } from '@jup-ag/wallet-adapter';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
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

  return (
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
        // Hook up the notifications
        notificationCallback: WalletNotification,
        walletlistExplanation: {
          href: 'https://station.jup.ag/docs/wallet-list',
        },
        theme: 'dark',
        lang: 'en',
      }}
    >
      {children}
    </UnifiedWalletProvider>
  );
}