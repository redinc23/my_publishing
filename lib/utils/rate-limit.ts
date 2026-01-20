/**
 * Rate Limiting Utility
 * Production-grade rate limiter with multiple strategies
 */

import { LRUCache } from 'lru-cache';

/**
 * Rate limit configuration options
 */
interface RateLimitOptions {
  /** Time window in milliseconds */
  interval: number;
  /** Maximum number of unique tokens to track */
  uniqueTokenPerInterval?: number;
}

/**
 * Rate limit check result
 */
interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Time until rate limit resets (ms) */
  reset_in: number;
  /** Maximum requests allowed */
  limit: number;
}

/**
 * Create a rate limiter instance
 */
export function rateLimit(options: RateLimitOptions) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval,
  });

  return {
    /**
     * Check if a request is allowed
     * @param limit Maximum requests per interval
     * @param token Unique identifier (IP, user ID, etc.)
     * @returns Whether the request is allowed
     */
    check: (limit: number, token: string): boolean => {
      const now = Date.now();
      const timestamps = tokenCache.get(token) || [];
      const validTimestamps = timestamps.filter(
        (ts) => now - ts < options.interval
      );

      if (validTimestamps.length >= limit) {
        return false;
      }

      validTimestamps.push(now);
      tokenCache.set(token, validTimestamps);
      return true;
    },

    /**
     * Check with detailed result
     * @param limit Maximum requests per interval
     * @param token Unique identifier
     * @returns Detailed rate limit result
     */
    checkWithInfo: (limit: number, token: string): RateLimitResult => {
      const now = Date.now();
      const timestamps = tokenCache.get(token) || [];
      const validTimestamps = timestamps.filter(
        (ts) => now - ts < options.interval
      );

      const oldestTimestamp = validTimestamps[0] || now;
      const resetIn = Math.max(0, options.interval - (now - oldestTimestamp));

      if (validTimestamps.length >= limit) {
        return {
          allowed: false,
          remaining: 0,
          reset_in: resetIn,
          limit,
        };
      }

      validTimestamps.push(now);
      tokenCache.set(token, validTimestamps);

      return {
        allowed: true,
        remaining: limit - validTimestamps.length,
        reset_in: resetIn,
        limit,
      };
    },

    /**
     * Reset rate limit for a token
     * @param token Token to reset
     */
    reset: (token: string): void => {
      tokenCache.delete(token);
    },

    /**
     * Get current count for a token
     * @param token Token to check
     * @returns Current request count
     */
    getCount: (token: string): number => {
      const now = Date.now();
      const timestamps = tokenCache.get(token) || [];
      return timestamps.filter((ts) => now - ts < options.interval).length;
    },
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */

// General API rate limit: 60 requests per minute
export const apiRateLimit = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

// Strict rate limit: 10 requests per minute (for sensitive endpoints)
export const strictRateLimit = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

// Auth rate limit: 5 requests per minute (for login/signup)
export const authRateLimit = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 1000,
});

// Analytics rate limit: 100 requests per minute
export const analyticsRateLimit = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 1000,
});

// Webhook rate limit: 1000 requests per minute
export const webhookRateLimit = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
});

// Export rate limit: 5 requests per hour
export const exportRateLimit = rateLimit({
  interval: 60 * 60 * 1000,
  uniqueTokenPerInterval: 500,
});

/**
 * Get client identifier from request
 * @param request Next.js request object
 * @returns Client identifier string
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  // Priority: Cloudflare > X-Real-IP > X-Forwarded-For > fallback
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  if (realIp) {
    return realIp;
  }

  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  return 'unknown';
}

/**
 * Create rate limit headers for response
 * @param result Rate limit check result
 * @returns Headers object
 */
export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + result.reset_in / 1000).toString(),
    'Retry-After': result.allowed ? '' : Math.ceil(result.reset_in / 1000).toString(),
  };
}

/**
 * Rate limit middleware helper for API routes
 */
export function withRateLimit(
  limiter: ReturnType<typeof rateLimit>,
  limit: number
) {
  return async function checkRateLimit(request: Request): Promise<{
    allowed: boolean;
    response?: Response;
    headers: HeadersInit;
  }> {
    const clientId = getClientIdentifier(request);
    const result = limiter.checkWithInfo(limit, clientId);
    const headers = createRateLimitHeaders(result);

    if (!result.allowed) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Please try again in ${Math.ceil(result.reset_in / 1000)} seconds.`,
            retry_after: Math.ceil(result.reset_in / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
          }
        ),
        headers,
      };
    }

    return {
      allowed: true,
      headers,
    };
  };
}

/**
 * Sliding window rate limiter for more precise control
 */
export class SlidingWindowRateLimiter {
  private windows: Map<string, { count: number; timestamp: number }[]> = new Map();
  private windowSize: number;
  private maxWindows: number;

  constructor(
    private limit: number,
    private intervalMs: number,
    private precision: number = 10
  ) {
    this.windowSize = intervalMs / precision;
    this.maxWindows = precision;
  }

  check(token: string): RateLimitResult {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowSize);
    
    let windows = this.windows.get(token) || [];
    
    // Remove old windows
    windows = windows.filter(
      (w) => currentWindow - Math.floor(w.timestamp / this.windowSize) < this.maxWindows
    );

    // Count requests in current interval
    const count = windows.reduce((sum, w) => {
      const windowAge = currentWindow - Math.floor(w.timestamp / this.windowSize);
      const weight = 1 - windowAge / this.maxWindows;
      return sum + w.count * weight;
    }, 0);

    if (count >= this.limit) {
      const oldestWindow = windows[0];
      const resetIn = oldestWindow
        ? this.windowSize * this.maxWindows - (now - oldestWindow.timestamp)
        : this.intervalMs;

      return {
        allowed: false,
        remaining: 0,
        reset_in: Math.max(0, resetIn),
        limit: this.limit,
      };
    }

    // Add current request
    const lastWindow = windows[windows.length - 1];
    if (lastWindow && Math.floor(lastWindow.timestamp / this.windowSize) === currentWindow) {
      lastWindow.count++;
    } else {
      windows.push({ count: 1, timestamp: now });
    }

    this.windows.set(token, windows);

    return {
      allowed: true,
      remaining: Math.max(0, Math.floor(this.limit - count - 1)),
      reset_in: this.intervalMs,
      limit: this.limit,
    };
  }

  reset(token: string): void {
    this.windows.delete(token);
  }
}