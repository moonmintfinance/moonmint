/**
 * useHotTokens Hook
 * Location: hooks/useHotTokens.ts
 *
 * Client-side hook that fetches hot tokens from server API
 * (Not from blockchain - server caches and refreshes every hour)
 *
 * Benefits:
 * - Zero RPC calls from client
 * - Instant response (cached data)
 * - All users see same data
 * - No async blockchain operations on client
 */

import { useState, useEffect } from 'react';

export interface HotToken {
  address: string;
  baseMint: string;
  name: string;
  symbol: string;
  imageUrl: string;
  creator: string;
  progress: number;
  quoteReserve: number;
  baseReserve: number;
  sqrtPrice: string;
  volatility: number;
  totalVolume: number;
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

interface UseHotTokensResult {
  tokens: HotToken[];
  loading: boolean;
  error: string | null;
  cached: boolean;
  refreshTime: Date | null;
  refreshCountdown: number; // milliseconds until cache refresh
}

/**
 * ✅ Hook to fetch hot tokens from server cache
 *
 * Usage:
 * ```tsx
 * const { tokens, loading, cached, refreshCountdown } = useHotTokens(25);
 *
 * if (loading) return <div>Loading...</div>;
 * if (tokens.length === 0) return <div>No tokens</div>;
 *
 * return (
 *   <div>
 *     <p>{cached ? '⚡ Cached' : '🔄 Fresh'} data</p>
 *     <p>Refreshes in {Math.round(refreshCountdown / 1000)}s</p>
 *     {tokens.map(token => (
 *       <div key={token.baseMint}>{token.name}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useHotTokens(limit: number = 25): UseHotTokensResult {
  const [tokens, setTokens] = useState<HotToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [refreshTime, setRefreshTime] = useState<Date | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let countdownInterval: NodeJS.Timeout | null = null;

    const fetchHotTokens = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/hot-tokens?limit=${limit}`);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = (await response.json()) as HotTokensResponse;

        if (!isMounted) return;

        setTokens(data.tokens);
        setCached(data.cached);
        setRefreshTime(new Date(data.cacheExpiresAt));
        setRefreshCountdown(data.cacheRemainingMs);

        // Start countdown timer
        if (countdownInterval) clearInterval(countdownInterval);
        let remaining = data.cacheRemainingMs;

        countdownInterval = setInterval(() => {
          remaining -= 1000;
          if (remaining <= 0) {
            clearInterval(countdownInterval as any);
            // Cache will refresh next time user checks
          }
          setRefreshCountdown(Math.max(0, remaining));
        }, 1000);

        setLoading(false);
      } catch (err) {
        if (!isMounted) return;

        const message =
          err instanceof Error
            ? err.message
            : 'Failed to fetch hot tokens';

        setError(message);
        setLoading(false);
        console.error('Hot tokens fetch error:', err);
      }
    };

    fetchHotTokens();

    // Refresh when cache expires
    const refreshInterval = setInterval(fetchHotTokens, 60 * 60 * 1000); // 1 hour

    return () => {
      isMounted = false;
      if (countdownInterval) clearInterval(countdownInterval);
      clearInterval(refreshInterval);
    };
  }, [limit]);

  return {
    tokens,
    loading,
    error,
    cached,
    refreshTime,
    refreshCountdown,
  };
}