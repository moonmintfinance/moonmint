'use client';

import { useEffect, useState } from 'react';
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletReady } from '@/components/WalletContextProvider';

const LOG_PREFIX = '🔘 [WALLET_BUTTON]';
const BUTTON_INIT_TIME = Date.now();

function log(stage: string, message: string, data?: any) {
  const elapsed = Date.now() - BUTTON_INIT_TIME;
  const timestamp = new Date().toLocaleTimeString();

  if (data) {
    console.log(`${LOG_PREFIX} [${timestamp}] +${elapsed}ms - ${stage}: ${message}`, data);
  } else {
    console.log(`${LOG_PREFIX} [${timestamp}] +${elapsed}ms - ${stage}: ${message}`);
  }
}

export function WalletButton() {
  const [isMounted, setIsMounted] = useState(false);
  const [renderCount, setRenderCount] = useState(0);

  const { setShowModal } = useUnifiedWalletContext();
  const { connected, publicKey, connecting, disconnecting } = useWallet();
  const { isAdapterReady, adapterError, debugInfo } = useWalletReady();

  log('RENDER', `Component render #${renderCount + 1}`, {
    isMounted,
    isAdapterReady,
    connected,
    connecting,
    disconnecting,
    hasPublicKey: !!publicKey,
    hasAdapterError: !!adapterError
  });

  useEffect(() => {
    setRenderCount(prev => prev + 1);
  }, []);

  // ✅ DIAGNOSTIC: Mount effect
  useEffect(() => {
    log('MOUNT_EFFECT', 'WalletButton mounted');
    setIsMounted(true);

    return () => {
      log('UNMOUNT_EFFECT', 'WalletButton unmounted');
    };
  }, []);

  // ✅ DIAGNOSTIC: Track wallet state changes
  useEffect(() => {
    log('WALLET_STATE_CHANGE', 'Wallet state changed', {
      connected,
      connecting,
      disconnecting,
      publicKey: publicKey?.toBase58().slice(0, 8) + '...' || null,
      adapterError,
    });
  }, [connected, publicKey, connecting, disconnecting, adapterError]);

  // ✅ DIAGNOSTIC: Track adapter readiness
  useEffect(() => {
    log('ADAPTER_READINESS', 'Adapter readiness changed', {
      isAdapterReady,
      adapterTimedOut: debugInfo?.adapterTimedOut,
      jupiterAdapterReady: debugInfo?.jupiterAdapterReady,
      hookError: debugInfo?.hookError?.message || null,
      projectId: debugInfo?.projectId,
      initDuration: debugInfo?.initDuration + 'ms',
    });
  }, [isAdapterReady, adapterError, debugInfo]);

  // ✅ DIAGNOSTIC: Button click handler
  const handleClick = () => {
    log('BUTTON_CLICK', 'Connect wallet button clicked', {
      isAdapterReady,
      connected,
      hasSetShowModal: !!setShowModal,
    });

    if (!setShowModal) {
      log('BUTTON_CLICK', '❌ setShowModal is not available!');
      return;
    }

    try {
      log('BUTTON_CLICK', 'Calling setShowModal(true)...');
      setShowModal(true);
      log('BUTTON_CLICK', '✅ setShowModal(true) executed successfully');
    } catch (error) {
      log('BUTTON_CLICK', '❌ Error calling setShowModal', { error });
    }
  };

  // ✅ DIAGNOSTIC: SSR safety check
  if (!isMounted) {
    log('RENDER_SSR', 'SSR mode - showing loading state', {
      timestamp: new Date().toLocaleTimeString()
    });

    return (
      <div className="h-10 px-3 md:px-4 bg-dark-200 rounded-lg animate-pulse flex items-center justify-center max-w-[120px] md:max-w-none">
        <span className="text-xs text-gray-400 truncate">Loading...</span>
      </div>
    );
  }

  // ✅ DIAGNOSTIC: Adapter loading state
  if (!isAdapterReady) {
    log('RENDER_LOADING', 'Adapter still initializing - showing spinner', {
      elapsed: Date.now() - BUTTON_INIT_TIME + 'ms',
      debugInfo
    });

    return (
      <div className="h-10 px-3 md:px-4 bg-dark-200 rounded-lg flex items-center justify-center max-w-[120px] md:max-w-none" title={`Initializing (${(Date.now() - BUTTON_INIT_TIME) / 1000}s)`}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-400 truncate hidden md:inline">
            {adapterError ? 'Error' : 'Connecting...'}
          </span>
        </div>
      </div>
    );
  }

  // ✅ DIAGNOSTIC: Determine display text
  let displayText = 'Connect Wallet';
  let tooltipText = '';

  if (connecting) {
    displayText = 'Connecting...';
    tooltipText = 'Wallet connection in progress';
    log('RENDER_CONNECTING', 'Wallet is connecting');
  } else if (disconnecting) {
    displayText = 'Disconnecting...';
    tooltipText = 'Wallet disconnection in progress';
    log('RENDER_DISCONNECTING', 'Wallet is disconnecting');
  } else if (connected && publicKey) {
    displayText = `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`;
    tooltipText = publicKey.toBase58();
    log('RENDER_CONNECTED', 'Wallet is connected', {
      address: displayText,
      fullAddress: publicKey.toBase58()
    });
  } else {
    log('RENDER_DISCONNECTED', 'Wallet is disconnected');
  }

  // ✅ DIAGNOSTIC: Show error state
  if (adapterError) {
    log('RENDER_ERROR', 'Adapter error present', { error: adapterError });
    tooltipText = `Error: ${adapterError.slice(0, 50)}...`;
  }

  log('RENDER_BUTTON', 'Final button render state', {
    displayText,
    connected,
    connecting,
    adapterReady: isAdapterReady,
  });

  return (
    <button
      onClick={handleClick}
      title={tooltipText}
      disabled={!isAdapterReady}
      className={`h-10 px-3 md:px-4 text-black font-bold rounded-lg transition-all text-xs md:text-sm whitespace-nowrap overflow-hidden max-w-[120px] md:max-w-none shadow-lg ${
        connected
          ? 'bg-green-500 hover:bg-green-600 shadow-green-500/40 hover:shadow-green-500/60'
          : 'bg-primary-500 hover:bg-primary-400 active:bg-primary-600 shadow-primary-500/40 hover:shadow-primary-500/60'
      } ${!isAdapterReady ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {displayText}

      {/* DEBUG INFO BADGE - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <span className="ml-1 text-[10px] opacity-70">
          {isAdapterReady ? '✅' : '⏳'}
        </span>
      )}
    </button>
  );
}