'use client';

import { useEffect, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getMint, getMetadataPointerState, getTokenMetadata } from '@solana/spl-token';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import Image from 'next/image';
import { SOLANA_RPC_ENDPOINT, METEORA_CONFIG } from '@/lib/constants';
import {
  getCachedToken2022Metadata,
  setCachedToken2022Metadata,
  getPendingToken2022Request,
  setPendingToken2022Request,
} from '@/lib/metadataCache';

interface PoolInfo {
  address: string;
  baseMint: string;
  creator: string;
  name?: string;
  symbol?: string;
  progress: number;
  imageUrl?: string;
}

interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

type Token2022MetadataResult = {
  name?: string;
  symbol?: string;
  decimals?: number;
  imageUrl?: string;
};

// Dedicated Gateway from Environment - Ensure this is set in .env.local
const DEDICATED_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY;

// IPFS Gateways - Ordered by reliability/speed
const IPFS_GATEWAYS = [
  '/api/ipfs',  // ← Use server proxy with Gateway Key
  'https://gateway.pinata.cloud/ipfs',
  'https://ipfs.io/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://dweb.link/ipfs',
];

/**
 * Converts IPFS URI to HTTP gateway URL using the best available gateway
 */
function convertIpfsToHttp(uri: string, gatewayIndex = 0): string {
  if (!uri) return '';

  let hash = '';

  // Extract hash from various IPFS formats
  if (uri.startsWith('ipfs://')) {
    hash = uri.replace('ipfs://', '');
  } else if (uri.includes('/ipfs/')) {
    const parts = uri.split('/ipfs/');
    if (parts.length > 1) {
      hash = parts[1];
    }
  } else {
    // Assume it's a hash if it's not http
    if (!uri.startsWith('http')) {
      hash = uri;
    }
  }

  // If we found a hash, use the specified gateway
  if (hash) {
    // Clean hash (remove query params)
    hash = hash.split('?')[0];
    const gateway = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
    return `${gateway}/${hash}`;
  }

  // Return original if not an IPFS hash (e.g. standard HTTP URL)
  return uri;
}

/**
 * Fetches the actual image URL from Token 2022 metadata
 * Handles both direct image URLs and metadata JSON URIs
 * ✅ FIXED: Properly extracts image from metadata JSON instead of returning JSON URI
 */
