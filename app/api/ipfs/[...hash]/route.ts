// ============================================
// FILE: app/api/ipfs/[...hash]/route.ts
// ============================================
// âœ… Direct HTTP gateway fetch with proper authentication
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string[] }> }
) {
  try {
    const { hash } = await params;
    const hashStr = hash.join('/');

    if (!hashStr) {
      return NextResponse.json(
        { error: 'No IPFS hash provided' },
        { status: 400 }
      );
    }

    const gatewayUrl = process.env.NEXT_PUBLIC_PINATA_GATEWAY;
    const jwt = process.env.PINATA_JWT;

    if (!gatewayUrl || !jwt) {
      console.error('❌ Missing PINATA_JWT or NEXT_PUBLIC_PINATA_GATEWAY');
      return NextResponse.json(
        { error: 'Gateway not configured' },
        { status: 500 }
      );
    }

    console.log(`📡 Fetching IPFS content: ${hashStr}`);

    // âœ… Direct HTTP request to Pinata gateway with JWT in header
    const fullUrl = `${gatewayUrl}/ipfs/${hashStr}`;

    // Use AbortController for timeout (standard fetch API)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const gatewayResponse = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
        signal: controller.signal,
      });
      if (!gatewayResponse.ok) {
        const errorText = await gatewayResponse.text();
        console.error(`❌ Gateway error ${gatewayResponse.status}: ${errorText}`);

        if (gatewayResponse.status === 401 || gatewayResponse.status === 403) {
          return NextResponse.json(
            { error: 'Gateway access denied - check JWT and Gateway Access Controls' },
            { status: 401 }
          );
        }

        if (gatewayResponse.status === 404) {
          return NextResponse.json(
            { error: 'Content not found on IPFS' },
            { status: 404 }
          );
        }

        return NextResponse.json(
          { error: `Gateway error: ${gatewayResponse.statusText}` },
          { status: gatewayResponse.status }
        );
      }

      console.log(`âœ… Successfully fetched: ${hashStr}`);

      // Stream the response for better performance
      const contentType = gatewayResponse.headers.get('content-type') || 'application/octet-stream';
      const contentLength = gatewayResponse.headers.get('content-length');

      const cacheControl = 'public, max-age=31536000, immutable'; // IPFS is immutable

      return new NextResponse(gatewayResponse.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': contentLength || '',
          'Cache-Control': cacheControl,
          'Access-Control-Allow-Origin': '*',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('⏱️ IPFS proxy timeout (30s exceeded)');
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }

      console.error(`❌ IPFS proxy error: ${error.message}`);
      return NextResponse.json(
        { error: `Failed to fetch IPFS content: ${error.message}` },
        { status: 500 }
      );
    }

    console.error('❌ Unknown IPFS proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch IPFS content' },
      { status: 500 }
    );
  }
}