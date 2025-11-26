'use client';

import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { AtomicToken2022MintService } from '@/services/tokenMintService';
import { MeteoraLaunchService } from '@/services/Meteoralaunchservice';
import { TokenMetadata, MintConfig } from '@/types/token';
import { ProjectLinks, uploadMetadataJson, validateMetadataJson } from '@/services/metadataUploadService';
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
  const { publicKey, sendTransaction, signTransaction, signAllTransactions, signMessage, connected } = useWallet();

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
    projectLinks?: ProjectLinks;
  } | null>(null);

  /**
   * Server-side confirmation helper
   */
  const confirmTransactionServerSide = async (signature: string): Promise<boolean> => {
    try {
      console.log('🔔 [Client] Sending confirmation request to server...');

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
    imageFile?: File | null,
    projectLinks?: ProjectLinks
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
        imageFile,
        projectLinks,
      });
    } else {
      const directService = new AtomicToken2022MintService(connection);
      const totalFee = directService.calculateTotalServiceFee(config);

      setPendingMint({
        metadata,
        config,
        totalFee,
        launchType: LaunchType.DIRECT,
        imageFile,
        projectLinks,
      });
    }
  };

  const handleConfirmTransaction = async () => {
    if (!pendingMint || !publicKey || !sendTransaction) {
      toast.error('Wallet not properly connected');
      return;
    }

    const { metadata, config, launchType, meteoraConfig, imageFile, projectLinks } = pendingMint;

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
      let imageIpfsUri = '';
      let metadataUri = '';

      // =========================================================================
      // STEP 1: UPLOAD IMAGE (if provided)
      // =========================================================================
      if (imageFile) {
        if (!signMessage) {
          console.warn('⚠️ Wallet does not support message signing. Proceeding without image.');
          toast.error('Your wallet does not support message signing. Proceeding without image.', {
            duration: 4000,
          });
        } else {
          console.log('📤 STEP 1: Uploading image with wallet authentication...');
          const imageUploadToast = toast.loading('Signing & uploading image...');

          try {
            // Upload with wallet signature - returns ipfs://hash
            imageIpfsUri = await uploadImageToIPFS(
              imageFile,
              signMessage,
              publicKey.toBase58()
            );

            console.log('✅ Image uploaded:', imageIpfsUri);
            toast.success('Image uploaded!', { id: imageUploadToast });
          } catch (uploadError) {
            console.error('⚠️ Image upload failed:', uploadError);
            const errorMsg = uploadError instanceof Error ? uploadError.message : 'Unknown error';
            toast.error(`Image upload failed: ${errorMsg}. Proceeding without image.`, {
              id: imageUploadToast,
              duration: 5000,
            });
            // Continue without image - don't fail the whole transaction
          }
        }
      }

      // =========================================================================
      // STEP 2: CREATE & UPLOAD METADATA JSON ✅ CRITICAL
      // =========================================================================
      console.log('📝 STEP 2: Creating and uploading metadata JSON...');

      // Validate metadata before upload
      const validation = validateMetadataJson(metadata, imageIpfsUri, projectLinks);
      if (!validation.valid) {
        throw new Error(`Metadata validation failed: ${validation.errors.join(', ')}`);
      }

      const metadataUploadToast = toast.loading('Creating metadata JSON & uploading...');

      try {
        // ✅ THIS IS THE KEY STEP: Create JSON with image field and project links
        // Then upload it to IPFS with wallet authentication
        // ✅ FIXED: Now passes signMessage and publicKey for wallet authentication
        metadataUri = await uploadMetadataJson(
          metadata,
          imageIpfsUri,
          projectLinks,
          signMessage,
          publicKey.toBase58()
        );

        console.log('✅ Metadata JSON created:', metadataUri);
        toast.success('Metadata created!', { id: metadataUploadToast });
      } catch (metadataError) {
        console.error('❌ Metadata JSON upload failed:', metadataError);
        toast.error('Failed to create metadata JSON', {
          id: metadataUploadToast,
          duration: 5000,
        });
        throw metadataError;
      }

      // =========================================================================
      // STEP 3: MINT TOKEN
      // =========================================================================
      if (launchType === LaunchType.METEORA) {
        // =====================================================================
        // METEORA BONDING CURVE LAUNCH - FIXED SIGNING ORDER ✅
        // =====================================================================
        console.log('🚀 Launching on Meteora bonding curve...');

        if (!meteoraConfig) {
          throw new Error('Meteora config is required for bonding curve launch');
        }

        const meteoraService = new MeteoraLaunchService(connection, {
          publicKey,
          signTransaction,
          signAllTransactions,
        } as any);

        // ✅ CRITICAL FIX: Pass metadataUri separately, keep imageUrl for reference
        const result = await meteoraService.launchToken({
          metadata: {
            ...metadata,
            imageUrl: imageIpfsUri,      // Keep image IPFS URI for reference
            metadataUri: metadataUri,    // ✅ FIXED: Metadata JSON URI (points to JSON with image inside)
          },
          config,
          initialBuyAmountSol: meteoraConfig?.enableFirstBuy
            ? meteoraConfig.initialBuyAmount
            : undefined,
        });

        console.log('✅ Meteora launch service returned transactions:', result.transactions.length);

        console.log('✍️ Signing transactions with Phantom wallet...');

        // ✅ CRITICAL FIX: Use signAllTransactions for multiple transactions
        // This ensures the user gets prompted for ALL signatures in one wallet popup
        if (!signAllTransactions) {
          throw new Error('Wallet does not support signing multiple transactions');
        }

        try {
          console.log(`\n📝 Preparing ${result.transactions.length} transaction(s) for signing...`);

          // ✅ STEP 1: Sign ALL transactions at once with signAllTransactions
          console.log('  → Signing all transactions with Phantom wallet...');
          const signedTransactions = await signAllTransactions(result.transactions);
          console.log(`  ✅ All ${signedTransactions.length} transactions signed by Phantom`);

          // ✅ STEP 2: Add mint keypair signature to POOL CREATION TX ONLY (index 0)
          // The pool creation transaction needs the mint keypair signature
          // The swap/buy transaction (index 1) only needs Phantom's signature
          console.log('  → Adding mint keypair signature to pool creation transaction...');
          signedTransactions[0].partialSign(result.mintKeypair);
          console.log(`  ✅ Mint keypair signature added to transaction 1`);

          // ✅ STEP 3: Send both fully signed transactions
          const signatures: string[] = [];

          for (let i = 0; i < signedTransactions.length; i++) {
            const tx = signedTransactions[i];
            const txType = i === 0 ? 'pool creation' : 'swap/buy';

            console.log(`  → Sending ${txType} transaction (${i + 1}/${signedTransactions.length})...`);
            const sig = await connection.sendRawTransaction(
              tx.serialize(),
              {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
              }
            );
            signatures.push(sig);
            console.log(`    ✅ Sent: ${sig}`);
          }

          // ✅ FIX: Only confirm on server-side, NOT on client
          console.log('✅ All transactions sent successfully!');

          // Confirm via server-side API only (no WebSocket)
          try {
            console.log('⏳ Verifying transaction on-chain via server...');
            await confirmTransactionServerSide(signatures[0]);
            console.log('✅ Server confirmed transaction');
          } catch (serverError) {
            console.warn('⚠️ Server confirmation failed, but transaction is on-chain:', serverError);
            // Don't fail - transaction was sent, just verification failed
          }

          console.log('✅ Token launched on Meteora successfully!');
          console.log(`📍 Transaction: https://solscan.io/tx/${signatures[0]}`);

          toast.success('Token launched on Meteora bonding curve!', {
            id: loadingToast,
            duration: 5000,
          });

          // ✅ Redirect with proper data
          setMintResult({
            mintAddress: result.mintAddress,
            signature: signatures[0],
            launchType: LaunchType.METEORA,
            poolAddress: result.poolAddress,
          });

        } catch (phantomError) {
          console.error('❌ Error during transaction process:', phantomError);

          const displayMessage = sanitizeErrorMessage(phantomError);

          if (displayMessage.includes('User rejected') || displayMessage.includes('User cancelled')) {
            toast.error('Transaction rejected by user', { id: loadingToast });
          } else if (displayMessage.includes('does not support')) {
            toast.error('Your wallet does not support this feature. Try updating your wallet.', { id: loadingToast });
          } else if (displayMessage.includes('scam') || displayMessage.includes('suspicious')) {
            toast.error(
              'Phantom flagged this as suspicious. If you trust this transaction, try again.',
              { id: loadingToast, duration: 5000 }
            );
          } else if (displayMessage.includes('block height') || displayMessage.includes('expired')) {
            // Transaction was sent but confirmation timed out - this is OK
            toast.success(
              'Transaction sent! It may take a moment to confirm. Check Solscan for status.',
              { id: loadingToast, duration: 6000 }
            );
          } else if (displayMessage.includes('WebSocket') || displayMessage.includes('connection')) {
            toast.error(
              'Network connection issue. Transaction may have been sent. Check Solscan for status.',
              { id: loadingToast, duration: 6000 }
            );
          } else {
            toast.error(displayMessage || 'Failed to launch token', { id: loadingToast });
          }

          throw phantomError;
        }
      } else {
        // =====================================================================
        // DIRECT TOKEN 2022 LAUNCH
        // =====================================================================
        console.log('🚀 Launching direct Token 2022...');

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

        // ✅ CRITICAL FIX: Pass metadataUri separately, keep imageUrl for reference
        const transaction = await mintService.buildMintTransaction(
          publicKey,
          mintKeypair,
          {
            ...metadata,
            imageUrl: imageIpfsUri,      // Keep image IPFS URI for reference
            metadataUri: metadataUri,    // ✅ FIXED: Metadata JSON URI (points to JSON with image inside)
          },
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
            Mint a Solana Token to your wallet or launch on a Chad Mint bonding curve, powered by Meteora
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