'use client';

import { ReactNode, useMemo, useState, useEffect, createContext, useContext } from 'react';
import { Connection } from '@solana/web3.js';
import { UnifiedWalletProvider, Adapter } from '@jup-ag/wallet-adapter';
import { useWrappedReownAdapter } from '@jup-ag/jup-mobile-adapter';
import { SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG } from '@/lib/constants';

interface WalletContextProviderProps {
  children: ReactNode;
}

// Context to track if wallet adapter is ready
interface WalletReadyContextType {
  isAdapterReady: boolean;
  adapterError: string | null;
}

const WalletReadyContext = createContext<WalletReadyContextType>({
  isAdapterReady: false,
  adapterError: null,
});

export const useWalletReady = () => useContext(WalletReadyContext);

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const [isAdapterReady, setIsAdapterReady] = useState(false);
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [adapterTimedOut, setAdapterTimedOut] = useState(false);

  const connection = useMemo(
    () => new Connection(SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG.COMMITMENT),
    []
  );

  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

  if (!projectId) {
    console.warn('⚠️ NEXT_PUBLIC_REOWN_PROJECT_ID is not set. Wallet initialization may fail.');
  }

  // Wrap the adapter hook in a try-catch via error boundary pattern
  let jupiterAdapter: Adapter | null = null;
  let adapterHookError: Error | null = null;

  try {
    const result = useWrappedReownAdapter({
      appKitOptions: {
        metadata: {
          name: 'Chad Mint',
          description: 'Professional Solana Token Minter',
          url: 'https://www.chadmint.fun',
          icons: ['/Chadmint_logo1.png'],
        },
        projectId: projectId || 'default-project-id',
        features: {
          analytics: true,
          socials: ['google', 'x', 'apple'],
          email: false,
        },
        enableWallets: false,
      },
    });
    jupiterAdapter = result.jupiterAdapter;
  } catch (error) {
    console.error('❌ Error initializing Reown adapter:', error);
    adapterHookError = error as Error;
  }

  // Track adapter readiness with timeout for mobile
  useEffect(() => {
    // Set a timeout - if adapter isn't ready in 5 seconds on mobile, proceed anyway
    const timeoutId = setTimeout(() => {
      if (!isAdapterReady) {
        console.warn('⚠️ Wallet adapter initialization timed out, proceeding without adapter');
        setAdapterTimedOut(true);
        setIsAdapterReady(true); // Allow UI to proceed
      }
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [isAdapterReady]);

  // Update ready state when adapter becomes available
  useEffect(() => {
    if (jupiterAdapter) {
      console.log('✅ Jupiter/Reown adapter initialized');
      setIsAdapterReady(true);
    } else if (adapterHookError) {
      console.error('❌ Adapter hook error:', adapterHookError.message);
      setAdapterError(adapterHookError.message);
      setIsAdapterReady(true); // Still allow UI to render
    }
  }, [jupiterAdapter, adapterHookError]);

  const wallets: Adapter[] = useMemo(() => {
    if (!jupiterAdapter || adapterTimedOut) {
      return [];
    }
    return [jupiterAdapter];
  }, [jupiterAdapter, adapterTimedOut]);

  const readyContextValue = useMemo(() => ({
    isAdapterReady,
    adapterError,
  }), [isAdapterReady, adapterError]);

  return (
    <WalletReadyContext.Provider value={readyContextValue}>
      <UnifiedWalletProvider
        wallets={wallets}
        config={{
          autoConnect: projectId && !adapterTimedOut ? true : false,
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
    </WalletReadyContext.Provider>
  );
}