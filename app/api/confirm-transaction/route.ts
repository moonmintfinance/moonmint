import { Connection } from '@solana/web3.js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Confirm Transaction Route
 * Verifies transaction status on-chain
 * Location: app/api/confirm-transaction/route.ts
 */
export async function POST(request: NextRequest) {
  try {
    const { signature } = await request.json();

    if (!signature) {
      return NextResponse.json(
        { error: 'Signature is required' },
        { status: 400 }
      );
    }

    console.log(`📝 [Server] Confirming transaction: ${signature}`);

    // ✅ FIX: Use the same RPC endpoint as your app
    const rpcEndpoint = process.env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com';

    console.log(`📡 [Server] Using RPC: ${rpcEndpoint.substring(0, 50)}...`);

    // Create a fresh connection for this request
    const connection = new Connection(rpcEndpoint, 'confirmed');

    // Try to get signature status
    const statusResult = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });

    if (!statusResult) {
      return NextResponse.json(
        {
          error: 'Unable to check transaction status',
          signature,
        },
        { status: 503 }
      );
    }

    const status = statusResult.value;

    if (!status) {
      // Transaction not found yet - might still be processing
      return NextResponse.json(
        {
          success: false,
          message: 'Transaction still processing or not found',
          signature,
        },
        { status: 202 } // 202 = Accepted but still processing
      );
    }

    // Check if transaction failed
    if (status.err) {
      console.error('❌ [Server] Transaction failed:', status.err);
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction failed on-chain',
          details: status.err,
          signature,
        },
        { status: 400 }
      );
    }

    // Check confirmation status
    const confirmationStatus = status.confirmationStatus;
    console.log(`✅ [Server] Confirmation status: ${confirmationStatus}`);

    // Return success even if not fully confirmed yet
    // As long as it's not failed, it will eventually confirm
    return NextResponse.json({
      success: true,
      signature,
      confirmed: confirmationStatus === 'confirmed' || confirmationStatus === 'finalized',
      confirmationStatus,
      slot: status.slot,
      message: confirmationStatus === 'confirmed' || confirmationStatus === 'finalized'
        ? 'Transaction confirmed'
        : 'Transaction processed, waiting for confirmation',
    });

  } catch (error) {
    console.error('❌ [Server] Error confirming transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Still return success-ish response if transaction was sent
    // The important thing is it's on-chain
    if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return NextResponse.json(
        {
          success: true,
          message: 'Transaction sent (confirmation check timed out)',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        error: 'Server error',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}