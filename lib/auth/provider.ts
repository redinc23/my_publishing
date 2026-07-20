/**
 * Auth-provider switch for Phoenix dual-run (WS1).
 *
 * AUTH_PROVIDER=supabase|better-auth
 * Default remains supabase so the public site keeps working until
 * Phase 11–12 cutover flips AUTH_PROVIDER=better-auth in Vercel.
 */

export type AuthProvider = 'supabase' | 'better-auth';

export function getAuthProvider(): AuthProvider {
  const raw = (process.env.AUTH_PROVIDER || 'supabase').toLowerCase();
  if (raw === 'better-auth' || raw === 'betterauth' || raw === 'ba') {
    return 'better-auth';
  }
  return 'supabase';
}

export function isBetterAuthPrimary(): boolean {
  return getAuthProvider() === 'better-auth';
}
