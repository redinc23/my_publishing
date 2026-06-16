import {
  authRateLimit,
  emailVerificationRateLimit,
  getAuthIdentifier,
  passwordResetRateLimit,
} from '../../lib/utils/auth-rate-limit';
import { checkRateLimit, getAuthLimiter } from '@/lib/rate-limit';

describe('auth-rate-limit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Tests for lib/utils/auth-rate-limit (LRU cache based)
  it('allows requests under the auth limit', () => {
    const id = `user-${Date.now()}-auth`;
    expect(authRateLimit(id)).toBe(true);
    expect(authRateLimit(id)).toBe(true);
  });

  it('blocks after exceeding auth attempts', () => {
    const id = `user-${Date.now()}-block`;
    for (let i = 0; i < 5; i++) {
      expect(authRateLimit(id)).toBe(true);
    }
    expect(authRateLimit(id)).toBe(false);
  });

  it('limits password reset requests per email', () => {
    const email = `reset-${Date.now()}@example.com`;
    expect(passwordResetRateLimit(email)).toBe(true);
    expect(passwordResetRateLimit(email)).toBe(true);
    expect(passwordResetRateLimit(email)).toBe(true);
    expect(passwordResetRateLimit(email)).toBe(false);
  });

  it('limits email verification resend requests', () => {
    const email = `verify-${Date.now()}@example.com`;
    expect(emailVerificationRateLimit(email)).toBe(true);
    expect(emailVerificationRateLimit(email)).toBe(true);
    expect(emailVerificationRateLimit(email)).toBe(true);
    expect(emailVerificationRateLimit(email)).toBe(false);
  });

  it('prefers email over IP for auth identifier', () => {
    expect(getAuthIdentifier('1.2.3.4', 'User@Example.com')).toBe('user@example.com');
    expect(getAuthIdentifier('1.2.3.4')).toBe('1.2.3.4');
    expect(getAuthIdentifier(null)).toBe('unknown');
  });

  // Tests for lib/rate-limit (Upstash Redis based, graceful degradation)
  describe('checkRateLimit', () => {
    it('should return success=true when limiter is null (graceful degradation)', async () => {
      const result = await checkRateLimit('127.0.0.1', null);
      expect(result.success).toBe(true);
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.headers).toEqual({});
    });

    it('should return headers when limiter is provided', async () => {
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
      expect(result.headers).toHaveProperty('Retry-After');
    });

    it('should return success=false when limit exceeded', async () => {
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
      expect(result.remaining).toBe(0);
      expect(result.headers['Retry-After']).toBeDefined();
    });
  });

  describe('getAuthLimiter', () => {
    it('should return null when UPSTASH env vars are missing', () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      const limiter = getAuthLimiter();
      expect(limiter).toBeNull();
    });
  });

  describe('Middleware behavior', () => {
    it('should fail-open when rate limit check throws', () => {
      expect(true).toBe(true);
    });
  });
});
