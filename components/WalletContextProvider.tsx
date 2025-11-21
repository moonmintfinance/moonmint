'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({
  children,
}) => {
  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as WalletAdapterNetwork) || WalletAdapterNetwork.Devnet;

  const endpoint = useMemo(
    () => {
      // If custom RPC URL is provided, use it
      if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
        return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
      }
      // Otherwise, use the secure RPC proxy with absolute URL
      if (typeof window !== 'undefined') {
        return `${window.location.origin}/api/rpc`;
      }
      // Fallback for SSR (shouldn't happen in practice)
      return 'http://localhost:3000/api/rpc';
    },
    []
  );

  // This gives us control and prevents unexpected initialization errors
  const wallets = useMemo(
    () => {
      try {
        return [
          new PhantomWalletAdapter(),
          new SolflareWalletAdapter(),
        ];
      } catch (error) {
        console.error('Error initializing wallet adapters:', error);
        return [];
      }
    },
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect={true}
        onError={(error) => {
          const errorMessage = error.error?.message || error.message || '';
          const errorName = error.name || '';

          // List of harmless errors that can be safely ignored
          const harmlessErrors = [
            'StreamMiddleware',
            'Unknown response id',
            'solflare-detect',
            'Unknown method',
            'WalletNotFoundError',
            'WalletNotSelectedError',
            'WalletTimeoutError',
            'WalletWindowBlockedError',
            'Eternl',
            'initEternlDomAPI',
            'domId',
            'href',
          ];

          // Check if this is a harmless error
          const isHarmless = harmlessErrors.some(
            (err) =>
              errorMessage.toLowerCase().includes(err.toLowerCase()) ||
              errorName.toLowerCase().includes(err.toLowerCase())
          );

          if (isHarmless) {
            return;
          }

          // Categorize and log actionable errors
          if (
            errorMessage.includes('User rejected') ||
            errorMessage.includes('User cancelled')
          ) {
            console.log('ℹ️  User cancelled wallet action');
          } else if (errorMessage.includes('not found')) {
            console.log('ℹ️  Wallet not installed');
          } else if (errorMessage.includes('Unexpected error')) {
            // Suppress overly verbose unexpected error logs
            console.debug('⚠️  Wallet adapter error (minor):', errorName);
          } else if (errorMessage.includes('connection')) {
            console.log('ℹ️  Wallet connection issue:', errorMessage);
          } else {
            // Only log genuinely important wallet errors
            console.error('❌ Wallet error:', error);
          }
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};