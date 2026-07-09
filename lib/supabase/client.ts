import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicEnv } from './public-env';

/**
 * Creates a Supabase client for use in Client Components
 */
export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
