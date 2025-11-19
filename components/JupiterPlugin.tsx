'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { IInit, Branding } from '@/types/jupiter';

interface JupiterPluginProps {
  displayMode?: 'modal' | 'widget' | 'integrated';
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  branding?: Branding;
}

export function JupiterPlugin({
  displayMode = 'widget',
  position = 'bottom-right',
  branding
}: JupiterPluginProps) {
  const { publicKey, connected } = useWallet();
  const [isInitialized, setIsInitialized] = useState(false);
  const prevConnectedRef = useRef(false);

  // Get referral configuration from environment
  const jupiterReferralAccount = process.env.NEXT_PUBLIC_JUPITER_REFERRAL_ACCOUNT;

  // Get branding from props or environment
  const finalBranding: Branding | undefined = branding || {
    logoUri: process.env.NEXT_PUBLIC_JUPITER_BRANDING_LOGO,
    name: process.env.NEXT_PUBLIC_JUPITER_BRANDING_NAME,
  };

  // Only include branding if at least one property is defined
  const hasBranding = finalBranding?.logoUri || finalBranding?.name;

  // FIXED: Jupiter expects basis points (50-255), not decimals
  // User sets percentage (e.g., "2.5" for 2.5%)
  // We convert to basis points (e.g., 250 for 2.5%)
  const feePercentage = parseFloat(
    process.env.NEXT_PUBLIC_JUPITER_REFERRAL_FEE || '2.5'
  );
  const jupiterReferralFee = Math.round(feePercentage * 100); // Convert % to basis points

  // Validate fee is in valid range
  if (jupiterReferralFee < 50 || jupiterReferralFee > 255) {
    console.warn(
      `⚠️  Jupiter referral fee out of range: ${jupiterReferralFee} (must be 50-255).`
    );
  }

  const initializeJupiter = () => {
    if (typeof window === 'undefined' || !window.Jupiter) {
      console.warn('Jupiter plugin not loaded');
      return;
    }

    try {
      // Build form props with optional referral configuration
      const formProps: any = {
        swapMode: 'ExactIn',
      };

      // Add referral account if configured
      if (jupiterReferralAccount) {
        formProps.referralAccount = jupiterReferralAccount;
        formProps.referralFee = jupiterReferralFee; // Now in basis points

        console.log(
          `💰 Jupiter referral configured:`,
          `Account: ${jupiterReferralAccount}`,
          `Fee: ${feePercentage.toFixed(2)}% (${jupiterReferralFee} basis points)`
        );
      } else {
        console.log('⚠️  Jupiter referral account not configured');
      }

      const config: IInit = {
        displayMode,
        integratedTargetId: 'jupiter-plugin',
        autoConnect: true,
        formProps,
        widgetStyle: {
          position: position,
          size: 'default',
        },
        containerClassName: 'jupiter-container',
        onSuccess: (data) => {
          console.log('✅ Jupiter swap successful:', data);
        },
        onSwapError: (data) => {
          console.error('❌ Jupiter swap error:', data);
        },
      };

      // Add branding if configured
      if (hasBranding) {
        config.branding = finalBranding;
        console.log('🎨 Jupiter branding configured:', {
          name: finalBranding.name || '(not set)',
          logoUri: finalBranding.logoUri ? '(provided)' : '(not set)',
        });
      }

      // For integrated mode, add container styles for better UX
      if (displayMode === 'integrated') {
        config.containerClassName = 'jupiter-integrated-container';
      }

      window.Jupiter.init(config);
      setIsInitialized(true);
      console.log('✅ Jupiter widget initialized');
    } catch (error) {
      console.error('❌ Error initializing Jupiter:', error);
    }
  };

  // Initialize on mount
  useEffect(() => {
    if (isInitialized) {
      return;
    }

    // Wait for Jupiter script to load
    const checkJupiter = setInterval(() => {
      if (typeof window !== 'undefined' && window.Jupiter) {
        clearInterval(checkJupiter);
        initializeJupiter();
      }
    }, 100);

    // Cleanup interval after 5 seconds
    const timeout = setTimeout(() => {
      clearInterval(checkJupiter);
    }, 5000);

    return () => {
      clearInterval(checkJupiter);
      clearTimeout(timeout);
    };
  }, [isInitialized]);

  // Handle wallet connect/disconnect
  useEffect(() => {
    if (typeof window === 'undefined' || !window.Jupiter || !isInitialized) {
      return;
    }

    const justConnected = connected && !prevConnectedRef.current;

    if (justConnected && publicKey) {
      console.log('👛 Wallet connected, reinitializing Jupiter:', publicKey.toBase58());
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
      <div className="jupiter-widget-container w-full">
        <div
          id="jupiter-plugin"
          className="relative z-30 w-full"
          style={{
            display: 'contents'
          }}
        />
      </div>
    );
  }

  return null;
}