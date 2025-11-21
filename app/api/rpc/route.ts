import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * RPC Proxy Route
 * Forwards Solana RPC requests to Helius or public RPC endpoint
 * Used for secure client-side RPC calls
 */
export async function POST(request: NextRequest) {
  try {
    // Get the RPC endpoint from environment
    let rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

    if (!rpcEndpoint) {
      // Fallback to Helius if available
      if (process.env.HELIUS_API_KEY) {
        rpcEndpoint = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
      } else {
        // Final fallback to public Solana RPC
        const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
        const publicRpcMap: Record<string, string> = {
          'mainnet-beta': 'https://api.mainnet-beta.solana.com',
          'testnet': 'https://api.testnet.solana.com',
          'devnet': 'https://api.devnet.solana.com',
        };
        rpcEndpoint = publicRpcMap[network];
      }
    }

    // Parse the incoming RPC request
    const body = await request.json();

    console.log(`📡 [RPC Proxy] Method: ${body.method}`);

    // Forward request to the actual RPC endpoint
    const response = await fetch(rpcEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`❌ [RPC Proxy] Error: ${response.status}`);
      return NextResponse.json(
        { error: `RPC error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return the RPC response
    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ [RPC Proxy] Error:', error);
    return NextResponse.json(
      { error: 'RPC proxy error', details: String(error) },
      { status: 500 }
    );
  }
}