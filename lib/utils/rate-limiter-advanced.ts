import { Redis } from '@upstash/redis';
import { logger, AuditLogger } from './secure-logger';
import crypto from 'crypto';
import { EnhancedCircuitBreaker } from './circuit-breaker';

// ===== ENHANCED RATE LIMITER WITH MULTI-STRATEGY SUPPORT =====
export interface RateLimitConfig {
  limit: number;
  window: number; // seconds
  strategy?: 'fixed' | 'sliding' | 'token-bucket';
  burstAllowed?: boolean;
  cost?: number; // For weighted limits
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  totalRequests: number;
  limit: number;
  window: number;
  cost: number;
}

export class AdvancedRateLimiter {
  private redis: Redis;
  private auditLogger = AuditLogger.getInstance();

  // Memory fallback for Redis failures
  private memoryCache = new Map<string, { count: number; expiry: number }>();
  private circuitBreaker: EnhancedCircuitBreaker;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.min(1000 * 2 ** retryCount, 10000)
      }
    });

    this.circuitBreaker = new EnhancedCircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 5000,
      resetTimeout: 30000,
      name: 'redis-rate-limiter'
    });
  }

  async checkRateLimit(
    identifier: string,
    config: RateLimitConfig = { limit: 100, window: 3600 },
    metadata: Record<string, any> = {}
  ): Promise<RateLimitResult> {
    const {
      limit = 100,
      window = 3600,
      strategy = 'fixed',
      burstAllowed = false,
      cost = 1
    } = config;

    const now = Date.now();
    const windowMs = window * 1000;
    const key = this.generateKey(identifier, strategy);

    try {
      return await this.circuitBreaker.execute(async () => {
        let result: RateLimitResult;

        switch (strategy) {
          case 'sliding':
            result = await this.slidingWindowStrategy(key, limit, windowMs, cost, now);
            break;
          case 'token-bucket':
            result = await this.tokenBucketStrategy(key, limit, windowMs, cost, burstAllowed, now);
            break;
          case 'fixed':
          default:
            result = await this.fixedWindowStrategy(key, limit, windowMs, cost, now);
        }

        // Log critical rate limit breaches
        if (!result.allowed) {
          this.auditLogger.logSecurityEvent('RATE_LIMIT_BREACH', {
            identifier,
            ...metadata,
            ...result
          });
        }

        // Log high usage (80%+)
        if (result.remaining <= limit * 0.2) {
          logger.warn({
            identifier,
            remaining: result.remaining,
            limit,
            window
          }, 'Rate limit approaching threshold');
        }

        return result;
      });
    } catch (error: any) {
      // Fallback to memory-based rate limiting if Redis fails
      logger.error({ error: error.message, identifier }, 'Redis rate limit failed, falling back to memory');
      return this.memoryFallback(key, limit, windowMs, cost, now);
    }
  }

  private async fixedWindowStrategy(
    key: string,
    limit: number,
    windowMs: number,
    cost: number,
    now: number
  ): Promise<RateLimitResult> {
    const windowKey = `ratelimit:fixed:${key}:${Math.floor(now / windowMs)}`;

    const pipeline = this.redis.pipeline();
    pipeline.incrby(windowKey, cost);
    pipeline.expire(windowKey, Math.ceil(windowMs / 1000));
    pipeline.ttl(windowKey);

    const [count, _, ttl] = await pipeline.exec<[number, any, number]>();

    const totalRequests = count;
    const allowed = totalRequests <= limit;
    const remaining = Math.max(0, limit - totalRequests);
    const resetAt = now + (ttl * 1000);

    return { allowed, remaining, resetAt, totalRequests, limit, window: windowMs / 1000, cost };
  }

  private async slidingWindowStrategy(
    key: string,
    limit: number,
    windowMs: number,
    cost: number,
    now: number
  ): Promise<RateLimitResult> {
    const windowKey = `ratelimit:sliding:${key}`;
    const requestId = crypto.randomUUID();
    const cutoff = now - windowMs;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(windowKey, 0, cutoff); // Remove old requests
    pipeline.zadd(windowKey, { score: now, member: `${requestId}:${cost}` });
    pipeline.zrange(windowKey, 0, -1, { withScores: true });
    pipeline.expire(windowKey, Math.ceil(windowMs / 1000) * 2);

    const [, , requests] = await pipeline.exec<[any, any, Array<[string, number]>]>();

    let totalRequests = 0;
    requests?.forEach(([member]) => {
      const requestCost = parseInt(member.split(':')[1]) || 1;
      totalRequests += requestCost;
    });

    const allowed = totalRequests <= limit;
    const remaining = Math.max(0, limit - totalRequests);
    const resetAt = now + windowMs;

    return { allowed, remaining, resetAt, totalRequests, limit, window: windowMs / 1000, cost };
  }

  private async tokenBucketStrategy(
    key: string,
    limit: number,
    windowMs: number,
    cost: number,
    burstAllowed: boolean,
    now: number
  ): Promise<RateLimitResult> {
    const bucketKey = `ratelimit:token:${key}`;
    const refillRate = limit / (windowMs / 1000); // tokens per millisecond
    const burstSize = burstAllowed ? limit * 2 : limit;

    const luaScript = `
      local key = KEYS[1]
      local cost = tonumber(ARGV[1])
      local now = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local refillRate = tonumber(ARGV[4])
      local burstSize = tonumber(ARGV[5])

      local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local tokens = tonumber(bucket[1]) or limit
      local lastRefill = tonumber(bucket[2]) or now

      local timePassed = math.max(0, now - lastRefill)
      local refillAmount = math.floor(timePassed * refillRate)
      tokens = math.min(burstSize, tokens + refillAmount)
      lastRefill = now

      local allowed = tokens >= cost
      if allowed then
        tokens = tokens - cost
      end

      redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
      redis.call('EXPIRE', key, math.ceil((burstSize / refillRate) / 1000))

      return {allowed, tokens, lastRefill}
    `;

    const result = await this.redis.eval(
      luaScript,
      [bucketKey],
      [cost, now, limit, refillRate, burstSize]
    ) as [number, number, number];

    const [allowed, tokens] = result;
    const remaining = Math.max(0, tokens);
    const resetAt = now + Math.ceil((limit - tokens) / refillRate);

    return {
      allowed: allowed === 1,
      remaining,
      resetAt,
      totalRequests: limit - tokens + cost,
      limit,
      window: windowMs / 1000,
      cost
    };
  }

  private memoryFallback(
    key: string,
    limit: number,
    windowMs: number,
    cost: number,
    now: number
  ): RateLimitResult {
    const entry = this.memoryCache.get(key);

    if (!entry || now > entry.expiry) {
      // New window
      const newEntry = { count: cost, expiry: now + windowMs };
      this.memoryCache.set(key, newEntry);

      // Cleanup old entries
      this.cleanupMemoryCache(now);

      const allowed = cost <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - cost),
        resetAt: now + windowMs,
        totalRequests: cost,
        limit,
        window: windowMs / 1000,
        cost
      };
    }

    // Existing window
    const newCount = entry.count + cost;
    const allowed = newCount <= limit;

    if (allowed) {
      entry.count = newCount;
    }

    return {
      allowed,
      remaining: Math.max(0, limit - newCount),
      resetAt: entry.expiry,
      totalRequests: newCount,
      limit,
      window: windowMs / 1000,
      cost
    };
  }

  private cleanupMemoryCache(now: number): void {
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }

  private generateKey(identifier: string, strategy: string): string {
    // Hash identifier to prevent Redis key injection and reduce length
    const hash = crypto.createHash('sha256').update(identifier).digest('hex').slice(0, 16);
    return `${strategy}:${hash}`;
  }

  // ===== GLOBAL RATE LIMIT METHODS =====
  async getGlobalUsage(): Promise<Record<string, number>> {
    try {
      const keys = await this.redis.keys('ratelimit:*');
      const usage: Record<string, number> = {};

      for (const key of keys.slice(0, 100)) { // Limit to first 100 keys
        const count = await this.redis.get(key);
        if (typeof count === 'number') {
          usage[key] = count;
        }
      }

      return usage;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get global usage');
      return {};
    }
  }

  async resetRateLimit(identifier: string): Promise<void> {
    const patterns = [
      `ratelimit:fixed:${identifier}:*`,
      `ratelimit:sliding:${identifier}`,
      `ratelimit:token:${identifier}`
    ];

    try {
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      logger.info({ identifier }, 'Rate limit reset');
    } catch (error: any) {
      logger.error({ error: error.message, identifier }, 'Failed to reset rate limit');
    }
  }
}

// ===== SINGLETON INSTANCE =====
export const rateLimiter = new AdvancedRateLimiter();

// ===== MIDDLEWARE COMPATIBILITY =====
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (req: any, res: any, next: Function) => {
    const identifier = req.ip || req.socket.remoteAddress || 'unknown';

    const result = await rateLimiter.checkRateLimit(identifier, config, {
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent']
    });

    // Set rate limit headers (RFC 6585)
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((result.resetAt - Date.now()) / 1000)} seconds`,
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        limit: result.limit,
        window: result.window
      });
    }

    next();
  };
}
