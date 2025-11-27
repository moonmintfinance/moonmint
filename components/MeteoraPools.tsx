'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface PoolInfo {
  address: string;
  baseMint: string;
  name?: string;
  symbol?: string;
  imageUrl?: string;
  creator: string;
  progress: number;
  launchedAt: number;
}

interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
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
  const [discoveryInProgress, setDiscoveryInProgress] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchPools = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('📡 Fetching pools from /api/new-tokens...');
        const response = await fetch(`/api/new-tokens?limit=1000&offset=0`);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (!isMounted) return;

        setPools(data.pools || []);
        setPagination((prev) => ({
          ...prev,
          totalItems: data.total || 0,
          currentPage: 1,
        }));
        setDiscoveryInProgress(data.discoveryInProgress || false);

        console.log(`✅ Loaded ${data.pools?.length || 0} pools`);
      } catch (err) {
        console.error('Error fetching pools:', err);
        if (isMounted) {
          setError('Failed to fetch pools');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
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
        <p className="text-gray-400">Discover new tokens launched on Chad Mint</p>
        {!loading && !error && pools.length > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Showing {startIndex + 1}-{Math.min(endIndex, pagination.totalItems)} of{' '}
            {pagination.totalItems} tokens
          </p>
        )}
        {discoveryInProgress && (
          <p className="text-xs text-primary-400 mt-2">🔍 Discovering new tokens in background...</p>
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
                {/* Image Section */}
                <div className="relative w-full aspect-video border-b border-dark-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {/* Flashing Neon Background - Alternating Pink/Green */}
                  <div className="absolute inset-0 animate-neon-party"></div>

                  {pool.imageUrl ? (
                    <div className="relative w-full h-full z-0">
                      <Image
                        src={pool.imageUrl}
                        alt={pool.name || 'Token'}
                        fill
                        className="object-contain p-4 group-hover:scale-105 transition-transform duration-300 drop-shadow-lg"
                        priority={false}
                        unoptimized={true}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-white/50 z-0">
                      <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                {/* Token Info */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white truncate">{pool.name || 'Unknown'}</h3>
                      <span className="bg-primary-500/20 text-primary-400 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ml-2">
                        {pool.symbol || 'TOKEN'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono truncate">
                      {pool.baseMint.slice(0, 4)}...{pool.baseMint.slice(-4)}
                    </p>
                  </div>

                  {/* Progress Bar */}
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

                  {/* Trade Button */}
                  <div className="pt-4 border-t border-dark-200">
                    <button className="w-full text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors text-center">
                      Trade Now →
                    </button>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Pagination */}
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