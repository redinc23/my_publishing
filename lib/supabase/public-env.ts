/**
 * Shared NEXT_PUBLIC Supabase config for browser and server clients.
 * Allows static generation during CI/Cloud Build when secrets are not injected yet.
 */

export const CI_PLACEHOLDER_SUPABASE_URL = 'https://placeholder.supabase.co';
export const CI_PLACEHOLDER_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUyNjQwMDAsImV4cCI6MTk2MDg0MDAwMH0.placeholder';

function isBuildWithoutPublicEnv(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.USE_MOCKS === 'true'
  );
}

export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    return { url, anonKey };
  }

  if (isBuildWithoutPublicEnv()) {
    return {
      url: url || CI_PLACEHOLDER_SUPABASE_URL,
      anonKey: anonKey || CI_PLACEHOLDER_SUPABASE_ANON_KEY,
    };
  }

  return {
    url: url ?? '',
    anonKey: anonKey ?? '',
  };
}
