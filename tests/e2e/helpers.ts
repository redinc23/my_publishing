/**
 * Shared helpers for Playwright E2E tests.
 */

/** True only when CI is wired to a real Supabase project (not mock/placeholder env). */
export function isRealSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return false;
  if (process.env.USE_MOCKS === 'true') return false;
  if (url.includes('placeholder')) return false;
  return true;
}
