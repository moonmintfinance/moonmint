// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

const MAGIC_NUMBERS: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

async function validateImageFile(file: File): Promise<{ valid: boolean; error?: string }> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, GIF, WebP allowed.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large. Maximum 4MB.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' };
  }

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const magicNumbers = MAGIC_NUMBERS[file.type];

    if (!magicNumbers) {
      return { valid: false, error: 'Unknown file type.' };
    }

    const matches = magicNumbers.every((byte, i) => bytes[i] === byte);
    if (!matches) {
      return { valid: false, error: 'File content does not match declared type.' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Failed to read file.' };
  }
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.+/g, '.')
    .substring(0, 100);
}

/**
 * Verify wallet signature to prove ownership
 * This prevents spam uploads - only wallet owners can upload
 */
function verifyWalletSignature(
  message: string,
  signatureBase58: string,
  publicKeyString: string
): boolean {
  try {
    const signature = bs58.decode(signatureBase58);
    const publicKey = new PublicKey(publicKeyString).toBytes();
    const messageBytes = new TextEncoder().encode(message);

    return nacl.sign.detached.verify(messageBytes, signature, publicKey);
  } catch (error) {
    console.error('❌ Signature verification failed:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  console.log('\n🚀 Pinata Upload Request Started');

  try {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      console.error('❌ Missing PINATA_JWT');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const message = formData.get('message') as string;
    const signature = formData.get('signature') as string;
    const publicKey = formData.get('publicKey') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // ✅ CRITICAL: Verify wallet signature (prevents spam)
    if (!message || !signature || !publicKey) {
      console.error('❌ Missing authentication data');
      return NextResponse.json(
        { error: 'Missing wallet authentication. Please connect your wallet.' },
        { status: 401 }
      );
    }

    console.log(`📥 File: ${file.name} (${file.size} bytes)`);
    console.log(`🔑 Wallet: ${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`);

    // Verify signature
    const isValidSignature = verifyWalletSignature(message, signature, publicKey);
    if (!isValidSignature) {
      console.error('❌ Invalid wallet signature');
      return NextResponse.json(
        { error: 'Invalid wallet signature. Please reconnect your wallet.' },
        { status: 403 }
      );
    }

    console.log('✅ Wallet signature verified');

    // Check timestamp (prevent replay attacks)
    const messageParts = message.split('|');
    if (messageParts.length !== 2) {
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
    }

    const timestamp = parseInt(messageParts[1]);
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - timestamp > fiveMinutes) {
      console.error('❌ Signature expired');
      return NextResponse.json(
        { error: 'Signature expired. Please try again.' },
        { status: 403 }
      );
    }

    console.log('✅ Timestamp valid');

    // Validate file
    const validation = await validateImageFile(file);
    if (!validation.valid) {
      console.error(`❌ Validation failed: ${validation.error}`);
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    console.log('✅ File validation passed');

    // Upload to Pinata (only if wallet verified)
    const safeName = sanitizeFilename(file.name);
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);

    const metadata = {
      name: safeName,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        service: 'moon-mint',
        wallet: publicKey,
        originalName: safeName,
        mimeType: file.type,
      },
    };
    pinataFormData.append('pinataMetadata', JSON.stringify(metadata));

    console.log('📤 Uploading to Pinata...');
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataFormData,
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('❌ Pinata error:', pinataResponse.status, errorText);
      return NextResponse.json(
        { error: `Upload failed: ${pinataResponse.status}` },
        { status: 500 }
      );
    }

    const pinataData = await pinataResponse.json();
    if (!pinataData.IpfsHash) {
      return NextResponse.json({ error: 'Invalid Pinata response' }, { status: 500 });
    }

    // ✅ Use dedicated gateway for the returned URL
    // Falls back to public gateway if env var is missing
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud';
    const url = `${gateway}/ipfs/${pinataData.IpfsHash}`;

    console.log(`✅ Upload successful: ${url}\n`);

    // ✅ UPDATED: Return both url AND IpfsHash for metadata service
    return NextResponse.json({
      url,
      IpfsHash: pinataData.IpfsHash
    });
  } catch (error) {
    console.error('❌ Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}