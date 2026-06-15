import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function createRedis(): Redis | null {
  if (!isUpstashConfigured()) {
    return null;
  }

  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function createLimiter(
  prefix: string,
  requests: number,
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`
): Ratelimit | null {
  const redis = createRedis();
  if (!redis) {
    return null;
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix,
  });
}

export const authLimiter = createLimiter('ratelimit:auth', 5, '1 m');
export const uploadLimiter = createLimiter('ratelimit:upload', 30, '1 m');
export const generalLimiter = createLimiter('ratelimit:general', 100, '1 m');

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
    return PASS_THROUGH;
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
