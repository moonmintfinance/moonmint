// app/api/upload/route.ts (SECURE VERSION)
import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const runtime = 'nodejs';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_JSON_TYPES = ['application/json'];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_JSON_TYPES];
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_JSON_SIZE = 100 * 1024; // 100KB for JSON

const MAGIC_NUMBERS: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

/**
 * Validates metadata JSON structure and content
 */
function validateMetadataJson(jsonObj: any): { valid: boolean; error?: string } {
  // Check required fields
  if (!jsonObj.name || typeof jsonObj.name !== 'string') {
    return { valid: false, error: 'Metadata must contain a valid "name" field' };
  }

  if (!jsonObj.symbol || typeof jsonObj.symbol !== 'string') {
    return { valid: false, error: 'Metadata must contain a valid "symbol" field' };
  }

  // Validate string lengths
  if (jsonObj.name.length > 200) {
    return { valid: false, error: 'Name exceeds maximum length (200 characters)' };
  }

  if (jsonObj.symbol.length > 20) {
    return { valid: false, error: 'Symbol exceeds maximum length (20 characters)' };
  }

  // Validate description if present
  if (jsonObj.description && typeof jsonObj.description !== 'string') {
    return { valid: false, error: 'Description must be a string' };
  }

  if (jsonObj.description && jsonObj.description.length > 1000) {
    return { valid: false, error: 'Description exceeds maximum length (1000 characters)' };
  }

  // Validate image URI if present
  if (jsonObj.image) {
    if (typeof jsonObj.image !== 'string') {
      return { valid: false, error: 'Image must be a string' };
    }

    const validImageUri = jsonObj.image.startsWith('ipfs://') ||
                         jsonObj.image.startsWith('https://') ||
                         jsonObj.image.startsWith('http://');

    if (!validImageUri) {
      return { valid: false, error: 'Image must be an IPFS or HTTP(S) URI' };
    }

    // Check for suspicious domains
    if (jsonObj.image.includes('http')) {
      try {
        const url = new URL(jsonObj.image);
        if (isSuspiciousDomain(url.hostname)) {
          return { valid: false, error: 'Image URL contains suspicious domain' };
        }
      } catch (e) {
        return { valid: false, error: 'Invalid image URL format' };
      }
    }
  }

  // Validate decimals if present
  if (jsonObj.decimals !== undefined) {
    if (typeof jsonObj.decimals !== 'number' || jsonObj.decimals < 0 || jsonObj.decimals > 18) {
      return { valid: false, error: 'Decimals must be a number between 0 and 18' };
    }
  }

  // Check for suspicious content patterns (basic XSS/injection detection)
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onload, etc.
    /eval\(/i,
  ];

  const allText = JSON.stringify(jsonObj);
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(allText)) {
      return { valid: false, error: 'Metadata contains suspicious content patterns' };
    }
  }

  return { valid: true };
}

/**
 * Basic check for suspicious domains (phishing, malware, etc.)
 */
function isSuspiciousDomain(hostname: string): boolean {
  const blocklist = [
    'bit.ly', // Known shortener used in phishing
    'tinyurl.com',
    'goo.gl',
    // Add more as needed
  ];

  return blocklist.some(domain => hostname.includes(domain));
}

async function validateImageFile(file: File): Promise<{ valid: boolean; error?: string }> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, GIF, WebP, or JSON allowed.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large. Maximum 4MB.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' };
  }

  // JSON-specific validation
  if (ALLOWED_JSON_TYPES.includes(file.type)) {
    if (file.size > MAX_JSON_SIZE) {
      return { valid: false, error: 'JSON file too large. Maximum 100KB.' };
    }

    try {
      const jsonText = await file.text();
      const jsonObj = JSON.parse(jsonText);

      // Validate metadata structure
      const validation = validateMetadataJson(jsonObj);
      if (!validation.valid) {
        return validation;
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid JSON format' };
    }
  }

  // Image validation with magic numbers
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