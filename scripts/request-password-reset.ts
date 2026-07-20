#!/usr/bin/env tsx
/**
 * Phoenix WS1.7 — request a Better Auth password reset for one email.
 *
 * Usage:
 *   npx tsx scripts/request-password-reset.ts --email user@example.com
 *   npx tsx scripts/request-password-reset.ts --email user@example.com --legacy
 *
 * Requires AUTH_PROVIDER-capable env: MONGODB_URI, BETTER_AUTH_SECRET,
 * BETTER_AUTH_URL (or NEXT_PUBLIC_SITE_URL), and RESEND_API_KEY for delivery.
 */

import { getAuth } from '../lib/auth';

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = (argValue('--email') || argValue('-e') || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx scripts/request-password-reset.ts --email user@example.com [--legacy]');
    process.exit(1);
  }

  if (process.argv.includes('--legacy')) {
    process.env.AUTH_LEGACY_RESET_COPY = '1';
  }

  // Ensure Better Auth path is allowed for this script even if AUTH_PROVIDER is still supabase.
  process.env.AUTH_PROVIDER = process.env.AUTH_PROVIDER || 'better-auth';

  const auth = await getAuth();
  const result = await auth.api.requestPasswordReset({
    body: {
      email,
      redirectTo: `${(process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')}/reset-password/confirm`,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        result: result ?? null,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('[request-password-reset] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
