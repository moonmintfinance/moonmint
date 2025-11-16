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

    if (!signature) {
      return NextResponse.json(
        { error: 'Signature is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 [Server] Confirming transaction: ${signature}`);
    console.log(`📡 [Server] Using RPC: ${RPC_ENDPOINT.replace(/api-key=[^&]+/, 'api-key=***')}`);

    // ✅ FIX: Use getSignatureStatus instead of confirmTransaction
    const status = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });

    if (!status || !status.value) {
      return NextResponse.json(
        {
          error: 'Transaction not found yet. It may still be processing.',
          signature,
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
    if (!status.value.confirmationStatus ||
        (status.value.confirmationStatus !== 'confirmed' &&
         status.value.confirmationStatus !== 'finalized')) {
      return NextResponse.json(
        {
          error: 'Transaction not yet confirmed',
          status: status.value.confirmationStatus,
        },
        { status: 202 }
      );
    }

    console.log('✅ [Server] Transaction confirmed successfully');

    // Get transaction details for verification
    const txDetails = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    return NextResponse.json({
      success: true,
      signature,
      confirmed: true,
      confirmationStatus: status.value.confirmationStatus,
      slot: status.value.slot,
      blockTime: txDetails?.blockTime,
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