/**
 * Shared helpers for Playwright E2E tests.
 */

/** True when CI has a real Supabase project, not placeholder env vars. */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!url) return false;
  if (url.includes('placeholder')) return false;
  if (process.env.USE_MOCKS === 'true') return false;
  return true;
}
