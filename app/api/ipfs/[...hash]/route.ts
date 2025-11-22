// ============================================
// FILE: app/api/ipfs/[...hash]/route.ts
// ============================================
// ✅ Updated to use Pinata V3 SDK (no JWT on gateway endpoint)
import { NextRequest, NextResponse } from 'next/server';
import { PinataSDK } from 'pinata';

// Initialize Pinata SDK once (reused across requests)
let pinata: PinataSDK | null = null;

function getPinataClient(): PinataSDK {
  if (!pinata) {
    const jwt = process.env.PINATA_JWT;
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY;

    if (!jwt || !gateway) {
      throw new Error('Missing PINATA_JWT or NEXT_PUBLIC_PINATA_GATEWAY environment variables');
    }

    pinata = new PinataSDK({
      pinataJwt: jwt,
      pinataGateway: gateway,
    });
  }

  return pinata;
}

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

    console.log(`📡 Fetching IPFS content: ${hashStr}`);

    const pinataClient = getPinataClient();

    // ✅ SDK handles gateway logic automatically (no manual JWT headers)
    const data = await pinataClient.gateways.public.get(hashStr);

    console.log(`✅ Successfully fetched: ${hashStr}`);

    // Determine content type from data or use default
    const contentType = (() => {
      if (data instanceof Blob) return data.type || 'application/octet-stream';
      if (data instanceof ArrayBuffer) return 'application/octet-stream';
      return 'application/octet-stream';
    })();

    const cacheControl = 'public, max-age=31536000, immutable'; // IPFS content is immutable

    return new NextResponse(data instanceof Blob ? data.stream() : data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('⏱️ IPFS proxy timeout');
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }

      if (error.message.includes('404') || error.message.includes('not found')) {
        console.error(`❌ IPFS content not found: ${error.message}`);
        return NextResponse.json(
          { error: 'Content not found on IPFS' },
          { status: 404 }
        );
      }

      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.error(`❌ Gateway access denied: ${error.message}`);
        return NextResponse.json(
          { error: 'Access denied - check Gateway Access Controls' },
          { status: 401 }
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