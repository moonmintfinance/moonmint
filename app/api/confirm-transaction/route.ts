import { Connection } from '@solana/web3.js';
import { NextRequest, NextResponse } from 'next/server';

const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';

// ✅ FIX: Use Helius RPC with API key (same as the rest of your app)
const RPC_ENDPOINT = process.env.HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : SOLANA_NETWORK === 'mainnet-beta'
    ? 'https://api.mainnet-beta.solana.com'
    : SOLANA_NETWORK === 'testnet'
      ? 'https://api.testnet.solana.com'
      : 'https://api.devnet.solana.com';

const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// app/api/confirm-transaction/route.ts
export async function POST(request: NextRequest) {
  try {
    const { signature } = await request.json();

    // ✅ IMPROVED: Better validation
    if (!signature || typeof signature !== 'string') {
      console.error('❌ [Server] Invalid signature:', signature);
      return NextResponse.json(
        { error: 'Invalid signature format', signature },
        { status: 400 }
      );
    }

    const trimmedSignature = signature.trim();

    // ✅ NEW: Validate signature format (base58)
    if (trimmedSignature.length < 80 || trimmedSignature.length > 90) {
      console.error('❌ [Server] Signature length invalid:', trimmedSignature.length);
      return NextResponse.json(
        { error: 'Invalid signature length', receivedLength: trimmedSignature.length },
        { status: 400 }
      );
    }

    console.log(`🔍 [Server] Confirming transaction: ${trimmedSignature.slice(0, 20)}...`);
    console.log(`📡 [Server] Using RPC: ${RPC_ENDPOINT.replace(/api-key=[^&]+/, 'api-key=***')}`);
    console.log(`📡 [Server] Network: ${SOLANA_NETWORK}`);

    // ✅ NEW: Retry logic with exponential backoff
    let status = null;
    let attempts = 0;
    const maxAttempts = 5;
    const delayMs = 500;

    while (attempts < maxAttempts && !status?.value) {
      attempts++;
      console.log(`⏳ [Server] Attempt ${attempts}/${maxAttempts}...`);

      try {
        // ✅ FIX: Use getSignatureStatus instead of confirmTransaction
        status = await connection.getSignatureStatus(trimmedSignature, {
          searchTransactionHistory: true,
        });

        if (status?.value) {
          console.log(`✅ [Server] Status found on attempt ${attempts}:`, status.value.confirmationStatus);
          break;
        }

        console.log(`⏳ [Server] Transaction not yet indexed, waiting...`);

        // ✅ NEW: Exponential backoff - 500ms, 1s, 2s, 4s, 8s
        if (attempts < maxAttempts) {
          const waitTime = delayMs * Math.pow(2, attempts - 1);
          console.log(`⏳ [Server] Waiting ${waitTime}ms before next attempt...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      } catch (rpcError) {
        console.error(`⚠️  [Server] RPC error on attempt ${attempts}:`,
          rpcError instanceof Error ? rpcError.message : String(rpcError)
        );

        if (attempts < maxAttempts) {
          const waitTime = delayMs * Math.pow(2, attempts - 1);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // ✅ IMPROVED: Check if found after retries
    if (!status || !status.value) {
      console.error(
        `❌ [Server] Transaction not found after ${maxAttempts} attempts`,
        { signature: trimmedSignature.slice(0, 20) + '...' }
      );
      return NextResponse.json(
        {
          error: 'Transaction not found yet. It may still be processing.',
          signature: trimmedSignature,
          attempts,
        },
        { status: 202 }
      );
    }

    if (status.value.err) {
      console.error('❌ [Server] Transaction failed:', status.value.err);
      return NextResponse.json(
        {
          error: 'Transaction failed',
          details: status.value.err,
        },
        { status: 400 }
      );
    }

    // Check if transaction is confirmed
    const confirmationStatus = status.value.confirmationStatus;
    console.log(`📊 [Server] Confirmation status: ${confirmationStatus}`);

    if (!confirmationStatus ||
        (confirmationStatus !== 'confirmed' &&
         confirmationStatus !== 'finalized')) {
      console.warn(
        `⚠️  [Server] Transaction not yet confirmed: ${confirmationStatus}`
      );
      return NextResponse.json(
        {
          error: 'Transaction not yet confirmed',
          status: confirmationStatus,
        },
        { status: 202 }
      );
    }

    console.log('✅ [Server] Transaction confirmed successfully');

    // ✅ IMPROVED: Get transaction details with error handling
    let blockTime = null;
    try {
      const txDetails = await connection.getTransaction(trimmedSignature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });

      if (txDetails) {
        blockTime = txDetails.blockTime;
        console.log(`✅ [Server] Full TX details retrieved, blockTime: ${blockTime}`);
      }
    } catch (detailsError) {
      console.warn('⚠️  [Server] Could not fetch full transaction details:',
        detailsError instanceof Error ? detailsError.message : String(detailsError)
      );
      // Don't fail if we can't get full details
    }

    return NextResponse.json({
      success: true,
      signature: trimmedSignature,
      confirmed: true,
      confirmationStatus,
      slot: status.value.slot,
      blockTime,
      attempts, // ✅ NEW: Include attempt count
    });
  } catch (error) {
    console.error('❌ [Server] Error confirming transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}