'use client';

import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Jupiter) {
      return;
    }

    if (connected && publicKey && !isInitialized) {
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
            console.log('✅ Jupiter swap successful:', data);
          },
          onSwapError: (data) => {
            console.error('❌ Jupiter swap error:', data);
          },
        };

        window.Jupiter.init(config);
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing Jupiter:', error);
      }
    }
  }, [connected, publicKey, isInitialized, displayMode, position]);

  if (displayMode === 'integrated') {
    return <div id="jupiter-plugin" />;
  }

  return null;
}