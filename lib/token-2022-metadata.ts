import { Connection, PublicKey } from '@solana/web3.js';
import {
  getMint,
  getMetadataPointerState,
  getTokenMetadata,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

export interface Token2022Metadata {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Fetch metadata from Helius RPC API (works for any token)
 * This is more reliable than on-chain metadata parsing
 */
async function fetchMetadataFromHelius(
  mint: string,
  heliusKey?: string
): Promise<Token2022Metadata | null> {
  try {
    if (!heliusKey) {
      return null;
    }

    const response = await fetch('https://mainnet.helius-rpc.com/?api-key=' + heliusKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: { id: mint },
      }),
    });

    const data = await response.json();
    const asset = data.result;

    if (asset?.content?.metadata) {
      return {
        name: asset.content.metadata.name || '',
        symbol: asset.content.metadata.symbol || '',
        decimals: asset.decimals || 6,
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Try Token 2022 metadata extraction
 */
async function tryToken2022Metadata(
  connection: Connection,
  mintPubKey: PublicKey
): Promise<Token2022Metadata | null> {
  try {
    const mintInfo = await getMint(
      connection,
      mintPubKey,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    const metadataPointer = getMetadataPointerState(mintInfo);

    if (!metadataPointer?.metadataAddress) {
      return null;
    }

    const tokenMetadata = await getTokenMetadata(
      connection,
      metadataPointer.metadataAddress,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    if (!tokenMetadata) {
      return null;
    }

    return {
      name: tokenMetadata.name || '',
      symbol: tokenMetadata.symbol || '',
      decimals: mintInfo.decimals || 6,
    };
  } catch (error) {
    // Silently fail - token is not Token 2022
    return null;
  }
}

/**
 * Fetch metadata from any token (Token 2022 or regular SPL)
 * Uses multiple strategies:
 * 1. Token 2022 metadata extension
 * 2. Helius API (works for most tokens with on-chain metadata)
 * 3. Fallback to null (pool symbol will be used)
 */
export async function fetchToken2022Metadata(
  connection: Connection,
  mint: PublicKey | string,
  heliusKey?: string
): Promise<Token2022Metadata | null> {
  try {
    const mintPubKey = typeof mint === 'string' ? new PublicKey(mint) : mint;
    const mintStr = typeof mint === 'string' ? mint : mint.toBase58();

    // Strategy 1: Try Token 2022 metadata
    const token2022Metadata = await tryToken2022Metadata(connection, mintPubKey);
    if (token2022Metadata?.symbol) {
      return token2022Metadata;
    }

    // Strategy 2: Try Helius API (works for most tokens with metadata)
    if (heliusKey) {
      const heliusMetadata = await fetchMetadataFromHelius(mintStr, heliusKey);
      if (heliusMetadata?.symbol) {
        return heliusMetadata;
      }
    }

    // Strategy 3: Fallback - return null, will use pool symbol
    return null;
  } catch (error) {
    console.warn(`[Metadata] Error fetching metadata for ${mint}:`, error);
    return null;
  }
}

/**
 * Batch fetch metadata for multiple tokens
 */
export async function fetchMultipleToken2022Metadata(
  connection: Connection,
  mints: string[],
  heliusKey?: string
): Promise<Map<string, Token2022Metadata>> {
  const results = new Map<string, Token2022Metadata>();

  console.log(`[Metadata] Fetching metadata for ${mints.length} tokens...`);
  const startTime = Date.now();

  const concurrency = 15;
  for (let i = 0; i < mints.length; i += concurrency) {
    const batch = mints.slice(i, i + concurrency);

    const promises = batch.map(mint =>
      fetchToken2022Metadata(connection, mint, heliusKey)
        .then(metadata => ({ mint, metadata }))
        .catch(() => ({ mint, metadata: null }))
    );

    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ mint, metadata }) => {
      if (metadata?.symbol) {
        results.set(mint, metadata);
        console.log(`  ✅ ${mint.substring(0, 8)}: ${metadata.symbol}`);
      }
    });
  }

  const elapsed = Date.now() - startTime;
  console.log(`[Metadata] ✅ Got metadata for ${results.size}/${mints.length} tokens in ${elapsed}ms`);

  return results;
}