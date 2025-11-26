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
  debugInfo?: {
    projectId: string | null;
    adapterTimedOut: boolean;
    isMounted: boolean;
    hookError: Error | null;
    jupiterAdapterReady: boolean;
    initStartTime: number;
    initDuration: number;
  };
}

const WalletReadyContext = createContext<WalletReadyContextType>({
  isAdapterReady: false,
  adapterError: null,
});

export const useWalletReady = () => useContext(WalletReadyContext);

const LOG_PREFIX = '🪙 [WALLET]';
const INIT_START_TIME = Date.now();

function log(stage: string, message: string, data?: any) {
  const elapsed = Date.now() - INIT_START_TIME;
  const timestamp = new Date().toLocaleTimeString();

  if (data) {
    console.log(`${LOG_PREFIX} [${timestamp}] +${elapsed}ms - ${stage}: ${message}`, data);
  } else {
    console.log(`${LOG_PREFIX} [${timestamp}] +${elapsed}ms - ${stage}: ${message}`);
  }
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const [isAdapterReady, setIsAdapterReady] = useState(false);
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [adapterTimedOut, setAdapterTimedOut] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [hookError, setHookError] = useState<Error | null>(null);
  const [jupiterAdapterReady, setJupiterAdapterReady] = useState(false);
  const [initDuration, setInitDuration] = useState(0);

  log('INIT', 'WalletContextProvider component rendering');

  const connection = useMemo(() => {
    log('CONNECTION', 'Creating Solana connection', { endpoint: SOLANA_RPC_ENDPOINT });
    return new Connection(SOLANA_RPC_ENDPOINT, TRANSACTION_CONFIG.COMMITMENT);
  }, []);

  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

  log('PROJECT_ID', projectId ? 'Project ID is SET' : 'PROJECT ID IS MISSING!', {
    projectId: projectId?.slice(0, 10) + '...' || 'UNDEFINED',
    env: process.env.NEXT_PUBLIC_SOLANA_NETWORK
  });

  // ✅ DIAGNOSTIC: Track hook initialization
  log('HOOK_INIT', 'Calling useWrappedReownAdapter hook...');

  let jupiterAdapterResult: any = null;
  let adapterHookError: Error | null = null;

  try {
    log('HOOK_CALL', 'useWrappedReownAdapter invoked');

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

    log('HOOK_SUCCESS', 'useWrappedReownAdapter returned result', {
      hasJupiterAdapter: !!result?.jupiterAdapter,
      resultKeys: result ? Object.keys(result) : []
    });

    jupiterAdapterResult = result;
  } catch (error) {
    adapterHookError = error as Error;
    log('HOOK_ERROR', '❌ Hook initialization FAILED', {
      error: adapterHookError.message,
      stack: adapterHookError.stack?.split('\n').slice(0, 3).join('\n')
    });
  }

  // ✅ DIAGNOSTIC: Track mount effect
  useEffect(() => {
    log('MOUNT_EFFECT', 'Mount effect running');
    setIsMounted(true);

    const duration = Date.now() - INIT_START_TIME;
    setInitDuration(duration);

    log('MOUNT_EFFECT', 'isMounted set to true', { totalDurationMs: duration });

    // Check project ID
    if (!projectId) {
      const msg = '⚠️ NEXT_PUBLIC_REOWN_PROJECT_ID not set. Get one at https://dashboard.reown.com/';
      log('PROJECT_ID_CHECK', '❌ MISSING PROJECT ID', { message: msg });
      setAdapterError(msg);
      setIsAdapterReady(true);
      return;
    }

    log('PROJECT_ID_CHECK', '✅ Project ID found', { projectId: projectId.slice(0, 10) + '...' });

    // Check hook error
    if (adapterHookError) {
      log('HOOK_ERROR_CHECK', '❌ Hook had error', { error: adapterHookError.message });
      setHookError(adapterHookError);
      setAdapterError(adapterHookError.message);
      setIsAdapterReady(true);
      return;
    }

    // Check adapter result
    if (jupiterAdapterResult?.jupiterAdapter) {
      log('ADAPTER_READY', '✅ Jupiter adapter is READY', {
        adapterName: jupiterAdapterResult.jupiterAdapter.name,
        hasIcon: !!jupiterAdapterResult.jupiterAdapter.icon
      });
      setJupiterAdapterReady(true);
      setIsAdapterReady(true);
      return;
    }

    log('ADAPTER_CHECK', '⏳ Adapter not ready yet', {
      hasResult: !!jupiterAdapterResult,
      hasJupiterAdapter: !!jupiterAdapterResult?.jupiterAdapter
    });

  }, []); // Run once on mount

  // ✅ DIAGNOSTIC: Track timeout effect
  useEffect(() => {
    if (isAdapterReady) {
      log('TIMEOUT_EFFECT', 'Already ready, skipping timeout');
      return;
    }

    log('TIMEOUT_EFFECT', 'Setting 5 second timeout...');

    const timeoutId = setTimeout(() => {
      log('TIMEOUT_EFFECT', '⏰ 5 second timeout triggered', {
        jupiterAdapterReady,
        wasReady: isAdapterReady
      });
      setAdapterTimedOut(true);
      setIsAdapterReady(true);
    }, 5000);

    return () => {
      log('TIMEOUT_EFFECT', 'Cleaning up timeout (component unmounted or effect re-ran)');
      clearTimeout(timeoutId);
    };
  }, [isAdapterReady, jupiterAdapterReady]);

  // ✅ DIAGNOSTIC: Track wallet array creation
  const wallets: Adapter[] = useMemo(() => {
    const hasAdapter = !!jupiterAdapterResult?.jupiterAdapter;
    const shouldInclude = hasAdapter && !adapterTimedOut;

    log('WALLETS_MEMOIZED', 'Wallets array recalculated', {
      hasAdapter,
      adapterTimedOut,
      shouldInclude,
      resultingLength: shouldInclude ? 1 : 0
    });

    if (shouldInclude) {
      return [jupiterAdapterResult.jupiterAdapter];
    }
    return [];
  }, [jupiterAdapterResult?.jupiterAdapter, adapterTimedOut]);

  const readyContextValue = useMemo(
    () => {
      const value: WalletReadyContextType = {
        isAdapterReady,
        adapterError,
        debugInfo: {
          projectId: projectId?.slice(0, 10) + '...' || null,
          adapterTimedOut,
          isMounted,
          hookError: adapterHookError ? { message: adapterHookError.message, name: adapterHookError.name } as any : null,
          jupiterAdapterReady,
          initStartTime: INIT_START_TIME,
          initDuration,
        }
      };

      log('CONTEXT_VALUE', 'Context value updated', {
        isAdapterReady,
        adapterTimedOut,
        jupiterAdapterReady,
        isMounted,
        walletsCount: wallets.length
      });

      return value;
    },
    [isAdapterReady, adapterError, adapterTimedOut, isMounted, jupiterAdapterReady, wallets.length, initDuration]
  );

  // ✅ DIAGNOSTIC: SSR safety check
  if (!isMounted) {
    log('RENDER', 'SSR mode - rendering children without provider');
    return <>{children}</>;
  }

  log('RENDER', 'Rendering UnifiedWalletProvider', {
    walletsCount: wallets.length,
    autoConnect: !!(projectId && !adapterTimedOut && isAdapterReady),
    isAdapterReady,
    adapterTimedOut
  });

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