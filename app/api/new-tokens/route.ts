import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getMetadataPointerState,
  getTokenMetadata,
} from '@solana/spl-token';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { Redis } from '@upstash/redis';
import { TRANSACTION_CONFIG } from '@/lib/constants';

export const runtime = 'nodejs';

// ============================================================================
// Configuration
// ============================================================================

const DBC_CONFIG_KEY = process.env.NEXT_PUBLIC_METEORA_CONFIG_KEY;
const SOLANA_RPC_ENDPOINT = process.env.HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

// ✅ Private Pinata Gateway - Paid, no rate limiting!
const PINATA_GATEWAY = 'https://indigo-historic-lark-315.mypinata.cloud';
const PINATA_GATEWAY_KEY = process.env.PINATA_GATEWAY_KEY;

// ✅ FIX: Proper Redis initialization with error checking
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn('[New Tokens] ⚠️ Redis not configured - UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN missing');
}

// ✅ Startup log to confirm gateway and authentication
console.log('[New Tokens] ✅ Using PRIVATE Pinata gateway: ' + PINATA_GATEWAY);
if (PINATA_GATEWAY_KEY) {
  console.log('[New Tokens] ✅ Authenticated with Pinata Gateway Key - no rate limiting!');
} else {
  console.warn('[New Tokens] ⚠️ PINATA_GATEWAY_KEY not configured - requests may be rate limited!');
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache configuration
const CACHE_KEY = 'new-tokens:all';
const DISCOVERY_LOCK_KEY = 'new-tokens:discovering';
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 1 month
const LOCK_TTL_SECONDS = 120; // Prevent concurrent discoveries (2 min timeout)

// ============================================================================
// Types
// ============================================================================

interface PoolInfo {
  address: string;
  baseMint: string;
  name: string;
  symbol: string;
  imageUrl: string;
  creator: string;
  progress: number;
  launchedAt: number;
}

interface Token2022Metadata {
  name?: string;
  symbol?: string;
  decimals?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates fallback SVG image based on token symbol
 * Uses deterministic hue calculation for consistent colors
 */
function getFallbackImageUrl(symbol: string): string {
  const hash = symbol
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = (hash * 137.5) % 360;

  return `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22hsl(${hue}%2C70%25%2C50%25)%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2250%22 font-size=%2224%22 fill=%22white%22 text-anchor=%22middle%22 dominant-baseline=%22central%22 font-weight=%22bold%22%3E${symbol.substring(0, 2).toUpperCase()}%3C/text%3E%3C/svg%3E`;
}

/**
 * Convert IPFS URI to HTTP gateway URL
 * Uses your private Pinata gateway (not rate limited)
 * Preserves custom gateway URLs, only converts raw ipfs:// URIs
 */
function convertIpfsToHttp(uri: string): string {
  if (!uri) return '';

  // ✅ FIX: Preserve custom gateway URLs - don't convert them
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  let hash = '';

  // Extract hash from ipfs:// protocol or /ipfs/ path
  if (uri.startsWith('ipfs://')) {
    hash = uri.replace('ipfs://', '');
  } else if (uri.includes('/ipfs/')) {
    const parts = uri.split('/ipfs/');
    if (parts.length > 1) {
      hash = parts[1];
    }
  } else {
    // Not an IPFS URI - return as-is
    return uri;
  }

  // If we found a hash, convert to your private gateway (not rate limited!)
  if (hash) {
    // Clean hash (remove query params)
    hash = hash.split('?')[0];

    // ✅ Use your private gateway - no rate limiting!
    return `${PINATA_GATEWAY}/ipfs/${hash}`;
  }

  return uri;
}

/**
 * Fetch image URL from token metadata JSON on IPFS
 * Supports both ipfs:// URIs and HTTP URLs
 * Includes retry logic for 429 rate limit errors
 * Returns fallback SVG if metadata is unavailable
 */
async function fetchImageFromMetadata(
  metadataUri: string | undefined,
  symbol: string,
  retryCount: number = 0,
  maxRetries: number = 2
): Promise<string> {
  if (!metadataUri) {
    console.log(`[New Tokens] ℹ️  No metadata URI, using fallback for ${symbol}`);
    return getFallbackImageUrl(symbol);
  }

  try {
    // Convert ipfs:// to HTTP gateway URL (preserves custom gateways)
    const url = convertIpfsToHttp(metadataUri);

    console.log(
      `[New Tokens] 📥 Fetching metadata from: ${url.substring(0, 60)}...${
        retryCount > 0 ? ` (retry ${retryCount}/${maxRetries})` : ''
      }`
    );

    // ✅ Build headers with optional gateway authentication
    const headers: Record<string, string> = {};
    if (PINATA_GATEWAY_KEY) {
      headers['X-Pinata-Gateway-Token'] = PINATA_GATEWAY_KEY;
    }

    // Fetch with longer timeout for IPFS
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000), // 15s timeout for IPFS/gateway
    });

    // ✅ FIX: Handle 429 rate limiting with retry
    if (response.status === 429) {
      if (retryCount < maxRetries) {
        const delayMs = 1000 * Math.pow(2, retryCount); // Exponential backoff
        console.warn(
          `[New Tokens] ⚠️  Rate limited (429), retrying in ${delayMs}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return fetchImageFromMetadata(metadataUri, symbol, retryCount + 1, maxRetries);
      } else {
        console.warn(
          `[New Tokens] ⚠️  Rate limited (429) after ${maxRetries} retries, using fallback for ${symbol}`
        );
        return getFallbackImageUrl(symbol);
      }
    }

    if (!response.ok) {
      console.warn(
        `[New Tokens] ⚠️  Metadata fetch failed (${response.status}), using fallback for ${symbol}`
      );
      return getFallbackImageUrl(symbol);
    }

    const metadata = await response.json();

    // Extract image from metadata JSON
    if (metadata.image) {
      console.log(`[New Tokens] ✅ Found image in metadata for ${symbol}`);
      // ✅ CRITICAL: Convert IPFS image URL to HTTP gateway URL
      const imageUrl = convertIpfsToHttp(metadata.image);
      console.log(
        `[New Tokens] 🖼️  Image converted to gateway URL: ${imageUrl.substring(0, 60)}...`
      );
      return imageUrl;
    }

    console.warn(`[New Tokens] ⚠️  No image field in metadata for ${symbol}, using fallback`);
    return getFallbackImageUrl(symbol);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'unknown error';
    console.warn(
      `[New Tokens] ⚠️  Error fetching metadata for ${symbol} (${errorMsg}), using fallback`
    );
    return getFallbackImageUrl(symbol);
  }
}

/**
 * Extract metadata URI from on-chain Token 2022 metadata
 * Follows proper Token 2022 standard with MetadataPointer extension
 */
async function getMetadataUriFromChain(
  connection: Connection,
  baseMint: string,
  symbol: string
): Promise<string | undefined> {
  try {
    const mintPubKey = new PublicKey(baseMint);

    // Get mint info
    const mintInfo = await getMint(
      connection,
      mintPubKey,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    // Check for MetadataPointer extension
    const metadataPointer = getMetadataPointerState(mintInfo);

    if (!metadataPointer?.metadataAddress) {
      console.log(`[New Tokens] ℹ️  No metadata pointer for ${symbol}`);
      return undefined;
    }

    // Fetch actual metadata
    const tokenMetadata = await getTokenMetadata(
      connection,
      metadataPointer.metadataAddress,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    if (!tokenMetadata) {
      console.warn(`[New Tokens] ⚠️  Could not fetch token metadata for ${symbol}`);
      return undefined;
    }

    // Try multiple possible URI field names
    const uri = (tokenMetadata as any).uri ||
                (tokenMetadata as any).metadata_uri ||
                (tokenMetadata as any).metadataUri;

    if (uri && typeof uri === 'string' && uri.length > 0) {
      console.log(`[New Tokens] ✅ Got metadata URI for ${symbol}: ${String(uri).substring(0, 60)}...`);
      return uri;
    }

    console.log(`[New Tokens] ℹ️  No URI field in metadata for ${symbol}`);
    return undefined;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'unknown error';
    console.warn(
      `[New Tokens] ⚠️  Error extracting metadata URI for ${symbol}: ${errorMsg}`
    );
    return undefined;
  }
}

/**
 * ✅ FIX: Fetch Token 2022 metadata with throttling
 * Adds 300ms delay between requests to avoid RPC rate limiting (429 errors)
 * Processes sequentially instead of parallel to respect API limits
 */
async function fetchToken2022MetadataThrottled(
  connection: Connection,
  mints: string[],
  delayMs: number = 300
): Promise<Map<string, Token2022Metadata>> {
  const results = new Map<string, Token2022Metadata>();

  console.log(
    `[New Tokens] 📥 Fetching Token 2022 metadata for ${mints.length} tokens (throttled, ${delayMs}ms delay)...`
  );

  for (let i = 0; i < mints.length; i++) {
    const mint = mints[i];

    try {
      const mintPubKey = new PublicKey(mint);

      const mintInfo = await getMint(
        connection,
        mintPubKey,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );

      const metadataPointer = getMetadataPointerState(mintInfo);

      if (!metadataPointer?.metadataAddress) {
        console.log(`[New Tokens] ℹ️  No metadata pointer for ${mint.substring(0, 8)}`);
      } else {
        const tokenMetadata = await getTokenMetadata(
          connection,
          metadataPointer.metadataAddress,
          'confirmed',
          TOKEN_2022_PROGRAM_ID
        );

        if (tokenMetadata) {
          const metadata: Token2022Metadata = {
            name: (tokenMetadata as any).name,
            symbol: (tokenMetadata as any).symbol,
            decimals: (tokenMetadata as any).decimals || 9,
          };

          if (metadata.symbol) {
            results.set(mint, metadata);
            console.log(`[New Tokens] ✅ ${mint.substring(0, 8)}: ${metadata.symbol}`);
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'unknown error';
      console.warn(`[New Tokens] ⚠️  Failed to fetch metadata for ${mint.substring(0, 8)}: ${errorMsg}`);
    }

    // Add delay between requests (except last one)
    if (i < mints.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[New Tokens] ✅ Got metadata for ${results.size}/${mints.length} tokens`);
  return results;
}

// ============================================================================
// Main Discovery Function
// ============================================================================

/**
 * Discover new pools from DBC config
 * Returns pool info with metadata and images from token metadata JSON
 */
async function discoverNewPools(): Promise<PoolInfo[]> {
  if (!DBC_CONFIG_KEY) {
    throw new Error('DBC_CONFIG_KEY not configured');
  }

  console.log('[New Tokens] 🔍 Starting discovery...');
  const startTime = Date.now();

  try {
    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    const client = new DynamicBondingCurveClient(
      connection,
      TRANSACTION_CONFIG.COMMITMENT
    );

    // ========================================================================
    // Step 1: Fetch all pools from DBC config
    // ========================================================================
    console.log('[New Tokens] Step 1/5: Fetching all pools from DBC config...');
    const configPubKey = new PublicKey(DBC_CONFIG_KEY);

    let virtualPools: any[] = [];
    try {
      virtualPools = await client.state.getPoolsByConfig(configPubKey);
      console.log(`[New Tokens] ✅ Found ${virtualPools.length} total pools`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'unknown error';
      console.error(
        `[New Tokens] ❌ Error fetching pools: ${errorMsg}`
      );
      throw err;
    }

    // ========================================================================
    // Step 2: Get existing cache to identify new pools
    // ========================================================================
    console.log('[New Tokens] Step 2/5: Checking cache for existing pools...');
    let cachedPools: PoolInfo[] = [];

    try {
      // ✅ FIX: Use typed get without JSON.parse
      const cached = await redis.get<PoolInfo[]>(CACHE_KEY);
      if (cached && Array.isArray(cached)) {
        cachedPools = cached;
        console.log(`[New Tokens] ✅ Found ${cachedPools.length} cached pools`);
      }
    } catch (err) {
      console.warn(
        `[New Tokens] ⚠️  Failed to retrieve cache: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }

    const cachedMints = new Set(cachedPools.map(p => p.baseMint));

    // ========================================================================
    // Step 3: Identify new pools not in cache
    // ========================================================================
    console.log('[New Tokens] Step 3/5: Identifying new pools...');
    const newPools: PoolInfo[] = [];
    let skipped = 0;

    for (const poolItem of virtualPools) {
      try {
        const pool = (poolItem as any).account;
        const poolAddress = (poolItem as any).publicKey;

        if (!pool || !poolAddress) continue;

        const baseMintStr = typeof pool.baseMint === 'string'
          ? pool.baseMint
          : pool.baseMint.toBase58?.() || pool.baseMint.toString();

        // Skip if already cached
        if (cachedMints.has(baseMintStr)) {
          skipped++;
          continue;
        }

        const poolSymbol = pool.symbol || baseMintStr.substring(0, 8).toUpperCase();
        const poolName = pool.name || poolSymbol;

        const creator = typeof pool.creator === 'string'
          ? new PublicKey(pool.creator)
          : pool.creator;

        // Try to get progress, but don't fail if it's unavailable
        let progress = 0;
        try {
          progress = await client.state.getPoolCurveProgress(
            new PublicKey(poolAddress)
          );
        } catch (e) {
          console.log(`[New Tokens] ℹ️  Could not fetch progress for ${poolSymbol}`);
        }

        newPools.push({
          address: new PublicKey(poolAddress).toBase58(),
          baseMint: baseMintStr,
          name: poolName,
          symbol: poolSymbol,
          imageUrl: '', // Will be populated later
          creator: creator.toBase58(),
          progress: Math.round(progress * 100),
          launchedAt: Date.now(),
        });
      } catch (err) {
        console.warn(
          `[New Tokens] ⚠️  Error processing pool: ${err instanceof Error ? err.message : 'unknown error'}`
        );
        continue;
      }
    }

    console.log(
      `[New Tokens] ✅ Found ${newPools.length} new pools (skipped ${skipped} cached)`
    );

    // If no new pools, return cached pools
    if (newPools.length === 0) {
      console.log('[New Tokens] ℹ️  No new pools to process');
      return cachedPools;
    }

    // ========================================================================
    // Step 4: Fetch Token 2022 metadata for new pools (THROTTLED)
    // ========================================================================
    console.log(
      `[New Tokens] Step 4/5: Fetching Token 2022 metadata for ${newPools.length} new pools...`
    );

    // ✅ FIX: Use throttled metadata fetching to avoid 429 errors
    const token2022MetadataMap = await fetchToken2022MetadataThrottled(
      connection,
      newPools.map(p => p.baseMint),
      300 // 300ms delay between requests
    );

    // Update pools with actual Token 2022 symbols
    for (const pool of newPools) {
      const metadata = token2022MetadataMap.get(pool.baseMint);
      if (metadata) {
        if (metadata.symbol) {
          pool.symbol = metadata.symbol;
        }
        if (metadata.name) {
          pool.name = metadata.name;
        }
      }
    }

    // ========================================================================
    // Step 5: Fetch metadata URIs and images (with throttling)
    // ========================================================================
    console.log('[New Tokens] Step 5/5: Fetching images from metadata...');
    let imagesFound = 0;

    for (let i = 0; i < newPools.length; i++) {
      const pool = newPools[i];
      try {
        // Extract metadata URI from on-chain Token 2022 metadata
        const metadataUri = await getMetadataUriFromChain(
          connection,
          pool.baseMint,
          pool.symbol
        );

        // Fetch image from metadata JSON
        pool.imageUrl = await fetchImageFromMetadata(metadataUri, pool.symbol);

        // Count non-fallback images
        if (!pool.imageUrl.startsWith('data:image/svg')) {
          imagesFound++;
        }
      } catch (err) {
        console.warn(
          `[New Tokens] ⚠️  Error fetching image for ${pool.symbol}: ${
            err instanceof Error ? err.message : 'unknown error'
          }`
        );
        pool.imageUrl = getFallbackImageUrl(pool.symbol);
      }

      // ✅ Add delay between metadata fetches to avoid rate limiting
      if (i < newPools.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay
      }
    }

    // ========================================================================
    // Step 6: Combine and cache results
    // ========================================================================
    const allPools = [...newPools, ...cachedPools].sort(
      (a, b) => b.launchedAt - a.launchedAt
    );

    console.log(`[New Tokens] 💾 Caching ${allPools.length} total pools...`);

    // ✅ FIX: Use proper Redis set without manual JSON.stringify
    try {
      await redis.set(CACHE_KEY, allPools as any, {
        ex: CACHE_TTL_SECONDS,
      });
      console.log(`[New Tokens] ✅ Cache saved (expires in ${CACHE_TTL_SECONDS}s)`);
    } catch (err) {
      console.error(
        `[New Tokens] ❌ Failed to cache results: ${
          err instanceof Error ? err.message : 'unknown error'
        }`
      );
      // Don't throw - still return results even if caching fails
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `✅ [New Tokens] Discovery complete in ${elapsed}ms (${newPools.length} new pools, ${imagesFound} with images)`
    );

    return allPools;
  } catch (err) {
    console.error(
      `[New Tokens] ❌ Discovery error: ${err instanceof Error ? err.message : 'unknown error'}`
    );
    throw err;
  }
}

// ============================================================================
// Background Discovery Trigger
// ============================================================================

/**
 * Trigger background discovery (non-blocking)
 * Uses Redis lock to prevent concurrent discoveries
 */
async function triggerBackgroundDiscovery(): Promise<void> {
  try {
    // Check if discovery is already in progress
    const isLocked = await redis.exists(DISCOVERY_LOCK_KEY);
    if (isLocked) {
      console.log('[New Tokens] ℹ️  Discovery already in progress, skipping');
      return;
    }

    // Set lock to prevent concurrent discoveries
    await redis.setex(DISCOVERY_LOCK_KEY, LOCK_TTL_SECONDS, '1');

    // Trigger discovery in background (don't await)
    console.log('[New Tokens] 🚀 Triggering background discovery...');

    discoverNewPools()
      .catch(err => {
        console.error(
          `[New Tokens] ❌ Background discovery failed: ${
            err instanceof Error ? err.message : 'unknown error'
          }`
        );
      })
      .finally(() => {
        // Clean up lock
        redis.del(DISCOVERY_LOCK_KEY).catch(err =>
          console.error(
            `[New Tokens] ⚠️  Failed to clean up lock: ${
              err instanceof Error ? err.message : 'unknown error'
            }`
          )
        );
      });
  } catch (err) {
    console.error(
      `[New Tokens] ❌ Error triggering background discovery: ${
        err instanceof Error ? err.message : 'unknown error'
      }`
    );
  }
}

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/new-tokens
 * Returns cached pools immediately with pagination
 * Triggers background discovery if cache is stale
 */
export async function GET(request: NextRequest) {
  try {
    if (!DBC_CONFIG_KEY) {
      return NextResponse.json(
        { error: 'DBC_CONFIG_KEY not configured' },
        { status: 500 }
      );
    }

    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || '25'),
      1000
    );
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');

    console.log(`[New Tokens] GET request: limit=${limit}, offset=${offset}`);

    // ========================================================================
    // Get cached pools (return immediately)
    // ========================================================================
    console.log('[New Tokens] Retrieving cached pools...');
    let allPools: PoolInfo[] = [];
    let cacheHit = false;

    try {
      // ✅ FIX: Use typed get without JSON.parse
      const cached = await redis.get<PoolInfo[]>(CACHE_KEY);
      if (cached && Array.isArray(cached)) {
        allPools = cached;
        cacheHit = true;
        console.log(`[New Tokens] ✅ Cache hit: ${allPools.length} pools`);
      }
    } catch (err) {
      console.warn(
        `[New Tokens] ⚠️  Cache retrieval failed: ${
          err instanceof Error ? err.message : 'unknown error'
        }`
      );
    }

    // ========================================================================
    // Trigger background discovery (non-blocking)
    // ========================================================================
    triggerBackgroundDiscovery().catch(err =>
      console.error(
        `[New Tokens] ⚠️  Failed to trigger discovery: ${
          err instanceof Error ? err.message : 'unknown error'
        }`
      )
    );

    // ========================================================================
    // Return paginated results
    // ========================================================================
    const paginatedPools = allPools.slice(offset, offset + limit);
    const discoveryInProgress = await redis.exists(DISCOVERY_LOCK_KEY);

    return NextResponse.json(
      {
        pools: paginatedPools,
        total: allPools.length,
        offset,
        limit,
        cached: cacheHit,
        discoveryInProgress: discoveryInProgress === 1,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60', // Cache response for 60s
          'X-Cache-Hit': cacheHit ? 'true' : 'false',
        },
      }
    );
  } catch (error) {
    console.error(
      `[New Tokens] ❌ API error: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );

    return NextResponse.json(
      {
        error: 'Failed to fetch new tokens',
        details: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 500 }
    );
  }
}