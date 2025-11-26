/**
 * Hot Tokens API Endpoint
 * Location: app/api/hot-tokens/route.ts
 *
 * UPDATED: Filters pools by DBC config key from environment variable
 * Environment Variable: NEXT_PUBLIC_Jupiter_Studio_Config_key
 * Limit: Top 25 coins by hotness score
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { BN } from '@project-serum/anchor';
import { fetchMultipleTokenMetadata } from '@/lib/das-api';
import { TRANSACTION_CONFIG } from '@/lib/constants';

export const runtime = 'nodejs';

// ✅ Get DBC CONFIG KEY from environment variable
const DBC_CONFIG_KEY = process.env.NEXT_PUBLIC_Jupiter_Studio_Config_key;

if (!DBC_CONFIG_KEY) {
  console.error('❌ NEXT_PUBLIC_Jupiter_Studio_Config_key is not set in environment variables');
}

const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

/**
 * Cache implementation for hot tokens
 */
class Cache<T> {
  private store: Map<
    string,
    { data: T; timestamp: number; ttl: number }
  > = new Map();

  set(key: string, data: T, ttl: number): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    console.log(`✅ Cache set: ${key} (TTL: ${ttl / 1000 / 60}m)`);
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      console.log(`❌ Cache miss: ${key}`);
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      console.log(`⏱️  Cache expired: ${key} (age: ${age / 1000 / 60}m)`);
      this.store.delete(key);
      return null;
    }

    console.log(`⚡ Cache hit: ${key} (expires in ${(entry.ttl - age) / 1000 / 60}m)`);
    return entry.data;
  }

  isExpired(key: string): boolean {
    return this.get(key) === null;
  }

  remainingTtl(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;

    const age = Date.now() - entry.timestamp;
    return Math.max(0, entry.ttl - age);
  }
}

interface HotToken {
  address: string;
  baseMint: string;
  name: string;
  symbol: string;
  imageUrl: string;
  creator: string;
  progress: number;
  quoteReserve: number;
  baseReserve: string;
  sqrtPrice: string;
  volatility: string;
  totalVolume: string;
  hotnessScore: number;
  rank: number;
}

interface HotTokensResponse {
  tokens: HotToken[];
  cached: boolean;
  fetchedAt: number;
  cacheExpiresAt: number;
  cacheRemainingMs: number;
}

// ✅ Global cache instance
const hotTokensCache = new Cache<HotToken[]>();
const CACHE_KEY = 'hot-tokens-dbc-filtered';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ✅ Flag to prevent simultaneous refreshes
let isFetching = false;
let fetchPromise: Promise<HotToken[]> | null = null;

/**
 * Calculate hotness score based on volume and volatility
 */
function calculateHotnessScore(metrics: {
  totalTradingQuoteFee: BN;
  volatilityAccumulator: BN;
}): number {
  const volumeScore = Math.min(
    100,
    (metrics.totalTradingQuoteFee.toNumber() / 1e9) * 10
  );

  const volatilityScore = Math.min(
    100,
    (metrics.volatilityAccumulator.toNumber() / 1e6) * 0.1
  );

  return volumeScore * 0.7 + volatilityScore * 0.3;
}

/**
 * ✅ Fetch hot tokens from blockchain (server-side only)
 * FILTERS BY SPECIFIC DBC CONFIG KEY FROM ENVIRONMENT
 */
