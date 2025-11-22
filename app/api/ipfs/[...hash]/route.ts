// ============================================
// FILE: app/api/ipfs/[...hash]/route.ts
// ============================================
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

    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      console.error('❌ Missing PINATA_JWT');
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      );
    }

    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud';
    const url = `${gateway}/ipfs/${hashStr}`;

    console.log(`📡 Proxying IPFS request: ${hashStr}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error(`❌ Gateway returned ${response.status} for ${hashStr}`);
      return NextResponse.json(
        { error: `Gateway error: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const cacheControl = 'public, max-age=31536000, immutable'; // IPFS content is immutable

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏱️ IPFS proxy timeout');
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    console.error('❌ IPFS proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch IPFS content' },
      { status: 500 }
    );
  }
}