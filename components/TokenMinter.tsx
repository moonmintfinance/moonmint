// components/TokenMinter.tsx
'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionSignature, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { AtomicToken2022MintService } from '@/services/tokenMintService';
import { MeteoraLaunchService } from '@/services/Meteoralaunchservice';
import { TokenMetadata, MintConfig, LaunchType } from '@/types/token';
import { ProjectLinks } from '@/services/metadataUploadService';
import { validateTokenMetadata } from '@/utils/validation';
import { submitGuard } from '@/utils/security';
import { getReferralWallet } from '@/utils/referral';
import { TRANSACTION_CONFIG } from '@/lib/constants';

import { TokenForm } from './TokenForm';
import { ImageUploadStep } from './ImageUploadStep';
import { MetadataUploadStep } from './MetadataUploadStep';
import { MintReviewStep } from './MintReviewStep';
import { MintSuccess } from './MintSuccess';

import { useTokenMintFlow, MintFlowStep } from '@/hooks/useTokenMintFlow';

const SERVICE_FEE_WALLET = process.env.NEXT_PUBLIC_SERVICE_FEE_WALLET;

const STEPS: MintFlowStep[] = ['form', 'upload-image', 'upload-metadata', 'review', 'minting', 'success'];

const getStepIndex = (step: MintFlowStep) => STEPS.indexOf(step);

