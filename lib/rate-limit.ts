import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let authLimiter: Ratelimit | null = null;
let uploadLimiter: Ratelimit | null = null;
let generalLimiter: Ratelimit | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('[rate-limit] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set; skipping Redis rate limiter');
    return null;
  }
  return new Redis({ url, token });
}

function getAuthLimiter(): Ratelimit | null {
  if (!authLimiter) {
    const redis = getRedis();
    if (!redis) return null;
    authLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      analytics: true,
      prefix: "ratelimit:auth",
    });
  }
  return authLimiter;
}

function getUploadLimiter(): Ratelimit | null {
  if (!uploadLimiter) {
    const redis = getRedis();
    if (!redis) return null;
    uploadLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: true,
      prefix: "ratelimit:upload",
    });
  }
  return uploadLimiter;
}

function getGeneralLimiter(): Ratelimit | null {
  if (!generalLimiter) {
    const redis = getRedis();
    if (!redis) return null;
    generalLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true,
      prefix: "ratelimit:general",
    });
  }
  return generalLimiter;
}

export { getAuthLimiter, getUploadLimiter, getGeneralLimiter };

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  headers: Record<string, string>;
};

const PASS_THROUGH: RateLimitResult = {
  success: true,
  limit: 0,
  remaining: 0,
  reset: Date.now(),
  headers: {},
};

export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit | null
): Promise<RateLimitResult> {
  if (!limiter) {
    // Graceful degradation: pass through when no limiter available
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
      headers: {},
    };
  }
  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  return {
    success,
    limit,
    remaining,
    reset,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
      'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
    },
  };
}
