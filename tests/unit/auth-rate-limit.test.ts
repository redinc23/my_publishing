/**
 * Unit tests for the unified fail-closed rate limiter (Fix C8).
 */
import {
  checkRateLimit,
  enforceRateLimit,
  getAuthLimiter,
  isUpstashConfigured,
  __resetMemoryRateLimit,
} from '@/lib/rate-limit';

const ORIGINAL_ENV = process.env;

describe('Auth Rate Limiting (unified, fail-closed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.USE_MOCKS;
    __resetMemoryRateLimit();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('isUpstashConfigured', () => {
    it('is false when env vars are missing', () => {
      expect(isUpstashConfigured()).toBe(false);
    });

    it('is false for placeholder/dummy values', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://dummy.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'dummy-token';
      expect(isUpstashConfigured()).toBe(false);
    });

    it('is false for non-upstash hosts', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://evil.example.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'a-real-looking-token-123456';
      expect(isUpstashConfigured()).toBe(false);
    });

    it('is true for real-shaped Upstash credentials', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://usw1-abc-12345.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'AXyzRealTokenValue0123456789';
      expect(isUpstashConfigured()).toBe(true);
    });
  });

  describe('checkRateLimit', () => {
    it('passes through with null limiter outside production (dev/test)', async () => {
      const result = await checkRateLimit('127.0.0.1', null);
      expect(result.success).toBe(true);
      expect(result.reason).toBe('ok');
      expect(result.headers).toEqual({});
    });

    it('returns headers when limiter allows', async () => {
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: true,
          limit: 5,
          remaining: 3,
          reset: Date.now() + 60000,
        }),
      } as any;

      const result = await checkRateLimit('127.0.0.1', mockLimiter);
      expect(result.success).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(3);
      expect(result.headers).toHaveProperty('X-RateLimit-Limit');
      expect(result.headers).toHaveProperty('X-RateLimit-Remaining');
    });

    it('returns success=false when limit exceeded', async () => {
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: false,
          limit: 5,
          remaining: 0,
          reset: Date.now() + 30000,
        }),
      } as any;

      const result = await checkRateLimit('127.0.0.1', mockLimiter);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('limited');
      expect(result.remaining).toBe(0);
      expect(result.headers['Retry-After']).toBeDefined();
    });

    it('FAILS CLOSED when the limiter throws (Upstash unreachable)', async () => {
      const mockLimiter = {
        limit: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      } as any;

      const result = await checkRateLimit('127.0.0.1', mockLimiter);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('unavailable');
      expect(result.headers['Retry-After']).toBeDefined();
    });
  });

  describe('enforceRateLimit (in-memory fallback in dev/test)', () => {
    it('enforces the auth bucket limit without Upstash', async () => {
      const results = [];
      for (let i = 0; i < 6; i++) {
        results.push(await enforceRateLimit('auth', '10.0.0.1'));
      }
      // auth bucket = 5/min → first 5 allowed, 6th rejected
      expect(results.slice(0, 5).every((r) => r.success)).toBe(true);
      expect(results[5].success).toBe(false);
      expect(results[5].reason).toBe('limited');
      expect(results[5].headers['Retry-After']).toBeDefined();
    });

    it('tracks identifiers independently', async () => {
      for (let i = 0; i < 5; i++) {
        await enforceRateLimit('auth', 'ip-a');
      }
      const blockedA = await enforceRateLimit('auth', 'ip-a');
      const freshB = await enforceRateLimit('auth', 'ip-b');
      expect(blockedA.success).toBe(false);
      expect(freshB.success).toBe(true);
    });

    it('FAILS CLOSED in production without Upstash configured', async () => {
      const env = process.env as Record<string, string | undefined>;
      const prevNodeEnv = env.NODE_ENV;
      env.NODE_ENV = 'production';
      try {
        const result = await enforceRateLimit('auth', '10.0.0.9');
        expect(result.success).toBe(false);
        expect(result.reason).toBe('unavailable');
      } finally {
        env.NODE_ENV = prevNodeEnv;
      }
    });

    it('does NOT fail closed in production when USE_MOCKS=true (CI/E2E)', async () => {
      const env = process.env as Record<string, string | undefined>;
      const prevNodeEnv = env.NODE_ENV;
      env.NODE_ENV = 'production';
      env.USE_MOCKS = 'true';
      try {
        const result = await enforceRateLimit('auth', '10.0.0.10');
        expect(result.success).toBe(true);
      } finally {
        env.NODE_ENV = prevNodeEnv;
        delete env.USE_MOCKS;
      }
    });
  });

  describe('getAuthLimiter', () => {
    it('returns null when UPSTASH env vars are missing', () => {
      const limiter = getAuthLimiter();
      expect(limiter).toBeNull();
    });
  });
});
