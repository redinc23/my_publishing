/**
 * Dual-run API auth helper (Phoenix WS2b).
 *
 * Resolves the current user for route handlers without redirecting.
 * - AUTH_PROVIDER=supabase (default): cookie session via Supabase
 * - AUTH_PROVIDER=better-auth: session via Better Auth (headers)
 */

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { getAuth } from '@/lib/auth';
import { normalizeManguRole, type ManguRole } from '@/lib/auth/roles';

export type ApiRequestUser = {
  id: string;
  email?: string | null;
  role: ManguRole;
};

export async function getRequestUser(): Promise<ApiRequestUser | null> {
  if (isBetterAuthPrimary()) {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return null;
    const role = normalizeManguRole((session.user as { role?: unknown }).role);
    return {
      id: session.user.id,
      email: session.user.email ?? null,
      role,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    role: normalizeManguRole(profile?.role),
  };
}

export function isStaffRole(role: ManguRole): boolean {
  return role === 'admin' || role === 'author' || role === 'partner';
}
