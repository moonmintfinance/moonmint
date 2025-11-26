import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState, useCallback } from 'react';
import { Keypair, PublicKey } from '@solana/web3.js';
import { AtomicToken2022MintService } from '@/services/tokenMintService';
import { TokenMetadata, MintConfig } from '@/types/token';

/**
 * Custom hook for token minting operations
 * Provides easy access to Token 2022 minting functionality with state management
 */
export function useTokenMint() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mintService = new AtomicToken2022MintService(connection);

  const mint = useCallback(
    async (metadata: TokenMetadata, config: MintConfig) => {
      if (!wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      setIsLoading(true);
      setError(null);

      try {
        // Generate keypair for the new mint
        const mintKeypair = Keypair.generate();

        // Get service fee recipient from environment
        const serviceFeeRecipient = process.env.NEXT_PUBLIC_SERVICE_FEE_WALLET
          ? new PublicKey(process.env.NEXT_PUBLIC_SERVICE_FEE_WALLET)
          : undefined;

        // Call the service with all required parameters (5 arguments)
        const transaction = await mintService.buildMintTransaction(
          wallet.publicKey,
          mintKeypair,
          metadata,
          config,
          serviceFeeRecipient  // ✅ FIXED: Added missing 5th parameter
        );

        if (!transaction) {
          throw new Error('Transaction building failed');
        }

        return transaction;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [connection, wallet.publicKey]
  );

  return {
    mint,
    isLoading,
    error,
    isConnected: !!wallet.publicKey,
  };
}