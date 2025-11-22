'use client';

import { useEffect, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getMint, getMetadataPointerState, getTokenMetadata } from '@solana/spl-token';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import Image from 'next/image';
import { SOLANA_RPC_ENDPOINT, METEORA_CONFIG } from '@/lib/constants';
import {
  getCachedMetadataJson,
  setCachedMetadataJson,
  getPendingMetadataJsonRequest,
  setPendingMetadataJsonRequest,
  getCachedToken2022Metadata,
  setCachedToken2022Metadata,
  getPendingToken2022Request,
  setPendingToken2022Request,
  getCacheStats,
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

// Type definition for Token 2022 metadata
// Note: decimals are stored separately in the mint account, not in metadata extension
type Token2022MetadataResult = {
  name?: string;
  symbol?: string;
  decimals?: number;
  imageUrl?: string;
};

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

// ✅ MAX_FALLBACK_ATTEMPTS set to 2 (instead of trying all 6)
const MAX_FALLBACK_ATTEMPTS = 2;

/**
 * Converts IPFS URI to HTTP gateway URL
 * Handles ipfs://, /ipfs/, and direct HTTP URLs (including custom Pinata gateways)
 */
function convertIpfsToHttp(uri: string): string {
  if (!uri) return '';

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  let hash = '';

  if (uri.startsWith('ipfs://')) {
    hash = uri.replace('ipfs://', '');
  } else if (uri.startsWith('/ipfs/')) {
    hash = uri.replace('/ipfs/', '');
  } else {
    hash = uri;
  }

  const gateway = IPFS_GATEWAYS[0];
  return `${gateway}/${hash}`;
}

/**
 * Fetches JSON metadata from a URI with IPFS support
 */
async function fetchMetadataJson(
  uri: string | undefined
): Promise<{ image?: string; description?: string }> {
  try {
    if (!uri) {
      return {};
    }

    // ✅ CHECK CACHE FIRST
    const cachedMetadata = getCachedMetadataJson(uri);
    if (cachedMetadata) {
      console.log(`♻️ [Cache HIT] Using cached metadata for ${uri.substring(0, 30)}...`);
      return cachedMetadata;
    }

    // ✅ CHECK IF ALREADY PENDING (DEDUPLICATION)
    const pendingRequest = getPendingMetadataJsonRequest(uri);
    if (pendingRequest) {
      console.log(
        `⏳ [Dedup] Already fetching metadata for ${uri.substring(0, 20)}...`
      );
      return pendingRequest;
    }

    console.log(`📥 Fetching metadata from: ${uri.substring(0, 50)}...`);

    // Convert IPFS URI to HTTP
    const httpUrl = convertIpfsToHttp(uri);
    console.log(`🔗 Using URL: ${httpUrl.substring(0, 60)}...`);

    // Create the promise for this request
    const promise = (async () => {
      // Try primary gateway
      try {
        const response = await fetch(httpUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        console.log(
          `📊 Response status: ${response.status} ${response.statusText}`
        );
        console.log(`📋 Content-Type: ${response.headers.get('content-type')}`);

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';

          if (contentType.includes('application/json')) {
            console.log(`📋 Parsing JSON metadata...`);
            try {
              const data = await response.json();
              console.log(`✅ Successfully parsed metadata JSON:`, {
                name: data.name,
                symbol: data.symbol,
                hasImage: !!data.image,
              });

              let imageUrl = data.image;
              if (imageUrl && typeof imageUrl === 'string') {
                console.log(`🖼️  Found image in metadata:`, imageUrl.substring(0, 60));
                imageUrl = convertIpfsToHttp(imageUrl);
                console.log(`✅ Converted image URL ready for rendering`);
              } else {
                console.log(`⚠️  No image field or invalid image in metadata JSON`);
              }

              const result = {
                image: imageUrl || undefined,
                description: data.description || undefined,
              };
              setCachedMetadataJson(uri, result);
              return result;
            } catch (parseErr) {
              console.error(`❌ Failed to parse metadata JSON:`, parseErr);
              return {};
            }
          }

          if (contentType.includes('image/')) {
            console.log(`🖼️  Response is a direct image, using URI as image URL`);
            const result = {
              image: httpUrl,
              description: undefined,
            };
            setCachedMetadataJson(uri, result);
            return result;
          }

          try {
            const data = await response.json();
            if (data && typeof data === 'object' && data.image) {
              console.log(`✅ Parsed as JSON (content-type mismatch), found image`);
              let imageUrl = convertIpfsToHttp(data.image);
              const result = {
                image: imageUrl,
                description: data.description || undefined,
              };
              setCachedMetadataJson(uri, result);
              return result;
            }
          } catch (e) {
            // Couldn't parse as JSON
          }

          if (uri.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
            console.log(`🖼️  URI has image extension, using as image URL`);
            const result = {
              image: httpUrl,
              description: undefined,
            };
            setCachedMetadataJson(uri, result);
            return result;
          }
        } else {
          console.warn(
            `❌ HTTP Error ${response.status}: ${response.statusText}`
          );
        }
      } catch (err) {
        console.warn(
          `⚠️  Primary gateway failed:`,
          err instanceof Error ? err.message : String(err)
        );
        console.warn(
          `⏫ Trying alternative gateways (max ${MAX_FALLBACK_ATTEMPTS})...`
        );

        let hash = '';
        if (uri.startsWith('ipfs://')) {
          hash = uri.replace('ipfs://', '');
        } else if (uri.startsWith('/ipfs/')) {
          hash = uri.replace('/ipfs/', '');
        } else if (uri.includes('/ipfs/')) {
          hash = uri.split('/ipfs/')[1];
        } else {
          return {};
        }

        for (let i = 1; i < Math.min(MAX_FALLBACK_ATTEMPTS, IPFS_GATEWAYS.length); i++) {
          try {
            const fallbackUrl = `${IPFS_GATEWAYS[i]}/${hash}`;
            console.log(`🔄 Trying fallback gateway ${i}...`);

            const response = await fetch(fallbackUrl, {
              signal: AbortSignal.timeout(5000),
            });

            if (response.ok) {
              console.log(`✅ Fallback gateway succeeded!`);

              try {
                const data = await response.json();
                if (data && data.image) {
                  let imageUrl = convertIpfsToHttp(data.image);
                  const result = {
                    image: imageUrl,
                    description: data.description || undefined,
                  };
                  setCachedMetadataJson(uri, result);
                  return result;
                }
              } catch (e) {
                // Not JSON
              }

              const contentType = response.headers.get('content-type') || '';
              if (contentType.includes('image/')) {
                const result = {
                  image: fallbackUrl,
                  description: undefined,
                };
                setCachedMetadataJson(uri, result);
                return result;
              }
            }
          } catch (err) {
            console.warn(`Fallback ${i} failed:`, err instanceof Error ? err.message : String(err));
          }
        }
      }

      return {};
    })();

    setPendingMetadataJsonRequest(uri, promise);
    return promise;
  } catch (err) {
    console.error('Unexpected error in fetchMetadataJson:', err);
    return {};
  }
}

/**
 * Fetches Token 2022 metadata with improved error handling
 * ✅ FIXED: Returns Token2022MetadataResult type with guaranteed decimals field
 */
async function fetchToken2022Metadata(
  connection: Connection,
  mint: PublicKey
): Promise<Token2022MetadataResult> {
  const defaultResult: Token2022MetadataResult = {
    name: 'Unknown Token',
    symbol: '???',
    decimals: 0,
  };

  // Check cache first
  const cacheKey = mint.toBase58();
  const cachedData = getCachedToken2022Metadata(cacheKey);
  if (cachedData) {
    console.log(`♻️ [Cache HIT] Token 2022 metadata for ${cacheKey.substring(0, 8)}...`);
    // ✅ CRITICAL: Still need to fetch decimals from mint account (not in metadata cache)
    try {
      const mintAccount = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
      return {
        name: cachedData?.name ?? 'Unknown Token',
        symbol: cachedData?.symbol ?? '???',
        decimals: mintAccount?.decimals ?? 0,
        imageUrl: cachedData?.imageUrl,
      };
    } catch (err) {
      console.warn(`⚠️  Could not fetch decimals from mint account:`, err);
      return {
        name: cachedData?.name ?? 'Unknown Token',
        symbol: cachedData?.symbol ?? '???',
        decimals: 0,
        imageUrl: cachedData?.imageUrl,
      };
    }
  }

  // Check if already pending
  const pendingRequest = getPendingToken2022Request(cacheKey);
  if (pendingRequest) {
    console.log(`⏳ [Dedup] Token 2022 request already pending for ${cacheKey.substring(0, 8)}...`);
    return pendingRequest;
  }

  const promise: Promise<Token2022MetadataResult> = (async () => {
    try {
      console.log(`🔍 Fetching Token 2022 metadata for ${cacheKey.substring(0, 8)}...`);
      const mintAccount = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);

      // Get metadata pointer if available
      const metadataPointer = getMetadataPointerState(mintAccount);
      if (metadataPointer?.metadataAddress) {
        console.log(`✅ Found metadata pointer`);
        const metadata = await getTokenMetadata(connection, metadataPointer.metadataAddress, 'confirmed', TOKEN_2022_PROGRAM_ID);

        if (metadata) {
          // ✅ Get decimals from mintAccount, not metadata
          const decimals = mintAccount?.decimals ?? 0;

          console.log(`✅ Token 2022 metadata:`, {
            name: metadata.name || 'Unknown',
            symbol: metadata.symbol || '???',
            decimals,
            hasUri: !!metadata.uri,
          });

          let imageUrl: string | undefined;

          // ✅ CRITICAL: Fetch the JSON metadata to get the image URL
          if (metadata.uri) {
            console.log(`📥 Fetching metadata JSON from URI...`);
            const jsonMetadata = await fetchMetadataJson(metadata.uri);
            imageUrl = jsonMetadata.image;
          }

          const result: Token2022MetadataResult = {
            name: metadata.name || 'Unknown Token',
            symbol: metadata.symbol || '???',
            decimals,
            imageUrl,
          };

          setCachedToken2022Metadata(cacheKey, result);
          return result;
        }
      }

      return defaultResult;
    } catch (err) {
      console.error(`❌ Error fetching Token 2022 metadata:`, err);
      return defaultResult;
    }
  })();

  setPendingToken2022Request(cacheKey, promise);
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
    const fetchPools = async () => {
      try {
        const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');

        // Initialize Meteora client
        console.log('🔍 Initializing Meteora DBC Client...');
        const client = new DynamicBondingCurveClient(connection, null as any);

        // ✅ Fetch all pools by config
        console.log('🔍 Fetching Meteora virtual pools...');
        const configKey = new PublicKey(METEORA_CONFIG.CONFIG_KEY);
        const virtualPools = await client.state.getPoolsByConfig(configKey);
        console.log(`✅ Found ${virtualPools.length} virtual pools`);

        // Fetch detailed info for each pool
        const poolsWithInfo = await Promise.all(
          virtualPools.map(async (poolItem: any) => {
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

              // ✅ FETCH TOKEN 2022 METADATA (WITH CACHING & DEDUPLICATION)
              const token2022Metadata = await fetchToken2022Metadata(
                connection,
                baseMintPubKey
              );

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
          .filter((p: PoolInfo | null) => p !== null) as PoolInfo[];

        console.log('✅ Valid pools with metadata and images:', validPools.length);

        // ✅ LOG CACHE STATS
        const cacheStats = getCacheStats();
        console.log('📊 Cache Statistics:', cacheStats);

        setPools(validPools);
        setPagination((prev) => ({
          ...prev,
          totalItems: validPools.length,
          currentPage: 1,
        }));
      } catch (err) {
        console.error('Error fetching pools:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch pools');
      } finally {
        setLoading(false);
      }
    };

    void fetchPools();
  }, []);

  // ✅ Calculate paginated pools
  const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
  const endIndex = startIndex + pagination.itemsPerPage;
  const paginatedPools = pools.slice(startIndex, endIndex);
  const totalPages = Math.ceil(pagination.totalItems / pagination.itemsPerPage);

  // ✅ Pagination handlers
  const handleNextPage = () => {
    if (pagination.currentPage < totalPages) {
      setPagination((prev) => ({
        ...prev,
        currentPage: prev.currentPage + 1,
      }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination((prev) => ({
        ...prev,
        currentPage: prev.currentPage - 1,
      }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: page,
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        {!loading && !error && pools.length > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Showing {startIndex + 1}-{Math.min(endIndex, pagination.totalItems)} of{' '}
            {pagination.totalItems} tokens
          </p>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block">
            <svg
              className="animate-spin h-12 w-12 text-primary-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
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
      {!loading && !error && paginatedPools.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {paginatedPools.map((pool) => (
              <a
                key={pool.address}
                href={`/pools/${pool.baseMint}`}
                className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 hover:border-primary-500/50 rounded-xl overflow-hidden transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary-500/10 group flex flex-col"
              >
                {/* Token Image */}
                <div className="relative w-full aspect-video animate-gradient-bg overflow-hidden border-b border-dark-200 flex items-center justify-center flex-shrink-0">
                  {pool.imageUrl ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={pool.imageUrl}
                        alt={pool.name || 'Token'}
                        fill
                        className="object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-lg"
                        priority={false}
                        loading="lazy"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-white/80">
                      <svg
                        className="w-12 h-12 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
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
                      <span className="text-xs text-gray-400">
                        Progress to DEX Migration
                      </span>
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

          {/* ✅ PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              {/* Previous Button */}
              <button
                onClick={handlePrevPage}
                disabled={pagination.currentPage === 1}
                className="px-4 py-2 rounded-lg border border-dark-200 text-gray-400 hover:text-white hover:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>

              {/* Page Numbers */}
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

              {/* Next Button */}
              <button
                onClick={handleNextPage}
                disabled={pagination.currentPage === totalPages}
                className="px-4 py-2 rounded-lg border border-dark-200 text-gray-400 hover:text-white hover:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>

              {/* Page Info */}
              <div className="text-sm text-gray-500 ml-4">
                Page {pagination.currentPage} of {totalPages}
              </div>
            </div>
          )}
        </>
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