/**
 * Shared helpers for Playwright E2E tests.
 */

import { test } from '@playwright/test';

const PLACEHOLDER_SUPABASE_PATTERN = /placeholder|example\.com|your-project/i;

/**
 * True when CI/local env has a real Supabase project URL (not a placeholder).
 * Supabase-dependent tests should skip when this is false.
 */
export function isRealSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return Boolean(url && !PLACEHOLDER_SUPABASE_PATTERN.test(url));
}

/**
 * WebKit under the Next.js dev server does not reliably hydrate client auth
 * forms before submit-side validation assertions.
 */
export function skipWebKitAuthValidation(browserName: string) {
  test.skip(
    browserName === 'webkit',
    'WebKit dev-server hydration does not reliably run client auth validation'
  );
}
