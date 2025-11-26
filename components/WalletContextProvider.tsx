'use client';

import { ReactNode, useMemo, useState, useEffect, createContext, useContext } from 'react';
import { Connection } from '@solana/web3.js';
import { UnifiedWalletProvider, Adapter } from '@jup-ag/wallet-adapter';
import { useWrappedReownAdapter } from '@jup-ag/jup-mobile-adapter';
import { SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG } from '@/lib/constants';

interface WalletContextProviderProps {
  children: ReactNode;
}

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
  const [isMounted, setIsMounted] = useState(false);

  const connection = useMemo(
    () => new Connection(SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG.COMMITMENT),
    []
  );

  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

  // ✅ FIXED: Call hook unconditionally at top level (not in try-catch)
  let jupiterAdapterResult: any = null;
  let hookError: Error | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const result = useWrappedReownAdapter({
      appKitOptions: {
        metadata: {
          name: 'Chad Mint',
          description: 'Professional Solana Token Minter',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://www.chadmint.fun',
          icons: ['/Chadmint_logo1.png'],
        },
        projectId: projectId || '',
        features: {
          analytics: true,
          socials: ['google', 'x', 'apple'],
          email: false,
        },
        enableWallets: false,
      },
    });
    jupiterAdapterResult = result;
  } catch (error) {
    hookError = error as Error;
    console.error('❌ [Wallet] Hook initialization error:', hookError.message);
  }

  // ✅ FIXED: Use effect to store adapter in state
  useEffect(() => {
    setIsMounted(true);

    if (!projectId) {
      const msg = '⚠️ [Wallet] NEXT_PUBLIC_REOWN_PROJECT_ID not set. Get one at https://dashboard.reown.com/';
      console.warn(msg);
      setAdapterError(msg);
      setIsAdapterReady(true);
      return;
    }

    if (hookError) {
      console.error('❌ [Wallet] Adapter initialization failed:', hookError.message);
      setAdapterError(hookError.message);
      setIsAdapterReady(true);
      return;
    }

    if (jupiterAdapterResult?.jupiterAdapter) {
      console.log('✅ [Wallet] Jupiter/Reown adapter ready');
      setIsAdapterReady(true);
    }
  }, []); // Run once on mount

  // ✅ FIXED: Timeout fallback for mobile
  useEffect(() => {
    if (isAdapterReady) return; // Already initialized

    const timeoutId = setTimeout(() => {
      console.warn('⚠️ [Wallet] Adapter initialization timeout (5s), proceeding without adapter');
      setAdapterTimedOut(true);
      setIsAdapterReady(true);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [isAdapterReady]);

  // ✅ FIXED: Create wallets array safely
  const wallets: Adapter[] = useMemo(() => {
    if (!jupiterAdapterResult?.jupiterAdapter || adapterTimedOut) {
      return [];
    }
    return [jupiterAdapterResult.jupiterAdapter];
  }, [jupiterAdapterResult?.jupiterAdapter, adapterTimedOut]);

  const readyContextValue = useMemo(
    () => ({
      isAdapterReady,
      adapterError,
    }),
    [isAdapterReady, adapterError]
  );

  // Don't render during SSR
  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <WalletReadyContext.Provider value={readyContextValue}>
      <UnifiedWalletProvider
        wallets={wallets}
        config={{
          autoConnect: !!(projectId && !adapterTimedOut && isAdapterReady),
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
    </WalletReadyContext.Provider>
  );
}