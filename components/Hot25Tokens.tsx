'use client';

import { useHotTokens } from '@/hooks/useHotTokens';
import Image from 'next/image';
import Link from 'next/link';

export function HotTokens() {
  // ✅ Simple hook - does API call to cached data
  const { tokens, loading, error, cached, refreshCountdown } = useHotTokens(25);

  if (loading && tokens.length === 0) {
    return (
      <div className="flex-grow container mx-auto px-6 pt-24 pb-20 max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block">
            <svg className="animate-spin h-12 w-12 text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-400 mt-4">Loading hottest tokens...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-grow container mx-auto px-6 pt-24 pb-20 max-w-6xl">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <p className="text-red-400">❌ {error}</p>
        </div>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="flex-grow container mx-auto px-6 pt-24 pb-20 max-w-6xl">
        <div className="text-center py-12 text-gray-400">
          No hot tokens available yet
        </div>
      </div>
    );
  }

  const refreshMinutes = Math.floor(refreshCountdown / 60000);
  const refreshSeconds = Math.floor((refreshCountdown % 60000) / 1000);

  return (
    <div className="flex-grow container mx-auto px-6 pt-24 pb-20 max-w-6xl">
      {/* Header Section */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Hottest Tokens</h1>
        <p className="text-gray-400">
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
        <p className="text-sm text-gray-500 mt-2">
          Top {tokens.length} tokens by hotness score
        </p>
      </div>

      {/* Token Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {tokens.map((token, index) => (
          <Link
            key={token.baseMint}
            href={`/pools/${token.baseMint}`}
            className="group block"
          >
            <div className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 hover:border-primary-500/50 rounded-xl overflow-hidden transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary-500/10 flex flex-col h-full">
              {/* Token Image Section with Rank Badge */}
              <div className="relative w-full aspect-video bg-dark-100 border-b border-dark-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {/* Rank Badge - Top Right */}
                <div className="absolute top-3 right-3 bg-primary-500/90 text-white text-xs font-bold px-3 py-1 rounded-lg z-10 backdrop-blur-sm">
                  #{index + 1}
                </div>

                {token.imageUrl ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={token.imageUrl}
                      alt={token.name}
                      fill
                      className="object-contain p-4 group-hover:scale-110 transition-transform duration-300 drop-shadow-lg"
                      priority={false}
                      unoptimized={true}
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

              {/* Token Info Section */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                {/* Token Name & Symbol */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white truncate">{token.name}</h3>
                    <span className="bg-primary-500/20 text-primary-400 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2">
                      {token.symbol}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono truncate">
                    {token.baseMint.slice(0, 4)}...{token.baseMint.slice(-4)}
                  </p>
                </div>

                {/* Hotness Progress Section */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">Hotness Score</span>
                    <span className="text-sm font-semibold text-primary-400">
                      {token.hotnessScore.toFixed(1)}/100
                    </span>
                  </div>
                  <div className="w-full bg-dark-500 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(token.hotnessScore, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="mb-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Volume</span>
                    <span className="text-white font-mono">{token.totalVolume.toFixed(2)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Liquidity</span>
                    <span className="text-white font-mono">{token.quoteReserve.toFixed(2)} SOL</span>
                  </div>
                </div>

                {/* Trade Button */}
                <div className="pt-4 border-t border-dark-200">
                  <button className="w-full text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors text-center">
                    Trade Now →
                  </button>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer Note */}
      <div className="text-center text-xs text-gray-600">
        <p>
          Data refreshes every hour on the server.{' '}
          <span className="text-gray-500">All users see the same rankings.</span>
        </p>
      </div>
    </div>
  );
}