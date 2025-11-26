/**
 * Hot Tokens Component - Client Side
 * Location: components/HotTokens.tsx
 *
 * BEFORE: Complex async blockchain calls, RPC errors, huge request bodies
 * AFTER: Simple cached API call, instant response, zero blockchain calls
 */

'use client';

import { useHotTokens } from '@/hooks/useHotTokens';
import Image from 'next/image';
import Link from 'next/link';

export function HotTokens() {
  // ✅ Simple hook - does API call to cached data
  const { tokens, loading, error, cached, refreshCountdown } = useHotTokens(25);

  if (loading && tokens.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4" />
          <p className="text-gray-400">Loading hottest tokens...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <p className="text-red-400">❌ {error}</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No hot tokens available yet
      </div>
    );
  }

  const refreshMinutes = Math.floor(refreshCountdown / 60000);
  const refreshSeconds = Math.floor((refreshCountdown % 60000) / 1000);

  return (
    <div className="space-y-6">
      {/* Header with cache status */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Hottest Tokens</h2>
          <p className="text-sm text-gray-400">
            {cached ? '⚡ Cached' : '🔄 Fresh'} data
            {refreshCountdown > 0 && (
              <>
                {' '}
                • Refreshes in{' '}
                <span className="text-white font-mono">
                  {refreshMinutes}m {refreshSeconds}s
                </span>
              </>
            )}
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          {tokens.length} tokens
        </div>
      </div>

      {/* Token Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tokens.map((token) => (
          <Link
            key={token.baseMint}
            href={`/token/${token.baseMint}`}
            className="group block"
          >
            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-lg p-4 hover:border-blue-500/50 transition-all duration-300 h-full">
              {/* Rank Badge */}
              <div className="absolute top-4 right-4 bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-1 rounded">
                #{token.rank}
              </div>

              {/* Token Image */}
              <div className="relative w-full aspect-square mb-4 bg-gray-800 rounded-lg overflow-hidden">
                <Image
                  src={token.imageUrl}
                  alt={token.name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>

              {/* Token Info */}
              <div className="space-y-2">
                <div>
                  <h3 className="font-bold text-white truncate">
                    {token.name}
                  </h3>
                  <p className="text-sm text-gray-400">{token.symbol}</p>
                </div>

                {/* Metrics */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hotness</span>
                    <span className="text-white font-mono">
                      {token.hotnessScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Volume</span>
                    <span className="text-white font-mono">
                      {token.totalVolume.toFixed(2)} SOL
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Quote Reserve</span>
                    <span className="text-white font-mono">
                      {token.quoteReserve.toFixed(2)} SOL
                    </span>
                  </div>
                </div>

                {/* Hotness Bar */}
                <div className="pt-2">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                      style={{
                        width: `${Math.min(token.hotnessScore, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer Note */}
      <div className="text-center text-xs text-gray-600 pt-4">
        <p>
          Data refreshes every hour on the server.{' '}
          <span className="text-gray-500">All users see the same rankings.</span>
        </p>
      </div>
    </div>
  );
}