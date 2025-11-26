/**
 * Hot Tokens Service
 * Fetches and ranks the hottest tokens from ALL Meteora DBC pools
 */

import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import {
  DynamicBondingCurveClient,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { BN } from '@project-serum/anchor';
import { fetchTokenMetadataDAS, type TokenMetadata } from '@/lib/das-api';
import { TRANSACTION_CONFIG } from '@/lib/constants';

export interface HotToken {
  address: string;
  baseMint: string;
  name: string;
  symbol: string;
  imageUrl: string;
  creator: string;
  progress: number;

  // Metrics
  quoteReserve: number;
  baseReserve: number;
  sqrtPrice: BN;
  volatility: number;
  totalVolume: number; // in SOL equivalent

  // Ranking
  hotnessScore: number;
  rank: number;
}

interface PoolMetrics {
  poolAddress: PublicKey;
  baseMint: PublicKey;
  creator: PublicKey;
  quoteReserve: BN;
  baseReserve: BN;
  sqrtPrice: BN;
  volatilityAccumulator: BN;
  totalTradingBaseFee: BN;
  totalTradingQuoteFee: BN;
  progress: number;
}

export class HotTokensService {
  private client: DynamicBondingCurveClient | null = null;

  constructor(private connection: Connection) {}

  /**
   * Initialize Meteora DBC Client
   */
  private async initClient() {
    if (!this.client) {
      this.client = new DynamicBondingCurveClient(
        this.connection,
        TRANSACTION_CONFIG.COMMITMENT
      );
    }
  }

  /**
   * Calculate hotness score based on multiple factors
   * Higher volume + higher volatility + recent activity = hotter token
   */
  private calculateHotnessScore(metrics: PoolMetrics): number {
    // Normalize metrics to 0-100 scale
    const volumeScore = Math.min(
      100,
      (metrics.totalTradingQuoteFee.toNumber() / 1e9) * 10 // Adjust multiplier based on typical volumes
    );

    const volatilityScore = Math.min(
      100,
      (metrics.volatilityAccumulator.toNumber() / 1e6) * 0.1 // Normalized volatility
    );

    // Weight: 70% volume, 30% volatility
    const hotnessScore = volumeScore * 0.7 + volatilityScore * 0.3;

    return hotnessScore;
  }

  /**
   * Fetch all pools and calculate hotness rankings
   */
  async getHotTokens(limit: number = 25): Promise<HotToken[]> {
    try {
      await this.initClient();

      if (!this.client) {
        throw new Error('Failed to initialize Meteora client');
      }

      console.log('📊 Fetching all Meteora DBC pools...');

      // Get ALL pools from Meteora DBC
      const allPools = await this.client.state.getPools();
      console.log(`Found ${allPools.length} total pools`);

      // Process each pool in parallel with error handling
      const poolMetricsPromises = allPools.map(async (poolAccount: any) => {
        try {
          // Handle both direct account and ProgramAccount structures
          const pool = poolAccount.account || poolAccount;
          const poolAddress = poolAccount.pubkey || poolAccount.address || new PublicKey(pool.config.toString());

          if (!poolAddress || !pool) {
            console.warn('Invalid pool structure');
            return null;
          }

          // Get fee metrics for this pool
          let metrics = {
            totalTradingBaseFee: new BN(0),
            totalTradingQuoteFee: new BN(0),
          };

          try {
            const feeMetrics = await this.client?.state.getPoolFeeMetrics(poolAddress);
            if (feeMetrics) {
              metrics = feeMetrics.total;
            }
          } catch (e) {
            console.warn(`Failed to fetch fees for pool ${poolAddress.toBase58?.() || poolAddress}:`, e);
          }

          // Get progress
          let progress = 0;
          try {
            progress = await this.client?.state.getPoolCurveProgress(poolAddress) || 0;
          } catch (e) {
            console.warn(`Failed to fetch progress for pool ${poolAddress.toBase58?.() || poolAddress}:`, e);
          }

          const baseMintKey = typeof pool.baseMint === 'string'
            ? pool.baseMint
            : pool.baseMint.toBase58?.() || pool.baseMint.toString();

          const poolMetrics: PoolMetrics = {
            poolAddress: new PublicKey(poolAddress),
            baseMint: new PublicKey(baseMintKey),
            creator: typeof pool.creator === 'string' ? new PublicKey(pool.creator) : pool.creator,
            quoteReserve: pool.quoteReserve,
            baseReserve: pool.baseReserve,
            sqrtPrice: pool.sqrtPrice,
            volatilityAccumulator: pool.volatilityTracker?.volatilityAccumulator || new BN(0),
            totalTradingBaseFee: metrics.totalTradingBaseFee,
            totalTradingQuoteFee: metrics.totalTradingQuoteFee,
            progress: Math.round(progress * 100),
          };

          return poolMetrics;
        } catch (err) {
          console.error('Error processing pool:', err);
          return null;
        }
      });

      const poolMetricsResults = await Promise.all(poolMetricsPromises);
      const validMetrics = poolMetricsResults.filter(
        (m): m is PoolMetrics => m !== null
      );

      console.log(`✅ Successfully processed ${validMetrics.length} pools`);

      // Calculate hotness scores
      const hotTokens: HotToken[] = [];

      for (const metrics of validMetrics) {
        try {
          const baseMintKey = new PublicKey(metrics.baseMint);

          // Get token metadata from DAS API
          const tokenMetadata = await fetchTokenMetadataDAS(
            baseMintKey.toBase58()
          );

          const hotnessScore = this.calculateHotnessScore(metrics);

          // Only include tokens with some activity
          if (hotnessScore > 0 || metrics.quoteReserve.toNumber() > 0) {
            hotTokens.push({
              address: metrics.poolAddress.toBase58(),
              baseMint: baseMintKey.toBase58(),
              name: tokenMetadata.name,
              symbol: tokenMetadata.symbol,
              imageUrl: tokenMetadata.imageUrl,
              creator: metrics.creator.toBase58(),
              progress: metrics.progress,
              quoteReserve: metrics.quoteReserve.toNumber() / 1e9, // Convert to SOL
              baseReserve: metrics.baseReserve.toNumber(),
              sqrtPrice: metrics.sqrtPrice,
              volatility: metrics.volatilityAccumulator.toNumber(),
              totalVolume: metrics.totalTradingQuoteFee.toNumber() / 1e9, // Volume in SOL
              hotnessScore,
              rank: 0, // Will be set after sorting
            });
          }
        } catch (err) {
          console.warn(
            `Failed to fetch metadata for ${metrics.baseMint.toBase58()}:`,
            err
          );
        }
      }

      // Sort by hotness score (descending) and assign ranks
      hotTokens.sort((a, b) => b.hotnessScore - a.hotnessScore);

      hotTokens.forEach((token, index) => {
        token.rank = index + 1;
      });

      // Return top N tokens
      return hotTokens.slice(0, limit);
    } catch (err) {
      console.error('Error fetching hot tokens:', err);
      throw new Error('Failed to fetch hot tokens from Meteora DBC');
    }
  }

  /**
   * Get hot tokens with caching (cache for 30 seconds)
   */
  private cachedHotTokens: HotToken[] | null = null;
  private lastFetchTime: number = 0;
  private cacheDuration: number = 30000; // 30 seconds

  async getHotTokensCached(limit: number = 25): Promise<HotToken[]> {
    const now = Date.now();

    // Return cached data if still valid
    if (
      this.cachedHotTokens &&
      now - this.lastFetchTime < this.cacheDuration
    ) {
      return this.cachedHotTokens;
    }

    // Fetch fresh data
    const hotTokens = await this.getHotTokens(limit);
    this.cachedHotTokens = hotTokens;
    this.lastFetchTime = now;

    return hotTokens;
  }
}