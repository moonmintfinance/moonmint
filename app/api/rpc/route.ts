import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * RPC Proxy Route
 * Forwards Solana RPC requests to Helius or public RPC endpoint
 * Location: app/api/rpc/route.ts
 */
export async function POST(request: NextRequest) {
  try {
    // Get the RPC endpoint from environment
    let rpcEndpoint = process.env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com';

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
    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ [RPC Proxy] Error:', error);
    return NextResponse.json(
      { error: 'RPC proxy error', details: String(error) },
      { status: 500 }
    );
  }
}