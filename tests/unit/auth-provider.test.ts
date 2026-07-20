import { getAuthProvider, isBetterAuthPrimary } from '@/lib/auth/provider';
import { isManguRole, normalizeManguRole } from '@/lib/auth/roles';

describe('auth provider switch', () => {
  const original = process.env.AUTH_PROVIDER;

  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_PROVIDER;
    else process.env.AUTH_PROVIDER = original;
  });

  it('defaults to supabase (public dual-run)', () => {
    delete process.env.AUTH_PROVIDER;
    expect(getAuthProvider()).toBe('supabase');
    expect(isBetterAuthPrimary()).toBe(false);
  });

  it('recognizes better-auth', () => {
    process.env.AUTH_PROVIDER = 'better-auth';
    expect(getAuthProvider()).toBe('better-auth');
    expect(isBetterAuthPrimary()).toBe(true);
  });
});

describe('mangu roles (D9)', () => {
  it('accepts partner and rejects editor', () => {
    expect(isManguRole('partner')).toBe(true);
    expect(isManguRole('editor')).toBe(false);
    expect(normalizeManguRole('editor')).toBe('reader');
    expect(normalizeManguRole('admin')).toBe('admin');
  });
});
