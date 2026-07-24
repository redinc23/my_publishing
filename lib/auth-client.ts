/**
 * Better Auth React client (Phoenix WS1.2).
 * Safe for Client Components when AUTH_PROVIDER=better-auth.
 */

'use client';

import { createAuthClient } from 'better-auth/react';

function clientBaseURL(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') ||
    process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, '') ||
    'http://localhost:3000'
  );
}

export const authClient = createAuthClient({
  baseURL: clientBaseURL(),
});

export const { useSession, signIn, signUp, signOut } = authClient;
