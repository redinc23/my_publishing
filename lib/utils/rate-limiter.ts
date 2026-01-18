import { secureLogger } from './secure-logger';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
}

interface RequestLog {
  count: number;
  resetTime: number;
}

class SimpleRateLimiter {
  private requests: Map<string, RequestLog> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, log] of this.requests.entries()) {
      if (now > log.resetTime) {
        this.requests.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      secureLogger.debug('Rate limiter cleanup', { removed, remaining: this.requests.size });
    }
  }

  async check(identifier: string): Promise<RateLimitResult> {
    const key = this.config.keyPrefix ? `${this.config.keyPrefix}:${identifier}` : identifier;
    const now = Date.now();

    let log = this.requests.get(key);

    // Create new log if doesn't exist or expired
    if (!log || now > log.resetTime) {
      log = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
      this.requests.set(key, log);
    }

    // Increment count
    log.count++;

    const remaining = Math.max(0, this.config.maxRequests - log.count);
    const success = log.count <= this.config.maxRequests;

    if (!success) {
      secureLogger.warn('Rate limit exceeded', {
        identifier: key,
        count: log.count,
        limit: this.config.maxRequests,
      });
    }

    return {
      success,
      limit: this.config.maxRequests,
      remaining,
      reset: new Date(log.resetTime),
    };
  }

  async reset(identifier: string): Promise<void> {
    const key = this.config.keyPrefix ? `${this.config.keyPrefix}:${identifier}` : identifier;
    this.requests.delete(key);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

// Export factory function
export function createRateLimiter(config: RateLimitConfig): SimpleRateLimiter {
  return new SimpleRateLimiter(config);
}

// Pre-configured limiters
export const apiRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 60,
  keyPrefix: 'api',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 300000, // 5 minutes
  maxRequests: 5,
  keyPrefix: 'auth',
});