async function extractImageUrl(metadata: any): Promise<string | undefined> {
  try {
    // ✅ Option 1: Direct image URL from DAS API
    if (metadata.content?.links?.image) {
      console.log('📸 Found direct image URL in DAS');
      return convertIpfsToHttp(metadata.content.links.image);
    }

    // ✅ Option 2: Fetch metadata JSON and extract image field
    if (metadata.content?.json_uri) {
      const jsonUri = metadata.content.json_uri;
      const jsonUrl = convertIpfsToHttp(jsonUri);

      console.log(`📄 Fetching metadata JSON from: ${jsonUrl}`);
      try {
        const metadataResponse = await fetch(jsonUrl);
        if (!metadataResponse.ok) {
          console.warn(`⚠️ Failed to fetch metadata JSON: ${metadataResponse.status}`);
          return undefined;
        }

        const metadataJson = await metadataResponse.json();

        // Extract image from metadata JSON
        if (metadataJson.image) {
          console.log('🖼️ Found image URL in metadata JSON');
          return convertIpfsToHttp(metadataJson.image);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to parse metadata JSON:`, err);
        return undefined;
      }
    }

    return undefined;
  } catch (err) {
    console.warn(`⚠️ Error extracting image URL:`, err);
    return undefined;
  }
}

/**
 * Fetches Token Metadata using DAS API
 * ✅ FIXED: Now properly extracts image URLs from metadata JSON
 */
async function fetchTokenMetadataDAS(
  mintAddress: string
): Promise<Token2022MetadataResult> {
  const defaultResult: Token2022MetadataResult = {
    name: 'Unknown Token',
    symbol: '???',
    decimals: 0,
  };

  const cachedData = getCachedToken2022Metadata(mintAddress);
  if (cachedData) {
    return { ...cachedData, decimals: 0 };
  }

  const pendingRequest = getPendingToken2022Request(mintAddress);
  if (pendingRequest) return pendingRequest;

  const promise: Promise<Token2022MetadataResult> = (async () => {
    try {
      const response = await fetch(SOLANA_RPC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'moon-mint-asset-check',
          method: 'getAsset',
          params: {
            id: mintAddress,
            displayOptions: {
              showFungible: true,
              showNativeBalance: false,
            },
          },
        }),
      });

      const { result } = await response.json();

      if (!result) {
        return defaultResult;
      }

      const name = result.content?.metadata?.name || result.token_info?.symbol || 'Unknown Token';
      const symbol = result.content?.metadata?.symbol || result.token_info?.symbol || '???';
      const decimals = result.token_info?.decimals || 0;

      // ✅ FIXED: Properly extract image URL from metadata or JSON
      const imageUrl = await extractImageUrl(result);

      const metadataResult: Token2022MetadataResult = {
        name,
        symbol,
        decimals,
        imageUrl,
      };

      setCachedToken2022Metadata(mintAddress, metadataResult);
      return metadataResult;

    } catch (err) {
      console.error(`❌ DAS API Error for ${mintAddress}:`, err);
      return defaultResult;
    }
  })();

  setPendingToken2022Request(mintAddress, promise);
  return promise;
}

export default function MeteoraPools() {
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 9,
    totalItems: 0,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchPools = async () => {
      try {
        const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
        const client = new DynamicBondingCurveClient(connection, null as any);

        console.log('🔍 Fetching Meteora virtual pools...');
        const configKey = new PublicKey(METEORA_CONFIG.CONFIG_KEY);
        const virtualPools = await client.state.getPoolsByConfig(configKey);

        if (!isMounted) return;

        // Type the promise return explicitly
        const poolsWithInfo = await Promise.all(
          virtualPools.map(async (poolItem: any): Promise<PoolInfo | null> => {
            try {
              const poolAddress = (poolItem as any).publicKey;
              const pool = (poolItem as any).account;

              if (!poolAddress || !pool) return null;

              const poolPubKey = new PublicKey(poolAddress);
              const baseMint = pool.baseMint;
              const baseMintKey = typeof baseMint === 'string' ? new PublicKey(baseMint) : baseMint;

              // Get progress (non-blocking if possible, or fast)
              // We can default to 0 if this call fails to speed up loading
              let progress = 0;
              try {
                 progress = await client.state.getPoolCurveProgress(poolPubKey);
              } catch (e) {
                 console.warn("Failed to fetch progress", e);
              }

              // Use DAS API to get metadata efficiently
              const tokenMetadata = await fetchTokenMetadataDAS(baseMintKey.toBase58());

              const info: PoolInfo = {
                address: poolPubKey.toBase58(),
                baseMint: baseMintKey.toBase58(),
                creator: pool.creator.toBase58(),
                name: tokenMetadata.name,
                symbol: tokenMetadata.symbol,
                imageUrl: tokenMetadata.imageUrl,
                progress: Math.round(progress * 100),
              };

              return info;
            } catch (err) {
              console.error('Error processing pool:', err);
              return null;
            }
          })
        );

        if (!isMounted) return;

        const validPools = poolsWithInfo.filter((p): p is PoolInfo => p !== null);
        setPools(validPools);
        setPagination((prev) => ({
          ...prev,
          totalItems: validPools.length,
          currentPage: 1,
        }));
      } catch (err) {
        console.error('Error fetching pools:', err);
        if (isMounted) setError('Failed to fetch pools');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPools();

    return () => {
      isMounted = false;
    };
  }, []);

  // Pagination logic
  const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
  const endIndex = startIndex + pagination.itemsPerPage;
  const paginatedPools = pools.slice(startIndex, endIndex);
  const totalPages = Math.ceil(pagination.totalItems / pagination.itemsPerPage);

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex-grow container mx-auto px-6 pt-24 pb-20 max-w-6xl">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Recently Launched Tokens</h1>
        <p className="text-gray-400">Discover tokens launched on Moon Mint bonding curves</p>
        {!loading && !error && pools.length > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Showing {startIndex + 1}-{Math.min(endIndex, pagination.totalItems)} of {pagination.totalItems} tokens
          </p>
        )}
      </div>

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

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && paginatedPools.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {paginatedPools.map((pool) => (
              <a
                key={pool.address}
                href={`/pools/${pool.baseMint}`}
                className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 hover:border-primary-500/50 rounded-xl overflow-hidden transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary-500/10 group flex flex-col"
              >
                <div className="relative w-full aspect-video animate-gradient-bg overflow-hidden border-b border-dark-200 flex items-center justify-center flex-shrink-0 bg-dark-100">
                  {pool.imageUrl ? (
                    <div className="relative w-full h-full">
                      {/* Use unoptimized to bypass Next.js strict domain checks for external images */}
                      <Image
                        src={pool.imageUrl}
                        alt={pool.name || 'Token'}
                        fill
                        className="object-contain p-4 group-hover:scale-105 transition-transform duration-300 drop-shadow-lg"
                        priority={false}
                        unoptimized={true}
                        onError={(e) => {
                          // Try fallback gateway if primary fails (401/404)
                          const target = e.currentTarget;
                          const src = target.src;

                          // Simple retry mechanism for the next gateway
                          // This is client-side retry
                          let nextGateway = IPFS_GATEWAYS[1]; // Try first public gateway
                          if (src.includes(DEDICATED_GATEWAY || '')) {
                             const hash = src.split('/').pop();
                             if (hash) {
                               target.src = `${nextGateway}/${hash}`;
                               return;
                             }
                          }

                          // If already retried or failed, hide
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-white/50">
                      <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-semibold">No Image</span>
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white truncate">{pool.name}</h3>
                      <span className="bg-primary-500/20 text-primary-400 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2">
                        {pool.symbol}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono truncate">
                      Mint: {pool.baseMint.slice(0, 4)}...{pool.baseMint.slice(-4)}
                    </p>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-400">Progress to DEX Migration</span>
                      <span className="text-sm font-semibold text-primary-400">{pool.progress}%</span>
                    </div>
                    <div className="w-full bg-dark-50 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pool.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-dark-200">
                    <button className="w-full text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors text-center">
                      Trade Now →
                    </button>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="px-4 py-2 rounded-lg border border-dark-200 text-gray-400 hover:text-white hover:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-10 h-10 rounded-lg font-medium transition-all ${
                      pagination.currentPage === page
                        ? 'bg-primary-500 text-white'
                        : 'border border-dark-200 text-gray-400 hover:text-white hover:border-primary-500'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === totalPages}
                className="px-4 py-2 rounded-lg border border-dark-200 text-gray-400 hover:text-white hover:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}