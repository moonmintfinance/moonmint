/**
 * Rate limiter using Upstash Redis
 * Works across multiple instances and persists across restarts
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private readonly windowMs: number; // Time window in ms
  private readonly maxRequests: number; // Max requests per window

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if request is allowed
   */
  async isAllowed(identifier: string): Promise<RateLimitResult> {
    try {
      const key = `rate-limit:${identifier}`;
      const now = Date.now();

      // Get current count
      const count = await redis.incr(key);

      // If this is the first request, set expiry
      if (count === 1) {
        await redis.expire(key, Math.ceil(this.windowMs / 1000));
      }

      // Get TTL for reset time
      const ttl = await redis.ttl(key);
      const resetTime = now + (ttl > 0 ? ttl * 1000 : this.windowMs);

      const remaining = Math.max(0, this.maxRequests - count);
      const allowed = count <= this.maxRequests;

      if (!allowed) {
        const retryAfter = Math.ceil((resetTime - now) / 1000);
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter,
        };
      }

      return {
        allowed: true,
        remaining,
        resetTime,
      };
    } catch (error) {
      console.error('❌ Rate limiter error:', error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: this.maxRequests,
        resetTime: Date.now() + this.windowMs,
      };
    }
  }

  /**
   * Reset rate limit for an identifier (useful for testing)
   */
  async reset(identifier: string): Promise<void> {
    try {
      const key = `rate-limit:${identifier}`;
      await redis.del(key);
    } catch (error) {
      console.error('❌ Error resetting rate limit:', error);
    }
  }
}

// ✅ Global instance - 10 requests per 60 seconds per IP
export const botChatLimiter = new RateLimiter(60000, 10);