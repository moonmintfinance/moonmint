'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { IInit } from '@/types/jupiter';

interface JupiterPluginProps {
  displayMode?: 'modal' | 'widget' | 'integrated';
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export function JupiterPlugin({
  displayMode = 'widget',
  position = 'bottom-right'
}: JupiterPluginProps) {
  const { publicKey, connected } = useWallet();
  const [isInitialized, setIsInitialized] = useState(false);
  const prevConnectedRef = useRef(false);

  const initializeJupiter = () => {
    if (typeof window === 'undefined' || !window.Jupiter) {
      return;
    }

    try {
      const config: IInit = {
        displayMode,
        integratedTargetId: 'jupiter-plugin',
        autoConnect: true,
        widgetStyle: {
          position: position,
          size: 'default',
        },
        onSuccess: (data) => {
          console.log('Jupiter swap successful:', data);
        },
        onSwapError: (data) => {
          console.error('Jupiter swap error:', data);
        },
      };

      window.Jupiter.init(config);
      setIsInitialized(true);
      console.log('Jupiter widget initialized');
    } catch (error) {
      console.error('Error initializing Jupiter:', error);
    }
  };

  // Initialize on mount
  useEffect(() => {
    if (isInitialized) {
      return;
    }

    initializeJupiter();
  }, [isInitialized]);

  // Handle wallet connect/disconnect
  useEffect(() => {
    if (typeof window === 'undefined' || !window.Jupiter || !isInitialized) {
      return;
    }

    const justConnected = connected && !prevConnectedRef.current;

    if (justConnected && publicKey) {
      console.log('Wallet connected, reinitializing Jupiter:', publicKey.toBase58());
      try {
        window.Jupiter.close?.();
        setIsInitialized(false);

        // Reinit after closing
        setTimeout(() => {
          initializeJupiter();
        }, 100);
      } catch (error) {
        console.error('Error handling wallet connection:', error);
      }
    }

    prevConnectedRef.current = connected;
  }, [connected, publicKey, isInitialized]);

  if (displayMode === 'integrated') {
    return (
      <div className="jupiter-widget-container">
        <div
          id="jupiter-plugin"
          className="relative z-30"
          style={{
            display: 'contents'
          }}
        />
      </div>
    );
  }

  return null;
}