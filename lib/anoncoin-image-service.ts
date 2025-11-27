/**
 * Anoncoin Image Service - WITH DEBUGGING
 * Location: lib/anoncoin-image-service.ts
 *
 * 🚀 Simple service: Fetch custom images from anoncoin.it CDN
 * Only handles images, not metadata (metadata comes from Token 2022 on-chain)
 */

const ANONCOIN_CDN = 'https://cdn.anoncoin.it';

/**
 * Check if image exists at anoncoin.it for a token symbol
 */
async function checkAnonCoinImage(symbol: string): Promise<string | null> {
  try {
    const imageUrl = `${ANONCOIN_CDN}/${symbol}/image.png`;

    // ✅ Use GET instead of HEAD - HEAD doesn't work reliably with all CDNs
    const response = await fetch(imageUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      console.log(`  ✅ Found image for ${symbol}`);
      return imageUrl;
    } else {
      console.warn(`  ⚠️ No image for ${symbol} (Status: ${response.status})`);
      return null;
    }
  } catch (error) {
    console.warn(`  ⚠️ Error fetching ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * ✅ Fetch anoncoin.it images for multiple tokens
 * 🚀 Only handles image fetching - no metadata, no API rate limits
 *
 * @param symbols - Array of token symbols to fetch images for
 * @param concurrency - Max parallel requests (high concurrency is safe - no rate limits on CDN)
 * @returns Map of symbol -> imageUrl (only includes found images)
 *
 * @example
 * const imageMap = await fetchAnonCoinImages(['DOGEOS', 'BONK', 'WIF']);
 * console.log(imageMap.get('DOGEOS')); // https://cdn.anoncoin.it/DOGEOS/image.png
 */
export async function fetchAnonCoinImages(
  symbols: string[],
  concurrency: number = 50  // High concurrency safe - no rate limits on CDN!
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  if (symbols.length === 0) {
    return results;
  }

  console.log(
    `📡 Fetching ${symbols.length} images from anoncoin.it (concurrency=${concurrency})`
  );
  console.log(`   Symbols: ${symbols.join(', ')}`);

  const startTime = Date.now();

  // Process in batches with high concurrency (CDN doesn't have rate limits)
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);

    // All image checks in parallel - high concurrency is safe!
    const promises = batch.map(symbol =>
      checkAnonCoinImage(symbol).then(imageUrl => ({
        symbol,
        imageUrl,
      }))
    );

    const batchResults = await Promise.all(promises);

    // Add found images to results
    batchResults.forEach(({ symbol, imageUrl }) => {
      if (imageUrl) {
        results.set(symbol, imageUrl);
      }
    });
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `✅ Got ${results.size}/${symbols.length} images from anoncoin.it in ${elapsed}ms`
  );

  return results;
}