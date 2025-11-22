'use client';

/**
 * Client-side Metadata Cache with localStorage Persistence
 * Prevents duplicate requests and provides fast access to cached metadata
 *
 * Features:
 * - In-memory cache for performance (current session)
 * - localStorage persistence across 30-day TTL
 * - Request deduplication (pending requests map)
 * - Automatic cache invalidation after 30 days
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

// In-memory cache for performance (session only)
const metadataJsonCache = new Map<string, CachedMetadata>();
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

// localStorage key prefixes
const METADATA_JSON_STORAGE_KEY = 'metadata_json_';
const TOKEN2022_STORAGE_KEY = 'token2022_';

/**
 * Check if localStorage is available (safe for SSR)
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    typeof window !== 'undefined' && window.localStorage.setItem(test, test);
    typeof window !== 'undefined' && window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get item from localStorage safely
 */
function getFromStorage<T>(key: string): T | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.warn(`❌ Failed to parse localStorage item: ${key}`, error);
    return null;
  }
}

/**
 * Set item to localStorage safely
 */
function setToStorage<T>(key: string, value: T): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`❌ Failed to store item in localStorage: ${key}`, error);
  }
}

/**
 * Get cached metadata JSON response
 * Checks in-memory cache first, then localStorage
 * Returns null if not in cache or cache expired
 */
export function getCachedMetadataJson(
  uri: string
): { image?: string; description?: string } | null {
  // Try in-memory cache first (fastest)
  const inMemory = metadataJsonCache.get(uri);
  if (inMemory && Date.now() - inMemory.timestamp < CACHE_TTL) {
    console.log(`✅ [Memory Cache Hit] Metadata JSON for ${uri.substring(0, 20)}...`);
    return { image: inMemory.image, description: inMemory.description };
  }

  // Try localStorage
  const storageKey = METADATA_JSON_STORAGE_KEY + uri;
  const cached = getFromStorage<CachedMetadata>(storageKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ [Storage Cache Hit] Metadata JSON for ${uri.substring(0, 20)}...`);
    // Restore to in-memory cache for this session
    metadataJsonCache.set(uri, cached);
    return { image: cached.image, description: cached.description };
  }

  if (cached || inMemory) {
    // Cache expired, remove it
    metadataJsonCache.delete(uri);
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(storageKey);
    }
  }

  return null;
}

/**
 * Get cached Token 2022 metadata
 * Checks in-memory cache first, then localStorage
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
  // Try in-memory cache first (fastest)
  const inMemory = token2022MetadataCache.get(mintAddress);
  if (inMemory && Date.now() - inMemory.timestamp < CACHE_TTL) {
    console.log(`✅ [Memory Cache Hit] Token 2022 metadata for ${mintAddress.substring(0, 8)}...`);
    return {
      name: inMemory.name,
      symbol: inMemory.symbol,
      imageUrl: inMemory.imageUrl,
      description: inMemory.description,
    };
  }

  // Try localStorage
  const storageKey = TOKEN2022_STORAGE_KEY + mintAddress;
  const cached = getFromStorage<Token2022CachedMetadata>(storageKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ [Storage Cache Hit] Token 2022 metadata for ${mintAddress.substring(0, 8)}...`);
    // Restore to in-memory cache for this session
    token2022MetadataCache.set(mintAddress, cached);
    return {
      name: cached.name,
      symbol: cached.symbol,
      imageUrl: cached.imageUrl,
      description: cached.description,
    };
  }

  if (cached || inMemory) {
    // Cache expired, remove it
    token2022MetadataCache.delete(mintAddress);
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(storageKey);
    }
  }

  return null;
}

/**
 * Set cached metadata JSON response
 * Stores in both in-memory cache and localStorage
 */
export function setCachedMetadataJson(
  uri: string,
  metadata: { image?: string; description?: string }
): void {
  const cacheData: CachedMetadata = {
    ...metadata,
    timestamp: Date.now(),
  };

  // Store in memory
  metadataJsonCache.set(uri, cacheData);

  // Store in localStorage
  const storageKey = METADATA_JSON_STORAGE_KEY + uri;
  setToStorage(storageKey, cacheData);

  console.log(
    `💾 [Cache Set] Metadata JSON for ${uri.substring(0, 20)}... (TTL: 30 days)`
  );
}

/**
 * Set cached Token 2022 metadata
 * Stores in both in-memory cache and localStorage
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
  const cacheData: Token2022CachedMetadata = {
    ...metadata,
    timestamp: Date.now(),
  };

  // Store in memory
  token2022MetadataCache.set(mintAddress, cacheData);

  // Store in localStorage
  const storageKey = TOKEN2022_STORAGE_KEY + mintAddress;
  setToStorage(storageKey, cacheData);

  console.log(
    `💾 [Cache Set] Token 2022 metadata for ${mintAddress.substring(0, 8)}... (TTL: 30 days)`
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
  promise.finally(() => {
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
  // Clear in-memory caches
  metadataJsonCache.clear();
  token2022MetadataCache.clear();
  pendingMetadataJsonRequests.clear();
  pendingToken2022Requests.clear();

  // Clear localStorage
  if (isLocalStorageAvailable()) {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(METADATA_JSON_STORAGE_KEY) || key.startsWith(TOKEN2022_STORAGE_KEY))
      ) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => localStorage.removeItem(key));
  }

  console.log('🧹 [Cache] All metadata caches cleared (memory + storage)');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  metadataJsonCacheSize: number;
  token2022CacheSize: number;
  pendingMetadataJsonRequests: number;
  pendingToken2022Requests: number;
  storageSize: number;
} {
  let storageSize = 0;

  if (isLocalStorageAvailable()) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(METADATA_JSON_STORAGE_KEY) || key.startsWith(TOKEN2022_STORAGE_KEY))
      ) {
        const item = localStorage.getItem(key);
        if (item) {
          storageSize += item.length;
        }
      }
    }
  }

  return {
    metadataJsonCacheSize: metadataJsonCache.size,
    token2022CacheSize: token2022MetadataCache.size,
    pendingMetadataJsonRequests: pendingMetadataJsonRequests.size,
    pendingToken2022Requests: pendingToken2022Requests.size,
    storageSize,
  };
}