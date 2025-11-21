'use client';

import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { AtomicToken2022MintService } from '@/services/tokenMintService';
import { MeteoraLaunchService } from '@/services/Meteoralaunchservice';
import { TokenMetadata, MintConfig } from '@/types/token';
import { validateTokenMetadata } from '@/utils/validation';
import { submitGuard, validateTransaction, sanitizeErrorMessage } from '@/utils/security';
import { getReferralWallet } from '@/utils/referral';
import { TokenForm, LaunchType } from './TokenForm';
import { MintSuccess } from './MintSuccess';
import { TransactionConfirmation } from './TransactionConfirmation';
import { uploadImageToIPFS } from '@/services/web3Storage';
import { SERVICE_FEE_WALLET, METEORA_CONFIG } from '@/lib/constants';

export function TokenMinter() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction, signAllTransactions, connected } = useWallet();

  const [isLoading, setIsLoading] = useState(false);
  const [mintResult, setMintResult] = useState<{
    mintAddress: string;
    signature: string;
    launchType: LaunchType;
    poolAddress?: string;
  } | null>(null);

  const [pendingMint, setPendingMint] = useState<{
    metadata: TokenMetadata;
    config: MintConfig;
    totalFee: number;
    launchType: LaunchType;
    meteoraConfig?: { enableFirstBuy: boolean; initialBuyAmount: number };
    imageFile?: File | null;
  } | null>(null);

  /**
   * Server-side confirmation helper
   */
  const confirmTransactionServerSide = async (signature: string): Promise<boolean> => {
    try {
      console.log('📡 [Client] Sending confirmation request to server...');

      const response = await fetch('/api/confirm-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [Client] Server confirmed transaction:', data);

      return data.success;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [Client] Server confirmation failed:', message);
      throw error;
    }
  };

  const handleMintToken = async (
    metadata: TokenMetadata,
    config: MintConfig,
    selectedLaunchType: LaunchType,
    meteoraConfig?: { enableFirstBuy: boolean; initialBuyAmount: number },
    imageFile?: File | null // ✅ NEW: Receive File object
  ) => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!sendTransaction) {
      toast.error('Wallet does not support transaction sending');
      return;
    }

    const validation = validateTokenMetadata(metadata);
    if (!validation.isValid) {
      validation.errors.forEach((error) => toast.error(error));
      return;
    }

    if (selectedLaunchType === LaunchType.METEORA) {
      if (!METEORA_CONFIG.ENABLED) {
        toast.error('Meteora bonding curves not configured');
        return;
      }

      const meteoraBaseFee = 0.00;
      const firstBuyAmount = meteoraConfig?.enableFirstBuy ? meteoraConfig.initialBuyAmount : 0;
      const totalFee = (meteoraBaseFee + firstBuyAmount) * LAMPORTS_PER_SOL;

      setPendingMint({
        metadata,
        config,
        totalFee,
        launchType: LaunchType.METEORA,
        meteoraConfig,
        imageFile, // ✅ Store for later
      });
    } else {
      const directService = new AtomicToken2022MintService(connection);
      const totalFee = directService.calculateTotalServiceFee(config);

      setPendingMint({
        metadata,
        config,
        totalFee,
        launchType: LaunchType.DIRECT,
        imageFile, // ✅ Store for later
      });
    }
  };

  const handleConfirmTransaction = async () => {
    if (!pendingMint || !publicKey || !sendTransaction) {
      toast.error('Wallet not properly connected');
      return;
    }

    const { metadata, config, launchType, meteoraConfig, imageFile } = pendingMint;

    // Prevent double-submit
    if (!submitGuard.markProcessing('mint-token')) {
      toast.error('A transaction is already being processed');
      return;
    }

    // Close confirmation dialog
    setPendingMint(null);

    setIsLoading(true);
    const loadingToast = toast.loading(
      launchType === LaunchType.METEORA
        ? 'Launching on Meteora bonding curve...'
        : 'Creating your token...'
    );

    try {
      // ✅ NEW: Upload image AFTER confirmation but BEFORE sending transaction
      let finalImageUrl = metadata.imageUrl;

      if (imageFile) {
        console.log('📤 Uploading image to IPFS...');
        const uploadingToast = toast.loading('Uploading image to IPFS...');
        try {
          finalImageUrl = await uploadImageToIPFS(imageFile);
          console.log('✅ Image uploaded:', finalImageUrl);
          toast.success('Image uploaded!', { id: uploadingToast });
        } catch (uploadError) {
          console.error('⚠️ Image upload failed:', uploadError);
          toast.error('Image upload failed, proceeding without image', { id: uploadingToast });
          // Continue without image - don't fail the whole transaction
        }
      }

      // Update metadata with final image URL
      const metadataWithImage = { ...metadata, imageUrl: finalImageUrl };

      if (launchType === LaunchType.METEORA) {
        console.log('🚀 Starting Meteora bonding curve launch...');

        if (!signTransaction || !signAllTransactions) {
          throw new Error('Wallet does not support signing transactions');
        }

        const meteoraService = new MeteoraLaunchService(connection, {
          publicKey,
          signTransaction,
          signAllTransactions,
        } as any);

        const result = await meteoraService.launchToken({
          metadata: metadataWithImage,
          config,
          initialBuyAmountSol: meteoraConfig?.enableFirstBuy
            ? meteoraConfig.initialBuyAmount
            : undefined,
        });

        console.log('✍️ Signing and sending transaction...');

        const signature = await sendTransaction(result.transaction, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        console.log('⏳ Confirming transaction on server...');
        await confirmTransactionServerSide(signature);

        console.log('✅ Token launched on Meteora successfully!');

        toast.success('Token launched on Meteora bonding curve!', {
          id: loadingToast,
        });

        setMintResult({
          mintAddress: result.mintAddress,
          signature,
          launchType: LaunchType.METEORA,
          poolAddress: result.poolAddress,
        });
      } else {
        // Direct Token 2022 launch
        console.log('🚀 Starting atomic Token 2022 mint operation...');

        const serviceFeeRecipient = SERVICE_FEE_WALLET
          ? new PublicKey(SERVICE_FEE_WALLET)
          : undefined;

        const referralWalletStr = getReferralWallet();
        const referralWallet = referralWalletStr
          ? new PublicKey(referralWalletStr)
          : undefined;

        const mintService = new AtomicToken2022MintService(
          connection,
          serviceFeeRecipient,
          referralWallet
        );
        const mintKeypair = Keypair.generate();
        const mint = mintKeypair.publicKey;

        const feeBreakdown = mintService.getFeeBreakdown(config);
        const totalFeeSol = feeBreakdown.total / LAMPORTS_PER_SOL;

        console.log('📍 Mint address:', mint.toBase58());
        console.log('💳 Connected wallet:', publicKey.toBase58());
        console.log(`📊 Total service fee: ${totalFeeSol.toFixed(4)} SOL`);

        if (referralWallet) {
          console.log('🎯 Referral wallet:', referralWallet.toBase58());
        }

        const transaction = await mintService.buildMintTransaction(
          publicKey,
          mintKeypair,
          metadataWithImage,
          config
        );

        const transactionValidation = validateTransaction(transaction, [publicKey]);
        if (!transactionValidation.valid) {
          throw new Error(
            'Transaction validation failed: ' + transactionValidation.errors.join(', ')
          );
        }

        console.log('✅ Transaction validation passed');
        console.log('✍️ Signing and sending transaction via wallet...');

        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        console.log('⏳ Confirming transaction on server...');
        await confirmTransactionServerSide(signature);

        console.log('✅ Token 2022 minted successfully!');

        toast.success('Token created successfully!', {
          id: loadingToast,
        });

        setMintResult({
          mintAddress: mint.toBase58(),
          signature,
          launchType: LaunchType.DIRECT,
        });
      }
    } catch (error) {
      console.error('❌ Minting error:', error);

      const displayMessage = sanitizeErrorMessage(error);

      // Check for wallet-specific errors
      if (displayMessage.includes('User rejected') || displayMessage.includes('User cancelled')) {
        toast.error('Transaction rejected by user', { id: loadingToast });
      } else if (displayMessage.includes('Insufficient')) {
        toast.error(
          'Insufficient SOL in wallet. Please ensure you have enough SOL.',
          { id: loadingToast }
        );
      } else if (displayMessage.includes('Blockhash')) {
        toast.error('Network busy, please try again', { id: loadingToast });
      } else if (displayMessage.includes('address table account')) {
        toast.error(
          'Network error: Address Lookup Tables not found. Try again or check your connection.',
          { id: loadingToast }
        );
      } else if (displayMessage.includes('confirmed')) {
        toast.error('Transaction failed to confirm. Please check the explorer.', { id: loadingToast });
      } else if (displayMessage.includes('not found')) {
        toast.error('Transaction still processing. Please check the explorer.', { id: loadingToast });
      } else {
        toast.error(displayMessage || 'Transaction failed', { id: loadingToast });
      }
    } finally {
      setIsLoading(false);
      submitGuard.markComplete('mint-token');
    }
  };

  const handleCancelTransaction = () => {
    setPendingMint(null);
  };

  const handleReset = () => {
    setMintResult(null);
  };

  return (
    <section id="mint" className="py-20 px-6">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4 text-white">
            Create Your Token
          </h2>
          <p className="text-gray-400">
            Mint a Solana Token to your wallet or launch on a Moon Mint bonding curve, powered by Meteora
          </p>
        </div>

        {mintResult ? (
          <MintSuccess
            mintAddress={mintResult.mintAddress}
            signature={mintResult.signature}
            launchType={mintResult.launchType}
            poolAddress={mintResult.poolAddress}
            onReset={handleReset}
          />
        ) : (
          <>
            {!connected && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="text-yellow-500 text-lg">⚠️</div>
                  <div>
                    <div className="font-medium text-yellow-400">
                      Wallet Not Connected
                    </div>
                    <div className="text-sm text-yellow-300 mt-1">
                      Please connect your wallet to create tokens
                    </div>
                  </div>
                </div>
              </div>
            )}
            <TokenForm
              onSubmit={handleMintToken}
              isLoading={isLoading}
              isWalletConnected={connected}
            />
          </>
        )}

        {/* Transaction Confirmation Dialog */}
        {pendingMint && (
          <TransactionConfirmation
            metadata={pendingMint.metadata}
            config={pendingMint.config}
            totalFee={pendingMint.totalFee}
            launchType={pendingMint.launchType}
            onConfirm={handleConfirmTransaction}
            onCancel={handleCancelTransaction}
          />
        )}
      </div>
    </section>
  );
}