describe('auth rate limit helpers', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('limits auth attempts after five requests for the same identifier', async () => {
    const { authRateLimit } = await import('@/lib/utils/auth-rate-limit');
    const identifier = `user-${Date.now()}@example.com`;

    for (let i = 0; i < 5; i += 1) {
      expect(authRateLimit(identifier)).toBe(true);
    }

    expect(authRateLimit(identifier)).toBe(false);
  });

  it('normalizes emails for password reset and verification limits', async () => {
    const { passwordResetRateLimit, emailVerificationRateLimit } = await import(
      '@/lib/utils/auth-rate-limit'
    );

    expect(passwordResetRateLimit('Reader@Example.com')).toBe(true);
    expect(passwordResetRateLimit('reader@example.com')).toBe(true);
    expect(passwordResetRateLimit('READER@example.com')).toBe(true);
    expect(passwordResetRateLimit('reader@example.com')).toBe(false);

    expect(emailVerificationRateLimit('Author@Example.com')).toBe(true);
    expect(emailVerificationRateLimit('author@example.com')).toBe(true);
    expect(emailVerificationRateLimit('AUTHOR@example.com')).toBe(true);
    expect(emailVerificationRateLimit('author@example.com')).toBe(false);
  });

  it('prefers lowercased email over IP for auth identifiers', async () => {
    const { getAuthIdentifier } = await import('@/lib/utils/auth-rate-limit');

    expect(getAuthIdentifier('203.0.113.10', 'User@Example.com')).toBe('user@example.com');
    expect(getAuthIdentifier('203.0.113.10')).toBe('203.0.113.10');
    expect(getAuthIdentifier(null)).toBe('unknown');
  });
});