export function TokenMinter() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();

  const {
    flowState,
    goToUploadImage,
    goToUploadMetadata,
    goToReview,
    goToMinting,
    goToSuccess,
    goBackToForm,
    goBackToImageUpload,
    goBackToMetadataUpload,
  } = useTokenMintFlow();

  const currentStepIndex = getStepIndex(flowState.step);

  // ✅ FIXED: Updated signature to allow 'null' for imageFile
  const handleFormSubmit = (
    metadata: TokenMetadata,
    config: MintConfig,
    launchType: LaunchType,
    meteoraConfig: { enableFirstBuy: boolean; initialBuyAmount: number } | undefined,
    imageFile?: File | null,
    projectLinks?: ProjectLinks
  ) => {
    const validation = validateTokenMetadata(metadata);
    if (!validation.isValid) {
      validation.errors.forEach((error) => toast.error(error));
      return;
    }

    console.log('✅ Form submitted, moving to image upload step');

    // Merge meteoraConfig into the main config if it exists
    const finalConfig = meteoraConfig ? { ...config, ...meteoraConfig } : config;

    // ✅ FIXED: Convert null to undefined before passing to the hook
    // Hooks typically prefer undefined over null for optional params
    const finalImageFile = imageFile === null ? undefined : imageFile;

    // Now this call will match the updated signature in useTokenMintFlow.ts
    goToUploadImage(metadata, finalConfig, launchType, finalImageFile, projectLinks);
  };

  const handleImageUploaded = (imageIpfsUri: string) => {
    console.log('✅ Image uploaded, moving to metadata upload step');
    goToUploadMetadata(imageIpfsUri);
  };

  const handleSkipImage = () => {
    console.log('⭐️  Image skipped, moving to metadata upload step');
    goToUploadMetadata();
  };

  const handleMetadataUploaded = (metadataUri: string) => {
    console.log('✅ Metadata uploaded, moving to review step');
    goToReview(metadataUri);
  };

  const handleConfirmMint = async () => {
    if (
      !publicKey ||
      !signTransaction ||
      !signAllTransactions ||
      !flowState.metadata.name ||
      !flowState.metadata.symbol ||
      flowState.metadata.decimals === undefined ||
      flowState.metadata.initialSupply === undefined ||
      !flowState.config ||
      !flowState.launchType ||
      !flowState.metadataUri
    ) {
      toast.error('Invalid state for minting. Please complete all steps.');
      return;
    }

    if (!submitGuard.markProcessing('mint-token')) {
      toast.error('A transaction is already being processed');
      return;
    }

    goToMinting();

    const loadingToast = toast.loading(
      flowState.launchType === LaunchType.METEORA
        ? '🚀 Launching on Meteora bonding curve...'
        : '⚡ Creating your token...'
    );

    try {
      console.log('🔒 STEP 4: User confirms mint - signing transaction');

      const completeMetadata: TokenMetadata = {
        name: flowState.metadata.name!,
        symbol: flowState.metadata.symbol!,
        decimals: flowState.metadata.decimals!,
        initialSupply: flowState.metadata.initialSupply!,
        imageUrl: flowState.imageIpfsUri,
        metadataUri: flowState.metadataUri,
      };

      const serviceFeeRecipient = SERVICE_FEE_WALLET
        ? new PublicKey(SERVICE_FEE_WALLET)
        : undefined;

      const referralWallet = getReferralWallet()
        ? new PublicKey(getReferralWallet()!)
        : undefined;

      if (flowState.launchType === LaunchType.METEORA) {
        const meteoraService = new MeteoraLaunchService(connection, {
          publicKey,
          signTransaction,
          signAllTransactions,
        } as any);

        const result = await meteoraService.launchToken({
          metadata: completeMetadata,
          config: flowState.config,
        });

        console.log('✅ Meteora launch result:', result);

        // ========================================================================
        // 🔧 FIX: Sign and send the unsigned transactions to the bonding curve
        // ========================================================================

        // STEP 1: Sign all transactions with wallet
        console.log(`📝 Signing ${result.transactions.length} transaction(s)...`);
        const signedTxs = await signAllTransactions!(result.transactions);

        // STEP 2: Add mint keypair signature to the FIRST transaction (pool creation)
        // The first transaction is the pool creation TX, which needs both:
        // - Wallet signature (from signAllTransactions above)
        // - Mint keypair signature (for creating the new mint account)
        console.log('🔑 Adding mint keypair signature to pool creation transaction...');
        signedTxs[0].partialSign(result.mintKeypair);

        // STEP 3: Send transactions to the network
        console.log(`📤 Sending ${signedTxs.length} transaction(s) to network...`);
        const txSignatures: string[] = [];

        for (let i = 0; i < signedTxs.length; i++) {
          try {
            const signature = await connection.sendRawTransaction(
              signedTxs[i].serialize(),
              {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
              }
            );
            txSignatures.push(signature);
            console.log(`✅ Transaction ${i + 1} sent:`, signature);
          } catch (txError) {
            console.error(`❌ Error sending transaction ${i + 1}:`, txError);
            throw txError;
          }
        }

        // STEP 4: Confirm transactions
        console.log('⏳ Confirming transaction(s)...');
        const latestBlockhash = await connection.getLatestBlockhash();

        for (let i = 0; i < txSignatures.length; i++) {
          try {
            await connection.confirmTransaction(
              {
                signature: txSignatures[i],
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
              },
              'confirmed'
            );
            console.log(`✅ Transaction ${i + 1} confirmed`);
          } catch (confirmError) {
            console.error(`⚠️  Error confirming transaction ${i + 1}:`, confirmError);
            // Don't fail - transaction may still succeed even if confirmation fails
          }
        }

        console.log('✅ Meteora token launched successfully!');

        // STEP 5: Use the primary transaction signature (pool creation)
        const primarySignature = txSignatures[0];

        toast.success('✅ Token launched on Meteora!', { id: loadingToast });

        goToSuccess({
          mintAddress: result.mintAddress,
          signature: primarySignature,
          launchType: LaunchType.METEORA,
          poolAddress: result.poolAddress,
        });
      } else {
        // ✅ FIX: Initialize service with proper dependencies
        const directService = new AtomicToken2022MintService(
          connection,
          serviceFeeRecipient,
          referralWallet
        );
        const mintKeypair = Keypair.generate();
        console.log('🔑 Generated Mint Keypair:', mintKeypair.publicKey.toBase58());

        // ✅ FIX: Calculate fees BEFORE building transaction
        const feeBreakdown = directService.getFeeBreakdown(flowState.config);
        const totalFeeLamports = feeBreakdown.total;
        const totalFeeSol = (totalFeeLamports / LAMPORTS_PER_SOL).toFixed(4);

        console.log(`💰 Total service fee: ${totalFeeSol} SOL`);
        if (referralWallet) {
          const referrerEarnings = (feeBreakdown.referrerEarnings || 0) / LAMPORTS_PER_SOL;
          console.log(`   Referrer earns: ${referrerEarnings.toFixed(4)} SOL`);
        }

        const transaction = await directService.buildMintTransaction(
          publicKey,
          mintKeypair,
          completeMetadata,
          flowState.config,
          serviceFeeRecipient
        );

        // ✅ FIX: Get blockhash BEFORE signing
        const latestBlockhash = await connection.getLatestBlockhash(
          TRANSACTION_CONFIG.COMMITMENT
        );
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = publicKey;

        // Now safe to sign
        transaction.partialSign(mintKeypair);
        const signature = await signTransaction(transaction);

        const txSignature = await connection.sendRawTransaction(
          signature.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          }
        );

        // ✅ FIX: Use same blockhash for confirmation
        await connection.confirmTransaction(
          {
            signature: txSignature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          'confirmed'
        );

        console.log('✅ Direct mint successful:', txSignature);
        toast.success('✅ Token created successfully!', { id: loadingToast });

        goToSuccess({
          mintAddress: mintKeypair.publicKey.toBase58(),
          signature: txSignature,
          launchType: LaunchType.DIRECT,
        });
      }
    } catch (error) {
      console.error('❌ Minting failed:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';

      if (msg.includes('Insufficient funds')) {
        toast.error('Insufficient SOL for transaction fees.', { id: loadingToast });
      } else if (msg.includes('User rejected')) {
        toast.error('Transaction rejected by user', { id: loadingToast });
      } else {
        toast.error(`Minting failed: ${msg}`, { id: loadingToast });
      }
      goToReview(flowState.metadataUri!);
    } finally {
      submitGuard.markComplete('mint-token');
    }
  };

  const handleReset = () => {
    goBackToForm();
  };

  const getBreadcrumbClass = (stepName: MintFlowStep) => {
    const stepIdx = getStepIndex(stepName);
    if (currentStepIndex === stepIdx) return 'text-primary-500 font-bold';
    if (currentStepIndex > stepIdx) return 'text-green-500';
    return 'text-gray-600';
  };

  return (
    <section id="mint" className="py-20 px-6">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4 text-white">Create Your Token</h2>

          {flowState.step !== 'form' && flowState.step !== 'success' && (
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-400 flex-wrap">
              <span className={getBreadcrumbClass('form')}>Form</span>
              <span>→</span>
              <span className={getBreadcrumbClass('upload-image')}>Image</span>
              <span>→</span>
              <span className={getBreadcrumbClass('upload-metadata')}>Metadata</span>
              <span>→</span>
              <span className={getBreadcrumbClass('review')}>Review</span>
              <span>→</span>
              <span className={getBreadcrumbClass('minting')}>Mint</span>
            </div>
          )}
        </div>

        {!connected && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <p className="text-yellow-400 text-sm">
              ⚠️ Please connect your wallet to create tokens
            </p>
          </div>
        )}

        {flowState.step === 'form' && (
          <TokenForm
            onSubmit={handleFormSubmit}
            isLoading={false}
            isWalletConnected={connected}
          />
        )}

        {flowState.step === 'upload-image' && (
          <ImageUploadStep
            metadata={flowState.metadata as TokenMetadata}
            config={flowState.config!}
            imageFile={flowState.imageFile}
            projectLinks={flowState.projectLinks}
            onImageUploaded={handleImageUploaded}
            onSkip={handleSkipImage}
            onBack={goBackToForm}
          />
        )}

        {flowState.step === 'upload-metadata' && (
          <MetadataUploadStep
            metadata={flowState.metadata as TokenMetadata}
            imageIpfsUri={flowState.imageIpfsUri}
            projectLinks={flowState.projectLinks}
            onMetadataUploaded={handleMetadataUploaded}
            onBack={goBackToImageUpload}
          />
        )}

        {flowState.step === 'review' && flowState.config && (
          <MintReviewStep
            metadata={flowState.metadata as TokenMetadata}
            config={flowState.config}
            launchType={flowState.launchType!}
            imageIpfsUri={flowState.imageIpfsUri}
            metadataUri={flowState.metadataUri!}
            totalFee={calculateTotalFee(flowState.config, flowState.launchType!)}
            onConfirm={handleConfirmMint}
            onBack={goBackToMetadataUpload}
            isLoading={false}
          />
        )}

        {flowState.step === 'success' && (
          <MintSuccess
            mintAddress={flowState.mintResult?.mintAddress || ''}
            signature={flowState.mintResult?.signature || ''}
            launchType={flowState.launchType || LaunchType.DIRECT}
            poolAddress={(flowState.mintResult as any)?.poolAddress}
            onReset={handleReset}
          />
        )}
      </div>
    </section>
  );
}

// ✅ Helper function to calculate total fee based on launch type and config
function calculateTotalFee(config: MintConfig, launchType: LaunchType): number {
  if (launchType === LaunchType.METEORA) {
    // Meteora fees are 0 (only user's "first buy" amount is charged)
    return 0;
  }

  // Direct mint: calculate from service fee constants
  const SERVICE_FEE_BASE_LAMPORTS = 0.08 * LAMPORTS_PER_SOL; // 0.08 SOL
  const SERVICE_FEE_AUTHORITY_LAMPORTS = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL

  let totalFee = SERVICE_FEE_BASE_LAMPORTS;

  if (config.mintAuthority) {
    totalFee += SERVICE_FEE_AUTHORITY_LAMPORTS;
  }

  if (config.freezeAuthority) {
    totalFee += SERVICE_FEE_AUTHORITY_LAMPORTS;
  }

  return totalFee;
}