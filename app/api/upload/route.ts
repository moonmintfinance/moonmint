import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('\n🚀 Pinata Upload Request Started');
  const startTime = Date.now();

  try {
    // Get JWT token from environment
    const jwt = process.env.PINATA_JWT;

    if (!jwt) {
      console.error('❌ Missing PINATA_JWT');
      return NextResponse.json(
        { error: 'Server not configured with Pinata JWT token' },
        { status: 500 }
      );
    }

    console.log('✓ Pinata JWT found');

    // Parse uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('❌ No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log(`✓ File received: ${file.name} (${file.size} bytes)`);

    // Prepare FormData for Pinata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);

    const metadata = {
      name: file.name,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        service: 'moon-mint',
      },
    };
    pinataFormData.append('pinataMetadata', JSON.stringify(metadata));

    // Upload to Pinata using JWT authentication
    console.log('📤 Uploading to Pinata...');
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
      },
      body: pinataFormData,
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('❌ Pinata API error:', pinataResponse.status, errorText);
      return NextResponse.json(
        { error: `Pinata upload failed: ${pinataResponse.status}` },
        { status: 500 }
      );
    }

    const pinataData = await pinataResponse.json();

    if (!pinataData.IpfsHash) {
      console.error('❌ No IPFS hash in Pinata response');
      return NextResponse.json(
        { error: 'Invalid response from Pinata' },
        { status: 500 }
      );
    }

    console.log(`✓ Upload successful! IPFS Hash: ${pinataData.IpfsHash}`);

    const url = `https://gateway.pinata.cloud/ipfs/${pinataData.IpfsHash}`;

    const duration = Date.now() - startTime;
    console.log(`✅ Upload completed in ${duration}ms`);
    console.log(`📍 URL: ${url}\n`);

    return NextResponse.json({ url });

  } catch (error) {
    console.error('❌ Upload failed:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: String(error) },
      { status: 500 }
    );
  }
}