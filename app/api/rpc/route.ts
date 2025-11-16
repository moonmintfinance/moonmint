import { NextRequest, NextResponse } from 'next/server';

/**
 * RPC Proxy Route
 * Location: app/api/rpc/route.ts
 *
 * Forwards JSON-RPC requests to Helius on the server side.
 * This prevents exposing your API key to the browser.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate that HELIUS_API_KEY is set
    if (!process.env.HELIUS_API_KEY) {
      console.error('❌ HELIUS_API_KEY not set in environment variables');
      return NextResponse.json(
        { error: 'RPC service not configured' },
        { status: 500 }
      );
    }

    // Construct Helius endpoint with your private API key
    const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

    // Forward the RPC request to Helius
    const response = await fetch(heliusUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Handle non-OK responses from Helius
    if (!response.ok) {
      console.error(`❌ Helius RPC error: ${response.status}`);
      return NextResponse.json(
        { error: 'RPC request failed from upstream' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ RPC proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `RPC request failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}