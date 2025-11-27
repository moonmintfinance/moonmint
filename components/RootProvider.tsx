// components/RootProvider.tsx (UPDATED)
'use client';

import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { WalletContextProvider } from '@/components/WalletContextProvider';
import { FloatingBotButton } from '@/components/FloatingBotButton';

interface RootProviderProps {
  children: ReactNode;
}

export function RootProvider({ children }: RootProviderProps) {
  return (
    <WalletContextProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: '',
          style: {
            background: '#27272a',
            color: '#fff',
            border: '1px solid #3f3f46',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      {/* ✅ Add floating bot button - appears on all pages */}
      <FloatingBotButton />
    </WalletContextProvider>
  );
}