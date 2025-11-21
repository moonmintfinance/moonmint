// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

// Magic number validation (checks actual file signature)
const MAGIC_NUMBERS: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

async function validateImageFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // 1. Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, GIF, WebP allowed.' };
  }

  // 2. Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large. Maximum 4MB.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' };
  }

  // 3. Validate magic numbers (file signature)
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const magicNumbers = MAGIC_NUMBERS[file.type];

    if (!magicNumbers) {
      return { valid: false, error: 'Unknown file type.' };
    }

    // Check if file starts with expected magic numbers
    const matches = magicNumbers.every((byte, i) => bytes[i] === byte);
    if (!matches) {
      return { valid: false, error: 'File content does not match declared type. Possible spoofing attempt.' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Failed to read file.' };
  }
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Remove special chars
    .replace(/\.+/g, '.') // Remove multiple dots
    .substring(0, 100); // Limit length
}

export async function POST(request: NextRequest) {
  console.log('\n🚀 Pinata Upload Request Started');

  try {
    // 1. Get JWT
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      console.error('❌ Missing PINATA_JWT');
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      );
    }

    // 2. Parse file
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📥 File received: ${file.name} (${file.size} bytes, ${file.type})`);

    // 3. ✅ VALIDATE FILE
    const validation = await validateImageFile(file);
    if (!validation.valid) {
      console.error(`❌ Validation failed: ${validation.error}`);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    console.log('✅ File validation passed');

    // 4. Sanitize filename
    const safeName = sanitizeFilename(file.name);

    // 5. Upload to Pinata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);

    const metadata = {
      name: safeName, // ✅ Sanitized
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        service: 'moon-mint',
        originalName: safeName,
        mimeType: file.type,
      },
    };
    pinataFormData.append('pinataMetadata', JSON.stringify(metadata));

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
        { error: `Upload failed: ${pinataResponse.status}` },
        { status: 500 }
      );
    }

    const pinataData = await pinataResponse.json();

    if (!pinataData.IpfsHash) {
      return NextResponse.json(
        { error: 'Invalid response from Pinata' },
        { status: 500 }
      );
    }

    const url = `https://gateway.pinata.cloud/ipfs/${pinataData.IpfsHash}`;
    console.log(`✅ Upload successful: ${url}\n`);

    return NextResponse.json({ url });

  } catch (error) {
    console.error('❌ Upload failed:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}