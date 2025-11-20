import { NextRequest, NextResponse } from 'next/server';
import { create } from '@web3-storage/w3up-client';
import * as Delegation from '@web3-storage/w3up-client/delegation';
import { StoreMemory } from '@web3-storage/w3up-client/stores/memory';

export const runtime = 'nodejs'; // Ensure we run in Node.js environment for file handling

export async function POST(request: NextRequest) {
  try {
    // 1. Validate Environment Configuration
    // NOTE: We use W3_PROOF here, NOT NEXT_PUBLIC_W3_PROOF
    const proof = process.env.W3_PROOF;
    if (!proof) {
      return NextResponse.json(
        { error: 'Storage configuration missing on server' },
        { status: 500 }
      );
    }

    // 2. Parse Form Data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 3. Initialize Web3.Storage Client
    // We use StoreMemory to avoid trying to write config files in a serverless environment
    const client = await create({ store: new StoreMemory() });

    // 4. Apply Delegation Proof
    try {
      const binaryProof = parseProof(proof);
      const delegation = await Delegation.extract(binaryProof);

      if (!delegation.ok) {
        throw new Error('Failed to extract delegation', { cause: delegation.error });
      }

      // FIX: Cast to 'any' to bypass TypeScript strict DID branding mismatch.
      // The runtime value is correct, but TS expects a specific branded string type.
      await client.addProof(delegation.ok as any);
      await client.setCurrentSpace(delegation.ok.capabilities[0].with as any);
    } catch (e) {
      console.error('Proof validation failed:', e);
      return NextResponse.json(
        { error: 'Invalid storage credentials' },
        { status: 500 }
      );
    }

    // 5. Upload File
    // The client expects an array of files
    const directoryCid = await client.uploadDirectory([file]);

    // 6. Generate URL
    const url = `https://${directoryCid.toString()}.ipfs.w3s.link/${encodeURIComponent(file.name)}`;

    return NextResponse.json({ url });

  } catch (error) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { error: 'Internal upload failed' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Decode base64 proof to Uint8Array
 */
function parseProof(data: string) {
  try {
    const binaryString = atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    throw new Error('Invalid proof format. Ensure it is base64 encoded.');
  }
}