/**
 * Hot Tokens API - FINAL OPTIMIZED
 * Location: app/api/hot-tokens/route.ts
 *
 * 🚀 Perfect balance:
 * - Calculate hotness for all 4,430 (no API calls, use pool data)
 * - Sort and take top 25
 * - Fetch Token 2022 on-chain metadata for only top 25 (1 efficient DAS call)
 * - Fetch anoncoin.it images for top 25
 * 
 * Result: Just 1 Helius API call for top 25 metadata!
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { BN } from '@project-serum/anchor';
import { fetchMultipleTokenMetadata } from '@/lib/das-api';
import { fetchAnonCoinImages } from '@/lib/anoncoin-image-service';
import { TRANSACTION_CONFIG } from '@/lib/constants';

export const runtime = 'nodejs';

const DBC_CONFIG_KEY = process.env.NEXT_PUBLIC_Jupiter_Studio_Config_key;
const SOLANA_RPC_ENDPOINT = process.env.HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

/**
 * Simple cache
 */
class Cache<T> {
  private store: Map<string, { data: T; timestamp: number; ttl: number }> = new Map();

  set(key: string, data: T, ttl: number): void {
    this.store.set(key, { data, timestamp: Date.now(), ttl });
    console.log(`✅ Cache set: ${key} (TTL: ${ttl / 1000 / 60}m)`);
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
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

const hotTokensCache = new Cache<HotToken[]>();
const CACHE_KEY = 'hot-tokens-dbc';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let isFetching = false;
let fetchPromise: Promise<HotToken[]> | null = null;

/**
 * Calculate hotness score
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
 * Generate fallback SVG image
 */
function getFallbackImageUrl(symbol: string): string {
  const hash = symbol
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = (hash * 137.5) % 360;

  return `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22hsl(${hue}%2C70%25%2C50%25)%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2250%22 font-size=%2224%22 fill=%22white%22 text-anchor=%22middle%22 dominant-baseline=%22central%22 font-weight=%22bold%22%3E${symbol.substring(0, 2)}%3C/text%3E%3C/svg%3E`;
}

/**
 * ✅ FINAL OPTIMIZED: Proper metadata for top 25 only
 * 🚀 Steps:
 * 1. Get all pools from DBC
 * 2. Calculate hotness for all 4,430 (no API calls)
 * 3. Sort and take top 25
 * 4. Fetch Token 2022 metadata for top 25 ONLY (1 efficient DAS call)
 * 5. Fetch anoncoin.it images for top 25
 * 
 * Result: Authoritative on-chain metadata + custom images!
 */
async function fetchHotTokensFromBlockchain(limit: number = 25): Promise<HotToken[]> {
  if (!DBC_CONFIG_KEY) {
    throw new Error('DBC_CONFIG_KEY not configured');
  }

  const startTime = Date.now();

  try {
    console.log(`[Server] Fetching hot tokens from DBC config: ${DBC_CONFIG_KEY}`);

    const connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
    const client = new DynamicBondingCurveClient(connection, TRANSACTION_CONFIG.COMMITMENT);

    // ✅ Step 1: Get all pools
    console.log('[Server] Step 1/5: Fetching all pools...');
    const configPubKey = new PublicKey(DBC_CONFIG_KEY);
    const virtualPools = await client.state.getPoolsByConfig(configPubKey);
    console.log(`[Server] Found ${virtualPools.length} pools`);

    // ✅ Step 2: Calculate hotness for ALL pools (no metadata fetching)
    console.log('[Server] Step 2/5: Calculating hotness for all pools...');
    const allTokens: HotToken[] = [];

    for (const poolItem of virtualPools) {
      try {
        const pool = (poolItem as any).account;
        const poolAddress = (poolItem as any).publicKey;

        if (!pool || !poolAddress) continue;

        const baseMintStr = typeof pool.baseMint === 'string'
          ? pool.baseMint
          : pool.baseMint.toBase58?.() || pool.baseMint.toString();

        // Use pool data for initial hotness calculation
        const poolSymbol = pool.symbol || baseMintStr.substring(0, 8).toUpperCase();
        const poolName = pool.name || poolSymbol;

        const creator = typeof pool.creator === 'string'
          ? new PublicKey(pool.creator)
          : pool.creator;

        const volatilityAccumulator = pool.volatilityTracker?.volatilityAccumulator || new BN(0);
        const totalTradingQuoteFee = pool.metrics?.totalTradingQuoteFee || new BN(0);

        const hotnessScore = calculateHotnessScore({
          totalTradingQuoteFee,
          volatilityAccumulator,
        });

        // Only include if it has hotness or reserves
        if (hotnessScore > 0 || pool.quoteReserve.toNumber() > 0) {
          allTokens.push({
            address: new PublicKey(poolAddress).toBase58(),
            baseMint: baseMintStr,
            name: poolName, // Will be updated with on-chain metadata
            symbol: poolSymbol, // Will be updated with on-chain metadata
            imageUrl: '', // Will set after fetching images
            creator: creator.toBase58(),
            progress: 0,
            quoteReserve: pool.quoteReserve.toNumber() / 1e9,
            baseReserve: pool.baseReserve.toString(),
            sqrtPrice: pool.sqrtPrice.toString(),
            volatility: volatilityAccumulator.toString(),
            totalVolume: totalTradingQuoteFee.toString(),
            hotnessScore,
            rank: 0,
          });
        }
      } catch (err) {
        console.warn('Error processing pool:', err);
        continue;
      }
    }

    console.log(`[Server] Calculated hotness for ${allTokens.length} tokens`);

    // ✅ Step 3: Sort by hotness and take TOP 25
    console.log(`[Server] Step 3/5: Sorting and taking top ${limit}...`);
    allTokens.sort((a, b) => b.hotnessScore - a.hotnessScore);
    const topTokens = allTokens.slice(0, limit);

    // ✅ Step 4: Fetch Token 2022 on-chain metadata for ONLY top 25
    // This is 1 efficient API call with 25 mints, not 25 separate calls!
    console.log(`[Server] Step 4/5: Fetching Token 2022 on-chain metadata for top ${limit} tokens...`);
    const dasMetadataMap = await fetchMultipleTokenMetadata(
      topTokens.map(t => t.baseMint)
    );

    // Update with authoritative on-chain metadata
    for (const token of topTokens) {
      const dasMetadata = dasMetadataMap.get(token.baseMint);
      if (dasMetadata) {
        token.name = dasMetadata.name;
        token.symbol = dasMetadata.symbol;
      }
    }

    console.log(`[Server] Got on-chain metadata for ${dasMetadataMap.size} tokens`);

    // ✅ Step 5: Fetch anoncoin.it images for top 25
    console.log(`[Server] Step 5/5: Fetching anoncoin.it images for top ${limit} tokens...`);
    const imageMap = await fetchAnonCoinImages(topTokens.map(t => t.symbol));

    // Set images and rank
    topTokens.forEach((token, index) => {
      token.imageUrl = imageMap.get(token.symbol) || getFallbackImageUrl(token.symbol);
      token.rank = index + 1;
    });

    const elapsed = Date.now() - startTime;

    console.log(`✅ [Server] Complete: ${topTokens.length} tokens in ${elapsed}ms`);
    console.log(`🚀 [Server] Helius API calls: 1 (batched 25 Token 2022 metadata fetches)`);
    console.log(`🚀 [Server] Anoncoin.it image checks: ${imageMap.size}/${limit}`);

    return topTokens;
  } catch (err) {
    console.error('[Server] Error fetching hot tokens:', err);
    throw err;
  }
}

/**
 * ✅ GET endpoint
 */
export async function GET(request: NextRequest) {
  try {
    if (!DBC_CONFIG_KEY) {
      return NextResponse.json(
        { error: 'DBC_CONFIG_KEY not configured' },
        { status: 500 }
      );
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '25');

    // Check cache
    let cachedTokens = hotTokensCache.get(CACHE_KEY);

    if (cachedTokens) {
      const remainingMs = hotTokensCache.remainingTtl(CACHE_KEY);
      return NextResponse.json({
        tokens: cachedTokens.slice(0, limit),
        cached: true,
        fetchedAt: Date.now() - (CACHE_TTL_MS - remainingMs),
        cacheExpiresAt: Date.now() + remainingMs,
        cacheRemainingMs: remainingMs,
      } as HotTokensResponse);
    }

    // Prevent simultaneous fetches
    if (isFetching && fetchPromise) {
      console.log('⏳ Fetch in progress, waiting...');
      const tokens = await fetchPromise;
      const remainingMs = hotTokensCache.remainingTtl(CACHE_KEY);

      return NextResponse.json({
        tokens: tokens.slice(0, limit),
        cached: true,
        fetchedAt: Date.now() - (CACHE_TTL_MS - remainingMs),
        cacheExpiresAt: Date.now() + remainingMs,
        cacheRemainingMs: remainingMs,
      } as HotTokensResponse);
    }

    // Start fresh fetch
    isFetching = true;
    const fetchStartTime = Date.now();

    try {
      fetchPromise = fetchHotTokensFromBlockchain(limit);
      const tokens = await fetchPromise;

      hotTokensCache.set(CACHE_KEY, tokens, CACHE_TTL_MS);

      return NextResponse.json({
        tokens: tokens.slice(0, limit),
        cached: false,
        fetchedAt: fetchStartTime,
        cacheExpiresAt: Date.now() + CACHE_TTL_MS,
        cacheRemainingMs: CACHE_TTL_MS,
      } as HotTokensResponse);
    } finally {
      isFetching = false;
      fetchPromise = null;
    }
  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch hot tokens',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}