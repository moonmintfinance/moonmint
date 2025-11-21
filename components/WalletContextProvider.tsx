'use client';

import React, { FC, ReactNode, useMemo, useEffect, useRef, useState } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet,
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

const AUTO_CONNECT_TIMEOUT_MS = 5000; // 5 second timeout for autoConnect

/**
 * Inner component that monitors auto-connect status
 * Uses wallet hooks to detect connection success/failure
 *
 * ✅ FIXED: Properly handles wallet app switching (Phantom, Solflare, etc.)
 */
const AutoConnectMonitor: FC<{ children: ReactNode }> = ({ children }) => {
  const { connected, connecting, publicKey } = useWallet();
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [isAutoConnectStuck, setIsAutoConnectStuck] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasConnectedRef = useRef(false);

  // Track if connection has ever succeeded in this session
  useEffect(() => {
    if (connected && publicKey) {
      hasConnectedRef.current = true;
      console.log('✅ Wallet connected:', publicKey.toBase58());

      // Clear timeout and stuck status when connected
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsAutoConnectStuck(false);
    }
  }, [connected, publicKey]);

  // Monitor auto-connect timeout - only for INITIAL auto-connect attempt
  useEffect(() => {
    // First time component mounts, wallet will attempt auto-connect
    if (!autoConnectAttempted && !hasConnectedRef.current) {
      setAutoConnectAttempted(true);
      console.log('🔄 Auto-connect attempt started...');

      // Set timeout for auto-connect attempt
      timeoutRef.current = setTimeout(() => {
        // Only show stuck warning if still connecting AND haven't successfully connected yet
        if (connecting && !hasConnectedRef.current) {
          console.warn('⚠️  Auto-connect timeout - wallet connection took too long');
          setIsAutoConnectStuck(true);
        }
      }, AUTO_CONNECT_TIMEOUT_MS);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [autoConnectAttempted, connecting]);

  return (
    <>
      {children}
      {isAutoConnectStuck && !connected && (
        <div className="fixed top-4 right-4 z-50 max-w-sm animate-fadeIn">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-yellow-500 text-lg">⚠️</div>
              <div className="flex-1">
                <div className="font-semibold text-yellow-400 text-sm">
                  Wallet Connection Timeout
                </div>
                <p className="text-xs text-yellow-300 mt-1 mb-3">
                  Auto-connect is taking too long. Click the wallet button to connect manually.
                </p>
                <button
                  onClick={() => setIsAutoConnectStuck(false)}
                  className="text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 px-3 py-1 rounded transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

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
        <WalletModalProvider>
          <AutoConnectMonitor>
            {children}
          </AutoConnectMonitor>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};