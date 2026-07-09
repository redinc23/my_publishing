/** True when CI/local env points at a real Supabase project (not placeholder). */
export function hasRealSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return url.length > 0 && !/placeholder/i.test(url);
}
