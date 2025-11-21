'use client';

import { useEffect, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getMint, getMetadataPointerState, getTokenMetadata } from '@solana/spl-token';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import Image from 'next/image';
import { SOLANA_RPC_ENDPOINT, METEORA_CONFIG } from '@/lib/constants';

interface PoolInfo {
  address: string;
  baseMint: string;
  creator: string;
  name?: string;
  symbol?: string;
  progress: number;
  imageUrl?: string;
}

// Dedicated Gateway from Environment
const DEDICATED_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY;

// IPFS Gateway priorities (fallback list)
const IPFS_GATEWAYS = [
  // ✅ Prioritize dedicated gateway if available
  ...(DEDICATED_GATEWAY ? [`${DEDICATED_GATEWAY}/ipfs`] : []),
  'https://gateway.pinata.cloud/ipfs',
  'https://ipfs.io/ipfs',
  'https://gateway.ipfs.io/ipfs',
  'https://nft.storage/ipfs',
  'https://w3s.link/ipfs',
];

/**
 * Converts IPFS URI to HTTP gateway URL
 * Handles both ipfs:// and direct hash formats
 */
function convertIpfsToHttp(uri: string): string {
  if (!uri) return '';

  // If it's already an HTTP URL
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    // Optimization: If it's using the public pinata gateway, switch to dedicated
    if (DEDICATED_GATEWAY && uri.includes('gateway.pinata.cloud')) {
      return uri.replace('https://gateway.pinata.cloud', DEDICATED_GATEWAY);
    }
    return uri;
  }

  // Extract IPFS hash
  let hash = uri;
  if (uri.startsWith('ipfs://')) {
    hash = uri.replace('ipfs://', '');
  } else if (uri.startsWith('/ipfs/')) {
    hash = uri.replace('/ipfs/', '');
  }

  // Return with first gateway (which is now your dedicated one)
  return `${IPFS_GATEWAYS[0]}/${hash}`;
}

/**
 * Fetches JSON metadata from a URI with IPFS support
 * ✅ FIXED: Now handles both JSON metadata files AND direct image URIs
 *
 * Some tokens store: uri = JSON metadata file (contains "image" field)
 * Other tokens store: uri = Direct image URL (the URI IS the image)
 */
