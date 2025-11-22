/**
 * Server-side & Client-side Metadata Cache
 * Prevents duplicate requests and provides fast access to cached metadata
 *
 * Features:
 * - In-memory cache with TTL (5 minutes)
 * - Request deduplication (pending requests map)
 * - Automatic cache invalidation
 */

interface CachedMetadata {
  image?: string;
  description?: string;
  timestamp: number;
}

interface Token2022CachedMetadata {
  name?: string;
  symbol?: string;
  imageUrl?: string;
  description?: string;
  timestamp: number;
}

// In-memory cache for metadata JSON
const metadataJsonCache = new Map<string, CachedMetadata>();

// In-memory cache for Token 2022 metadata
const token2022MetadataCache = new Map<string, Token2022CachedMetadata>();

// Track pending requests to prevent duplicate concurrent requests
const pendingMetadataJsonRequests = new Map<
  string,
  Promise<{ image?: string; description?: string }>
>();

const pendingToken2022Requests = new Map<
  string,
  Promise<{
    name?: string;
    symbol?: string;
    imageUrl?: string;
    description?: string;
  }>
>();

// Cache TTL in milliseconds (30 days)
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * Get cached metadata JSON response
 * Returns null if not in cache or cache expired
 */
export function getCachedMetadataJson(
  uri: string
): { image?: string; description?: string } | null {
  const cached = metadataJsonCache.get(uri);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ [Cache Hit] Metadata JSON for ${uri.substring(0, 20)}...`);
    return { image: cached.image, description: cached.description };
  }

  if (cached) {
    // Cache expired, remove it
    metadataJsonCache.delete(uri);
  }

  return null;
}

/**
 * Get cached Token 2022 metadata
 * Returns null if not in cache or cache expired
 */
export function getCachedToken2022Metadata(
  mintAddress: string
): {
  name?: string;
  symbol?: string;
  imageUrl?: string;
  description?: string;
} | null {
  const cached = token2022MetadataCache.get(mintAddress);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ [Cache Hit] Token 2022 metadata for ${mintAddress.substring(0, 8)}...`);
    return {
      name: cached.name,
      symbol: cached.symbol,
      imageUrl: cached.imageUrl,
      description: cached.description,
    };
  }

  if (cached) {
    // Cache expired, remove it
    token2022MetadataCache.delete(mintAddress);
  }

  return null;
}

/**
 * Set cached metadata JSON response
 * Stores in memory with timestamp
 */
export function setCachedMetadataJson(
  uri: string,
  metadata: { image?: string; description?: string }
): void {
  metadataJsonCache.set(uri, {
    ...metadata,
    timestamp: Date.now(),
  });

  console.log(
    `💾 [Cache Set] Metadata JSON for ${uri.substring(0, 20)}... (TTL: 5 min)`
  );
}

/**
 * Set cached Token 2022 metadata
 * Stores in memory with timestamp
 */
export function setCachedToken2022Metadata(
  mintAddress: string,
  metadata: {
    name?: string;
    symbol?: string;
    imageUrl?: string;
    description?: string;
  }
): void {
  token2022MetadataCache.set(mintAddress, {
    ...metadata,
    timestamp: Date.now(),
  });

  console.log(
    `💾 [Cache Set] Token 2022 metadata for ${mintAddress.substring(0, 8)}... (TTL: 5 min)`
  );
}

/**
 * Get pending request promise if it exists
 * Prevents duplicate concurrent requests for same metadata
 */
export function getPendingMetadataJsonRequest(
  uri: string
): Promise<{ image?: string; description?: string }> | null {
  return pendingMetadataJsonRequests.get(uri) || null;
}

/**
 * Get pending request promise for Token 2022 if it exists
 * Prevents duplicate concurrent requests
 */
export function getPendingToken2022Request(
  mintAddress: string
): Promise<{
  name?: string;
  symbol?: string;
  imageUrl?: string;
  description?: string;
}> | null {
  return pendingToken2022Requests.get(mintAddress) || null;
}

/**
 * Register a pending metadata JSON request
 * Use with a promise to track ongoing requests
 */
export function setPendingMetadataJsonRequest(
  uri: string,
  promise: Promise<{ image?: string; description?: string }>
): void {
  pendingMetadataJsonRequests.set(uri, promise);

  // Auto-cleanup when promise settles
  promise
    .finally(() => {
      pendingMetadataJsonRequests.delete(uri);
    });
}

/**
 * Register a pending Token 2022 request
 * Use with a promise to track ongoing requests
 */
export function setPendingToken2022Request(
  mintAddress: string,
  promise: Promise<{
    name?: string;
    symbol?: string;
    imageUrl?: string;
    description?: string;
  }>
): void {
  pendingToken2022Requests.set(mintAddress, promise);

  // Auto-cleanup when promise settles
  promise.finally(() => {
    pendingToken2022Requests.delete(mintAddress);
  });
}

/**
 * Clear all caches (useful for testing or manual refresh)
 */
export function clearAllMetadataCache(): void {
  metadataJsonCache.clear();
  token2022MetadataCache.clear();
  pendingMetadataJsonRequests.clear();
  pendingToken2022Requests.clear();
  console.log('🧹 [Cache] All metadata caches cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  metadataJsonCacheSize: number;
  token2022CacheSize: number;
  pendingMetadataJsonRequests: number;
  pendingToken2022Requests: number;
} {
  return {
    metadataJsonCacheSize: metadataJsonCache.size,
    token2022CacheSize: token2022MetadataCache.size,
    pendingMetadataJsonRequests: pendingMetadataJsonRequests.size,
    pendingToken2022Requests: pendingToken2022Requests.size,
  };
}