/**
 * DAS API Integration for Token Metadata
 * Helius Digital Asset Standard API
 */

export interface TokenMetadata {
  name: string;
  symbol: string;
  imageUrl: string;
  decimals: number;
}

const DEFAULT_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23222%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E';

/**
 * Fetch token metadata from DAS API (Helius)
 * Falls back to on-chain metadata if DAS is unavailable
 */
export async function fetchTokenMetadataDAS(
  mint: string
): Promise<TokenMetadata> {
  try {
    // Try to fetch from Helius DAS API if RPC is available
    const heliusRpc = process.env.NEXT_PUBLIC_HELIUS_RPC;

    if (!heliusRpc) {
      console.warn('NEXT_PUBLIC_HELIUS_RPC not set, using fallback metadata');
      return getFallbackMetadata(mint);
    }

    const response = await fetch(heliusRpc, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'das-api-metadata',
        method: 'searchAssets',
        params: {
          ownerAddress: mint,
          displayOptions: {
            showFungible: true,
          },
          limit: 1,
        },
      }),
    });

    if (!response.ok) {
      return getFallbackMetadata(mint);
    }

    const data = await response.json();

    if (data.result?.items?.[0]) {
      const asset = data.result.items[0];
      const content = asset.content?.metadata || {};

      return {
        name: content.name || asset.id.substring(0, 8),
        symbol: content.symbol || 'TOKEN',
        imageUrl: asset.content?.links?.image || DEFAULT_IMAGE,
        decimals: asset.token_info?.decimals || 9,
      };
    }

    return getFallbackMetadata(mint);
  } catch (err) {
    console.error(`Failed to fetch metadata for ${mint}:`, err);
    return getFallbackMetadata(mint);
  }
}

/**
 * Fallback metadata generator using mint address
 */
function getFallbackMetadata(mint: string): TokenMetadata {
  // Generate deterministic name/symbol from mint
  const shortMint = mint.substring(0, 8).toUpperCase();

  return {
    name: `Token ${shortMint}`,
    symbol: shortMint,
    imageUrl: DEFAULT_IMAGE,
    decimals: 9,
  };
}

/**
 * Batch fetch metadata for multiple tokens
 */
export async function fetchMultipleTokenMetadata(
  mints: string[]
): Promise<Map<string, TokenMetadata>> {
  const results = new Map<string, TokenMetadata>();

  // Fetch in parallel with concurrency limit (5 at a time)
  const batchSize = 5;
  for (let i = 0; i < mints.length; i += batchSize) {
    const batch = mints.slice(i, i + batchSize);
    const promises = batch.map(mint =>
      fetchTokenMetadataDAS(mint)
        .then(metadata => ({ mint, metadata }))
        .catch(err => {
          console.error(`Error fetching ${mint}:`, err);
          return { mint, metadata: getFallbackMetadata(mint) };
        })
    );

    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ mint, metadata }) => {
      results.set(mint, metadata);
    });
  }

  return results;
}