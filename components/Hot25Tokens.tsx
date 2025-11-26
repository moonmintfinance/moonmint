'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useConnection } from '@solana/wallet-adapter-react';
import { HotTokensService, type HotToken } from '@/services/hot-tokens-service';
import { FaFire, FaChartBar, FaTrophy } from 'react-icons/fa';

export function Hot25Tokens() {
  const { connection } = useConnection();
  const [hotTokens, setHotTokens] = useState<HotToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHotTokens = useCallback(async () => {
    try {
      const service = new HotTokensService(connection);
      const tokens = await service.getHotTokensCached(25);
      setHotTokens(tokens);
      setError(null);
    } catch (err) {
      console.error('Error fetching hot tokens:', err);
      setError('Failed to fetch hot tokens. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchHotTokens();

    // Auto-refresh every 60 seconds if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchHotTokens, 60000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchHotTokens, autoRefresh]);

  if (error) {
    return (
      <div className="container mx-auto px-6 py-12 max-w-6xl">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-red-400 mb-2">Error Loading Hot Tokens</h3>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={fetchHotTokens}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12 max-w-7xl">
      {/* Header Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <FaFire className="text-4xl text-orange-500 animate-pulse" />
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white neon-text">
                HOT 25
              </h1>
              <p className="text-gray-400 text-sm mt-1">Trending tokens on Meteora DBC</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span>Auto-refresh</span>
            </label>
            <button
              onClick={fetchHotTokens}
              disabled={loading}
              className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <p className="text-gray-400 text-sm">
          Ranked by trading volume, volatility, and activity across all Meteora Dynamic Bonding Curves
        </p>
      </div>

      {loading && hotTokens.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="inline-block mb-4">
              <svg className="animate-spin h-12 w-12 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-gray-400">Fetching hot tokens...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {hotTokens.map((token) => (
              <HotTokenCard key={token.address} token={token} />
            ))}
          </div>

          {hotTokens.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No hot tokens found yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Hot tokens will appear as they gain traction
              </p>
            </div>
          )}

          {/* Table Layout for Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-primary-500/30">
                  <th className="px-4 py-3 text-sm font-bold text-primary-400">Rank</th>
                  <th className="px-4 py-3 text-sm font-bold text-primary-400">Token</th>
                  <th className="px-4 py-3 text-sm font-bold text-primary-400">Hotness</th>
                  <th className="px-4 py-3 text-sm font-bold text-primary-400">Volume (SOL)</th>
                  <th className="px-4 py-3 text-sm font-bold text-primary-400">Progress</th>
                  <th className="px-4 py-3 text-sm font-bold text-primary-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {hotTokens.map((token) => (
                  <tr key={token.address} className="border-b border-dark-300 hover:bg-dark-200/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary-500">#{token.rank}</span>
                        {token.rank <= 3 && (
                          <FaTrophy className={`text-${token.rank === 1 ? 'yellow' : token.rank === 2 ? 'gray' : 'orange'}-500 text-sm`} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/pools/${token.baseMint}`} className="hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-3">
                          {token.imageUrl ? (
                            <Image
                              src={token.imageUrl}
                              alt={token.symbol}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-dark-300 flex items-center justify-center">
                              <span className="text-xs font-bold text-primary-400">
                                {token.symbol.substring(0, 2)}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-white">{token.symbol}</p>
                            <p className="text-xs text-gray-500">{token.name}</p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-dark-300 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all"
                            style={{ width: `${Math.min(token.hotnessScore, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-orange-500 min-w-fit">
                          {token.hotnessScore.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-white font-semibold">
                        {token.totalVolume.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-dark-300 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all"
                            style={{ width: `${token.progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 min-w-fit">
                          {token.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/pools/${token.baseMint}`}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary-500 hover:bg-primary-600 text-white font-bold text-sm rounded transition-colors"
                      >
                        <FaChartBar className="w-3 h-3" />
                        Trade
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Individual Token Card Component
 */
interface HotTokenCardProps {
  token: HotToken;
}

function HotTokenCard({ token }: HotTokenCardProps) {
  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-orange-500';
    return 'text-primary-500';
  };

  return (
    <Link href={`/pools/${token.baseMint}`}>
      <div className="group bg-dark-100 border border-primary-500/20 hover:border-primary-500/50 rounded-lg p-4 transition-all hover:scale-105 cursor-pointer">
        {/* Header with Rank */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xl font-black ${getMedalColor(token.rank)}`}>
              #{token.rank}
            </span>
            {token.rank <= 3 && <FaTrophy className={`text-sm ${getMedalColor(token.rank)}`} />}
          </div>
          <div className="flex items-center gap-1 bg-orange-500/20 px-2 py-1 rounded">
            <FaFire className="text-orange-500 text-xs" />
            <span className="text-xs font-bold text-orange-400">
              {token.hotnessScore.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Token Info */}
        <div className="flex items-center gap-3 mb-4">
          {token.imageUrl ? (
            <Image
              src={token.imageUrl}
              alt={token.symbol}
              width={48}
              height={48}
              className="rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-dark-300 flex items-center justify-center">
              <span className="text-sm font-bold text-primary-400">
                {token.symbol.substring(0, 2)}
              </span>
            </div>
          )}
          <div>
            <p className="font-bold text-white group-hover:text-primary-400 transition-colors">
              {token.symbol}
            </p>
            <p className="text-xs text-gray-500 truncate">{token.name}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-2 mb-4 text-xs">
          <div className="flex justify-between text-gray-400">
            <span>Volume:</span>
            <span className="text-white font-semibold">{token.totalVolume.toFixed(2)} SOL</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Progress:</span>
            <span className="text-primary-400 font-semibold">{token.progress}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-dark-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all"
            style={{ width: `${token.progress}%` }}
          />
        </div>
      </div>
    </Link>
  );
}