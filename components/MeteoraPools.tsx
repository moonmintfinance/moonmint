'use client';

import { useEffect, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getMint, getMetadataPointerState, getTokenMetadata } from '@solana/spl-token';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { SOLANA_RPC_ENDPOINT, METEORA_CONFIG } from '@/lib/constants';

interface PoolInfo {
  address: string;
  baseMint: string;
  creator: string;
  name?: string;
  symbol?: string;
  progress: number;
}

/**
 * Fetches Token 2022 metadata directly from the blockchain
 * Uses the MetadataPointer extension to retrieve on-chain metadata
 *
 * ✅ KEY IMPROVEMENTS:
 * - Fetches metadata directly from Token 2022 using MetadataPointer extension
 * - Handles both name and symbol properly
 * - Gracefully handles missing metadata
 */
async function fetchToken2022Metadata(
  connection: Connection,
  mintAddress: PublicKey
): Promise<{ name?: string; symbol?: string }> {
  try {
    // 1. Get the mint account to check for MetadataPointer extension
    const mintAccount = await getMint(
      connection,
      mintAddress,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    // 2. Get the metadata pointer state (tells us where metadata is stored)
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

    return {
      name: metadata.name,
      symbol: metadata.symbol,
    };
  } catch (error) {
    console.debug('❌ Error fetching Token 2022 metadata for', mintAddress.toBase58(), error);
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
        // ✅ This filters automatically at the SDK level - only YOUR platform's tokens are returned
        const configKey = new PublicKey(METEORA_CONFIG.CONFIG_KEY);
        const allPools = await client.state.getPoolsByConfig(configKey);

        console.log('✅ Got pools from SDK. Count:', allPools.length);

        // Get Token 2022 metadata for each pool's base mint
        const poolsWithInfo = await Promise.all(
          allPools.map(async (poolItem) => {
            try {
              // ✅ CORRECT STRUCTURE: publicKey (not pubkey) + account
              const poolAddress = (poolItem as any).publicKey as string | PublicKey;
              const pool = (poolItem as any).account as any;

              // Validate we have the required data
              if (!poolAddress || !pool) {
                console.warn('Invalid pool structure - missing address or account');
                return null;
              }

              // Convert poolAddress to PublicKey if it's a string
              const poolPubKey = typeof poolAddress === 'string'
                ? new PublicKey(poolAddress)
                : poolAddress;

              // Get pool progress using the correct PublicKey
              const progress = await client.state.getPoolCurveProgress(poolPubKey);

              // Extract baseMint from pool
              const baseMint = pool.baseMint;
              const baseMintPubKey = typeof baseMint === 'string'
                ? new PublicKey(baseMint)
                : baseMint;

              // ✅ FETCH TOKEN 2022 METADATA DIRECTLY
              // This replaces the old Meteora metadata fetching
              const token2022Metadata = await fetchToken2022Metadata(connection, baseMintPubKey);

              const name = token2022Metadata.name || 'Unknown Token';
              const symbol = token2022Metadata.symbol || '???';

              // Extract creator
              const creator = pool.creator;

              return {
                address: poolPubKey.toBase58?.() || String(poolAddress),
                baseMint: typeof baseMint === 'string' ? baseMint : baseMint?.toBase58?.() || String(baseMint),
                creator: typeof creator === 'string' ? creator : creator?.toBase58?.() || String(creator),
                name,
                symbol,
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

        console.log('✅ Valid pools with metadata:', validPools.length);
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
              className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 hover:border-primary-500/50 rounded-xl p-6 transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary-500/10"
            >
              {/* Token Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">
                    {pool.name}
                  </h3>
                  <span className="bg-primary-500/20 text-primary-400 text-xs font-medium px-3 py-1 rounded-full">
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
              <div className="text-xs text-gray-400">
                <span>Creator: </span>
                <span className="font-mono">
                  {pool.creator.slice(0, 8)}...{pool.creator.slice(-8)}
                </span>
              </div>

              {/* CTA */}
              <div className="mt-4 pt-4 border-t border-dark-200">
                <button className="w-full text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors">
                  Trade Now →
                </button>
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