import { NextRequest, NextResponse } from 'next/server';
import { create } from '@web3-storage/w3up-client';
import * as Delegation from '@web3-storage/w3up-client/delegation';
import { StoreMemory } from '@web3-storage/w3up-client/stores/memory';
import * as Signer from '@ucanto/principal/ed25519';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // 1. Validate Environment Configuration
    const proof = process.env.W3_PROOF;
    const principalKey = process.env.W3_PRINCIPAL;

    if (!proof || !principalKey) {
      console.error('❌ Configuration missing: W3_PROOF or W3_PRINCIPAL not set');
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

    // 3. Parse the Principal (Private Key)
    let principal;
    try {
      principal = Signer.parse(principalKey);
    } catch (e) {
      console.error('❌ Failed to parse W3_PRINCIPAL:', e);
      return NextResponse.json(
        { error: 'Server configuration error (Invalid Key)' },
        { status: 500 }
      );
    }

    // 4. Initialize Client with Specific Identity
    const client = await create({
      principal,
      store: new StoreMemory()
    });

    // 5. Apply Delegation Proof
    try {
      const binaryProof = parseProof(proof);
      const delegation = await Delegation.extract(binaryProof);

      if (!delegation.ok) {
        throw new Error('Failed to extract delegation', { cause: delegation.error });
      }

      await client.addProof(delegation.ok as any);
      await client.setCurrentSpace(delegation.ok.capabilities[0].with as any);
    } catch (e) {
      console.error('❌ Proof validation failed:', e);
      return NextResponse.json(
        { error: 'Invalid storage credentials or delegation' },
        { status: 500 }
      );
    }

    // 6. Upload File
    console.log(`📤 Uploading file: ${file.name}`);
    const directoryCid = await client.uploadDirectory([file]);

    // 7. Generate URL
    const url = `https://${directoryCid.toString()}.ipfs.w3s.link/${encodeURIComponent(file.name)}`;
    console.log('✅ Upload successful:', url);

    return NextResponse.json({ url });

  } catch (error) {
    console.error('❌ Upload handler error:', error);
    return NextResponse.json(
      { error: 'Internal upload failed' },
      { status: 500 }
    );
  }
}

function parseProof(data: string) {
  try {
    return new Uint8Array(Buffer.from(data, 'base64'));
  } catch (e) {
    throw new Error('Invalid proof format. Ensure it is base64 encoded.');
  }
}