/**
 * Unit tests for upload-bucket rate limiting via the unified limiter (Fix C8).
 */
import {
  checkRateLimit,
  enforceRateLimit,
  getUploadLimiter,
  __resetMemoryRateLimit,
} from '@/lib/rate-limit';

const ORIGINAL_ENV = process.env;

describe('Book Action Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.USE_MOCKS;
    __resetMemoryRateLimit();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('checkRateLimit for upload actions', () => {
    it('passes through with null limiter outside production', async () => {
      const result = await checkRateLimit('user-123', null);
      expect(result.success).toBe(true);
      expect(result.headers).toEqual({});
    });

    it('allows upload within limit', async () => {
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: true,
          limit: 30,
          remaining: 15,
          reset: Date.now() + 60000,
        }),
      } as any;

      const result = await checkRateLimit('user-123', mockLimiter);
      expect(result.success).toBe(true);
      expect(result.limit).toBe(30);
      expect(result.remaining).toBe(15);
    });

    it('blocks upload when limit exceeded', async () => {
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: false,
          limit: 30,
          remaining: 0,
          reset: Date.now() + 45000,
        }),
      } as any;

      const result = await checkRateLimit('user-123', mockLimiter);
      expect(result.success).toBe(false);
      expect(result.headers).toHaveProperty('Retry-After');
    });

    it('FAILS CLOSED when the limiter errors', async () => {
      const mockLimiter = {
        limit: jest.fn().mockRejectedValue(new Error('upstash down')),
      } as any;

      const result = await checkRateLimit('user-123', mockLimiter);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('unavailable');
    });
  });

  describe('enforceRateLimit upload bucket (in-memory fallback)', () => {
    it('enforces 30/min per identifier without Upstash', async () => {
      let lastSuccess = true;
      for (let i = 0; i < 30; i++) {
        const r = await enforceRateLimit('upload', 'uploader-1');
        lastSuccess = r.success;
      }
      expect(lastSuccess).toBe(true);
      const blocked = await enforceRateLimit('upload', 'uploader-1');
      expect(blocked.success).toBe(false);
      expect(blocked.reason).toBe('limited');
    });
  });

  describe('getUploadLimiter', () => {
    it('returns null without UPSTASH credentials', () => {
      const limiter = getUploadLimiter();
      expect(limiter).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('handles empty identifier', async () => {
      const mockLimiter = {
        limit: jest.fn().mockResolvedValue({
          success: true,
          limit: 30,
          remaining: 29,
          reset: Date.now() + 60000,
        }),
      } as any;

      const result = await checkRateLimit('', mockLimiter);
      expect(result.success).toBe(true);
    });
  });
});
