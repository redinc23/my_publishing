const PLACEHOLDER_SUPABASE_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';

function shouldUsePlaceholderConfig(): boolean {
  return (
    process.env.USE_MOCKS === 'true' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  );
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) return url;
  if (shouldUsePlaceholderConfig()) return PLACEHOLDER_SUPABASE_URL;
  return '';
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (key) return key;
  if (shouldUsePlaceholderConfig()) return PLACEHOLDER_SUPABASE_ANON_KEY;
  return '';
}