async function fetchMetadataJson(uri: string | undefined): Promise<{ image?: string; description?: string }> {
  try {
    if (!uri || typeof uri !== 'string') {
      return {};
    }

    console.log(`📥 Fetching metadata from: ${uri}`);

    // Convert IPFS URI to HTTP
    const httpUrl = convertIpfsToHttp(uri);
    console.log(`🔗 Using URL: ${httpUrl}`);

    // Try primary gateway
    try {
      console.log(`⏳ Attempting fetch with 5s timeout...`);
      const response = await fetch(httpUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      console.log(`📊 Response status: ${response.status} ${response.statusText}`);
      console.log(`📋 Content-Type: ${response.headers.get('content-type')}`);

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';

        // ✅ FIXED: Check if response is an image (not JSON)
        if (contentType.includes('image/')) {
          console.log(`🖼️  Response is a direct image! Using URI as image URL.`);
          return {
            image: httpUrl, // The URI itself IS the image
            description: undefined,
          };
        }

        // Otherwise, try to parse as JSON
        try {
          const data = await response.json();
          console.log(`✅ Fetched metadata JSON:`, data);

          // Convert image URL if it's IPFS
          let imageUrl = data.image;
          if (imageUrl) {
            console.log(`🖼️  Found image in metadata:`, imageUrl);
            imageUrl = convertIpfsToHttp(imageUrl);
            console.log(`🔗 Converted image URL:`, imageUrl);
          } else {
            console.log(`⚠️  No image field in metadata JSON`);
          }

          return {
            image: imageUrl || undefined,
            description: data.description || undefined,
          };
        } catch (parseErr) {
          console.error(`❌ Failed to parse JSON response:`, parseErr);

          // ✅ Last resort: if it looks like an image, try using the URL directly
          if (uri.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
            console.log(`🖼️  URI has image extension, using as image URL`);
            return {
              image: httpUrl,
              description: undefined,
            };
          }

          try {
            const text = await response.text();
            console.log(`📋 Raw response (first 300 chars):`, text.substring(0, 300));
          } catch (e) {
            console.log(`(Could not read response body)`);
          }
        }
      } else {
        console.warn(`❌ HTTP Error ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.warn(`⚠️  Primary gateway failed:`, err instanceof Error ? err.message : String(err));
      console.warn(`⏫ Trying alternative gateways...`);

      // Try alternative gateways for IPFS
      if (uri.startsWith('ipfs://') || uri.startsWith('/ipfs/')) {
        const hash = uri.replace('ipfs://', '').replace('/ipfs/', '');
        console.log(`🔍 Extracted IPFS hash: ${hash}`);

        for (let i = 1; i < IPFS_GATEWAYS.length; i++) {
          const gateway = IPFS_GATEWAYS[i];
          try {
            const altUrl = `${gateway}/${hash}`;
            console.log(`🔄 Trying gateway ${i}: ${gateway}`);

            const response = await fetch(altUrl, {
              method: 'GET',
              signal: AbortSignal.timeout(3000),
            });

            console.log(`📊 Gateway ${i} response: ${response.status}`);

            if (response.ok) {
              const contentType = response.headers.get('content-type') || '';

              // ✅ Check if it's an image
              if (contentType.includes('image/')) {
                console.log(`✅ Gateway ${i} returned image! Using as image URL.`);
                return {
                  image: altUrl,
                  description: undefined,
                };
              }

              try {
                const data = await response.json();
                console.log(`✅ Success with gateway ${i}!`, data);

                let imageUrl = data.image;
                if (imageUrl) {
                  imageUrl = convertIpfsToHttp(imageUrl);
                }
                return {
                  image: imageUrl || undefined,
                  description: data.description || undefined,
                };
              } catch (parseErr) {
                console.warn(`⚠️  Gateway ${i} returned invalid JSON`);

                // ✅ If it's an image by extension, use it
                if (hash.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
                  console.log(`🖼️  Hash has image extension, using gateway URL as image`);
                  return {
                    image: altUrl,
                    description: undefined,
                  };
                }
              }
            }
          } catch (e) {
            console.log(`⚠️  Gateway ${i} failed:`, e instanceof Error ? e.message : String(e));
            continue; // Try next gateway
          }
        }
        console.error(`❌ All gateways failed for hash: ${hash}`);
      }
    }

    return {};
  } catch (error) {
    console.error(`❌ Unexpected error in fetchMetadataJson:`, error);
    return {};
  }
}

/**
 * Fetches Token 2022 metadata directly from the blockchain
 * ✅ FIXED: Now handles the nested data structure and IPFS image URLs
 *
 * Metadata structure:
 * {
 * mint: PublicKey,
 * updateAuthority: PublicKey,
 * data: {
 * name: string,
 * symbol: string,
 * uri: string,
 * ...
 * }
 * }
 */
async function fetchToken2022Metadata(
  connection: Connection,
  mintAddress: PublicKey
): Promise<{ name?: string; symbol?: string; imageUrl?: string; description?: string }> {
  try {
    // 1. Get the mint account to check for MetadataPointer extension
    const mintAccount = await getMint(
      connection,
      mintAddress,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    // 2. Get the metadata pointer state
    const metadataPointer = getMetadataPointerState(mintAccount);

    if (!metadataPointer?.metadataAddress) {
      console.debug('⚠️  No metadata pointer found for mint:', mintAddress.toBase58());
      return {};
    }

    // 3. Fetch the actual Token 2022 metadata
    const metadata = await getTokenMetadata(
      connection,
      metadataPointer.metadataAddress,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    if (!metadata) {
      return {};
    }

    console.debug('📋 Raw metadata:', metadata);

    // ✅ FIXED: Handle nested data structure
    // The metadata can be structured as:
    // - metadata.data.name (nested)
    // - metadata.name (flat)
    const name = (metadata as any)?.data?.name || (metadata as any)?.name;
    const symbol = (metadata as any)?.data?.symbol || (metadata as any)?.symbol;
    const uri = (metadata as any)?.data?.uri || (metadata as any)?.uri;

    console.debug(`🏷️  Found - Name: ${name}, Symbol: ${symbol}, URI: ${uri}`);

    // 4. If there's a URI, fetch the JSON metadata to get the image
    let imageUrl: string | undefined;
    let description: string | undefined;

    if (uri) {
      const jsonMetadata = await fetchMetadataJson(uri);
      imageUrl = jsonMetadata.image;
      description = jsonMetadata.description;
      console.log(`🖼️  Image URL: ${imageUrl || 'None'}`);
    }

    return {
      name,
      symbol,
      imageUrl,
      description,
    };
  } catch (error) {
    console.error('❌ Error fetching Token 2022 metadata for', mintAddress.toBase58(), error);
    return {};
  }
}

export function MeteoraPools() {
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPools = async () => {
      try {
        if (!METEORA_CONFIG.ENABLED || !METEORA_CONFIG.CONFIG_KEY) {
          setError('Meteora config not configured');
          return;
        }

        // Convert relative RPC path to absolute URL
        let endpoint = SOLANA_RPC_ENDPOINT;
        if (endpoint.startsWith('/')) {
          const origin = typeof window !== 'undefined'
            ? window.location.origin
            : 'http://localhost:3000';
          endpoint = `${origin}${endpoint}`;
        }

        const connection = new Connection(endpoint);
        const client = new DynamicBondingCurveClient(connection, null as any);

        // Fetch only pools created with YOUR config key
        const configKey = new PublicKey(METEORA_CONFIG.CONFIG_KEY);
        const allPools = await client.state.getPoolsByConfig(configKey);

        console.log('✅ Got pools from SDK. Count:', allPools.length);

        // Get Token 2022 metadata (including images) for each pool
        const poolsWithInfo = await Promise.all(
          allPools.map(async (poolItem) => {
            try {
              const poolAddress = (poolItem as any).publicKey as string | PublicKey;
              const pool = (poolItem as any).account as any;

              if (!poolAddress || !pool) {
                console.warn('Invalid pool structure - missing address or account');
                return null;
              }

              const poolPubKey = typeof poolAddress === 'string'
                ? new PublicKey(poolAddress)
                : poolAddress;

              // Get pool progress
              const progress = await client.state.getPoolCurveProgress(poolPubKey);

              // Extract baseMint
              const baseMint = pool.baseMint;
              const baseMintPubKey = typeof baseMint === 'string'
                ? new PublicKey(baseMint)
                : baseMint;

              // ✅ FETCH TOKEN 2022 METADATA (including image)
              const token2022Metadata = await fetchToken2022Metadata(connection, baseMintPubKey);

              const name = token2022Metadata.name || 'Unknown Token';
              const symbol = token2022Metadata.symbol || '???';
              const imageUrl = token2022Metadata.imageUrl;

              const creator = pool.creator;

              return {
                address: poolPubKey.toBase58?.() || String(poolAddress),
                baseMint: typeof baseMint === 'string' ? baseMint : baseMint?.toBase58?.() || String(baseMint),
                creator: typeof creator === 'string' ? creator : creator?.toBase58?.() || String(creator),
                name,
                symbol,
                imageUrl,
                progress: Math.round(progress * 100),
              };
            } catch (err) {
              console.error('Error fetching pool info:', err);
              return null;
            }
          })
        );

        // Filter out failed fetches
        const validPools = poolsWithInfo
          .filter((p) => p !== null) as PoolInfo[];

        console.log('✅ Valid pools with metadata and images:', validPools.length);
        setPools(validPools);
      } catch (err) {
        console.error('Error fetching pools:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch pools');
      } finally {
        setLoading(false);
      }
    };

    void fetchPools();
  }, []);

  return (
    <div className="flex-grow container mx-auto px-6 pt-24 pb-20 max-w-6xl">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Recently Launched Tokens
        </h1>
        <p className="text-gray-400">
          Discover tokens launched on Moon Mint bonding curves
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block">
            <svg className="animate-spin h-12 w-12 text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-400 mt-4">Loading tokens...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Pools Grid */}
      {!loading && !error && pools.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pools.map((pool) => (
            <a
              key={pool.address}
              href={`/pools/${pool.baseMint}`}
              className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 hover:border-primary-500/50 rounded-xl overflow-hidden transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary-500/10 group flex flex-col"
            >
              {/* Token Image - ANIMATED GRADIENT BACKGROUND */}
              <div className="relative w-full aspect-video animate-gradient-bg overflow-hidden border-b border-dark-200 flex items-center justify-center flex-shrink-0">
                {pool.imageUrl ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={pool.imageUrl}
                      alt={pool.name || 'Token'}
                      fill
                      className="object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-lg"
                      priority={false}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      onError={(e) => {
                        // Fallback if image fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-white/80">
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-semibold">No Image</span>
                  </div>
                )}
              </div>

              {/* Token Content */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                {/* Token Header */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white truncate">
                      {pool.name}
                    </h3>
                    <span className="bg-primary-500/20 text-primary-400 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2">
                      {pool.symbol}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono truncate">
                    {pool.baseMint}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">Progress to DEX Migration</span>
                    <span className="text-sm font-semibold text-primary-400">
                      {pool.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-dark-50 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pool.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Creator */}
                <div className="text-xs text-gray-400 mb-4">
                  <span>Creator: </span>
                  <span className="font-mono">
                    {pool.creator.slice(0, 8)}...{pool.creator.slice(-8)}
                  </span>
                </div>

                {/* CTA */}
                <div className="pt-4 border-t border-dark-200">
                  <button className="w-full text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors">
                    Trade Now →
                  </button>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && pools.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No tokens launched yet</p>
          <a
            href="/#mint"
            className="inline-block bg-primary-500 hover:bg-primary-600 text-white font-medium py-3 px-8 rounded-lg transition-colors"
          >
            Be the First to Launch
          </a>
        </div>
      )}
    </div>
  );
}