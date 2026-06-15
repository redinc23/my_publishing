/**
 * @jest-environment node
 */

describe('book action rate limiting', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('passes through when Upstash is not configured', async () => {
    const { checkRateLimit, authLimiter } = await import('../../lib/rate-limit');
    const result = await checkRateLimit('test-user', authLimiter);
    expect(result.success).toBe(true);
    expect(result.headers).toEqual({});
  });

  it('exports null limiters when Upstash env is missing', async () => {
    const { authLimiter, uploadLimiter, generalLimiter } = await import('../../lib/rate-limit');
    expect(authLimiter).toBeNull();
    expect(uploadLimiter).toBeNull();
    expect(generalLimiter).toBeNull();
  });
});