async function fetchHotTokensFromBlockchain(limit: number = 25): Promise<HotToken[]> {
  // Validate config key is set
  if (!DBC_CONFIG_KEY) {
    throw new Error('DBC_CONFIG_KEY (NEXT_PUBLIC_Jupiter_Studio_Config_key) is not configured');
  }

  const startTime = Date.now();

  try {
    console.log(
      `[Server] Starting hot tokens fetch from DBC config: ${DBC_CONFIG_KEY}`
    );

    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    const client = new DynamicBondingCurveClient(connection, TRANSACTION_CONFIG.COMMITMENT);

    // ✅ UPDATED: Fetch ONLY pools from the specific DBC config key
    console.log('[Server] Step 1/4: Fetching pools from specific DBC config...');
    const configPubKey = new PublicKey(DBC_CONFIG_KEY);
    const virtualPools = await client.state.getPoolsByConfig(configPubKey);

    console.log(`[Server] Found ${virtualPools.length} pools in config`);

    // Step 2: Extract metrics from pools
    console.log('[Server] Step 2/4: Extracting pool metrics...');
    const allMetrics: Array<{
      poolAddress: PublicKey;
      baseMint: string;
      creator: PublicKey;
      quoteReserve: BN;
      baseReserve: BN;
      sqrtPrice: BN;
      volatilityAccumulator: BN;
      totalTradingBaseFee: BN;
      totalTradingQuoteFee: BN;
    }> = [];
    const mintAddresses: string[] = [];

    for (const poolItem of virtualPools) {
      try {
        const pool = (poolItem as any).account;
        const poolAddress = (poolItem as any).publicKey;

        if (!pool || !poolAddress) continue;

        const baseMintStr =
          typeof pool.baseMint === 'string'
            ? pool.baseMint
            : pool.baseMint.toBase58?.() || pool.baseMint.toString();

        allMetrics.push({
          poolAddress: new PublicKey(poolAddress),
          baseMint: baseMintStr,
          creator:
            typeof pool.creator === 'string'
              ? new PublicKey(pool.creator)
              : pool.creator,
          quoteReserve: pool.quoteReserve,
          baseReserve: pool.baseReserve,
          sqrtPrice: pool.sqrtPrice,
          volatilityAccumulator:
            pool.volatilityTracker?.volatilityAccumulator || new BN(0),
          totalTradingBaseFee: pool.metrics?.totalTradingBaseFee || new BN(0),
          totalTradingQuoteFee: pool.metrics?.totalTradingQuoteFee || new BN(0),
        });
        mintAddresses.push(baseMintStr);
      } catch (err) {
        console.warn('Error processing metrics:', err);
        continue;
      }
    }

    console.log(`[Server] Extracted ${allMetrics.length} pool metrics`);

    // Step 3: Fetch metadata using your existing DAS API function
    console.log('[Server] Step 3/4: Fetching metadata...');
    const metadataMap = await fetchMultipleTokenMetadata(mintAddresses);
    console.log(`[Server] Fetched metadata for ${metadataMap.size} tokens`);

    // Step 4: Calculate hotness and build results
    console.log('[Server] Step 4/4: Calculating hotness scores...');
    const hotTokens: HotToken[] = [];

    for (const metrics of allMetrics) {
      try {
        const metadata = metadataMap.get(metrics.baseMint) || {
          name: 'Unknown Token',
          symbol: metrics.baseMint.substring(0, 8).toUpperCase(),
          imageUrl:
            'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23222%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E',
          decimals: 9,
        };

        const hotnessScore = calculateHotnessScore(metrics);

        if (hotnessScore > 0 || metrics.quoteReserve.toNumber() > 0) {
          hotTokens.push({
            address: metrics.poolAddress.toBase58(),
            baseMint: metrics.baseMint,
            name: metadata.name,
            symbol: metadata.symbol,
            imageUrl: metadata.imageUrl,
            creator: metrics.creator.toBase58(),
            progress: 0,
            quoteReserve: metrics.quoteReserve.toNumber() / 1e9,
           baseReserve: metrics.baseReserve.toString(),
            sqrtPrice: metrics.sqrtPrice.toString(),
          volatility: metrics.volatilityAccumulator.toString(),
          totalVolume: metrics.totalTradingQuoteFee.toString(),
            hotnessScore,
            rank: 0,
          });
        }
      } catch (err) {
        console.warn('Error processing metrics:', err);
        continue;
      }
    }

    // Sort by hotness score and take top 25
    hotTokens.sort((a, b) => b.hotnessScore - a.hotnessScore);
    hotTokens.forEach((token, index) => {
      token.rank = index + 1;
    });

    const topTokens = hotTokens.slice(0, limit);
    const elapsed = Date.now() - startTime;

    console.log(
      `✅ [Server] Complete: ${topTokens.length} tokens in ${elapsed}ms`
    );

    return topTokens;
  } catch (err) {
    console.error('[Server] Error fetching hot tokens:', err);
    throw err;
  }
}

/**
 * ✅ GET endpoint - returns cached data or triggers refresh
 */
export async function GET(request: NextRequest) {
  try {
    // Validate config key is set before processing
    if (!DBC_CONFIG_KEY) {
      return NextResponse.json(
        {
          error: 'Configuration Error',
          details: 'NEXT_PUBLIC_Jupiter_Studio_Config_key environment variable is not set',
        },
        { status: 500 }
      );
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '25');

    // Check if data is in cache
    let cachedTokens = hotTokensCache.get(CACHE_KEY);

    if (cachedTokens) {
      // Return cached data
      const remainingMs = hotTokensCache.remainingTtl(CACHE_KEY);
      const cacheExpiresAt = Date.now() + remainingMs;

      return NextResponse.json({
        tokens: cachedTokens.slice(0, limit),
        cached: true,
        fetchedAt: Date.now() - (CACHE_TTL_MS - remainingMs),
        cacheExpiresAt,
        cacheRemainingMs: remainingMs,
      } as HotTokensResponse);
    }

    // Cache is expired or empty
    console.log('📡 Cache miss, fetching fresh data...');

    // Prevent simultaneous fetches
    if (isFetching && fetchPromise) {
      console.log('⏳ Fetch already in progress, waiting...');
      const tokens = await fetchPromise;
      const remainingMs = hotTokensCache.remainingTtl(CACHE_KEY);
      const cacheExpiresAt = Date.now() + remainingMs;

      return NextResponse.json({
        tokens: tokens.slice(0, limit),
        cached: true,
        fetchedAt: Date.now() - (CACHE_TTL_MS - remainingMs),
        cacheExpiresAt,
        cacheRemainingMs: remainingMs,
      } as HotTokensResponse);
    }

    // Start fetch
    isFetching = true;
    const fetchStartTime = Date.now();

    try {
      fetchPromise = fetchHotTokensFromBlockchain(limit);
      const tokens = await fetchPromise;

      // Store in cache
      hotTokensCache.set(CACHE_KEY, tokens, CACHE_TTL_MS);

      const cacheExpiresAt = Date.now() + CACHE_TTL_MS;

      return NextResponse.json({
        tokens: tokens.slice(0, limit),
        cached: false,
        fetchedAt: fetchStartTime,
        cacheExpiresAt,
        cacheRemainingMs: CACHE_TTL_MS,
      } as HotTokensResponse);
    } finally {
      isFetching = false;
      fetchPromise = null;
    }
  } catch (error) {
    console.error('❌ Hot tokens API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch hot tokens',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}