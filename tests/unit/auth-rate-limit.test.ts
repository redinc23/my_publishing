import {
  authRateLimit,
  emailVerificationRateLimit,
  getAuthIdentifier,
  passwordResetRateLimit,
} from '../../lib/utils/auth-rate-limit';

describe('auth-rate-limit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
});
