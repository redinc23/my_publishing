import { checkRateLimit, getUploadLimiter } from '@/lib/rate-limit';

describe('Book Action Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit for upload actions', () => {
    it('should gracefully degrade when limiter is null', async () => {
      const result = await checkRateLimit('user-123', null);
      expect(result.success).toBe(true);
      expect(result.headers).toEqual({});
    });

    it('should allow upload within limit', async () => {
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

    it('should block upload when limit exceeded', async () => {
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
  });

  describe('getUploadLimiter', () => {
    it('should return null without UPSTASH credentials', () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      const limiter = getUploadLimiter();
      expect(limiter).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty identifier', async () => {
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
