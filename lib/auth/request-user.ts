/**
 * Dual-run request auth helper for API routes (Phoenix WS1 + WS2b).
 *
 * Resolves the current user from Better Auth or Supabase depending on
 * AUTH_PROVIDER. Never import this from Edge middleware — Better Auth's
 * full session path may touch Mongo (Node-only).
 */

import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { normalizeManguRole, type ManguRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

export type RequestAuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: ManguRole;
};

export async function getRequestAuthUser(
  requestHeaders?: Headers
): Promise<RequestAuthUser | null> {
  if (isBetterAuthPrimary()) {
    const auth = await getAuth();
    const hdrs = requestHeaders ?? (await headers());
    const session = await auth.api.getSession({ headers: hdrs });
    if (!session?.user?.id) return null;
    const role = normalizeManguRole((session.user as { role?: unknown }).role);
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const metaRole = (user.user_metadata as { role?: unknown } | undefined)?.role;
  return {
    id: user.id,
    email: user.email,
    name:
      (user.user_metadata as { full_name?: string } | undefined)?.full_name ??
      user.email ??
      null,
    role: normalizeManguRole(metaRole),
  };
}

export function canMutateBooks(role: ManguRole): boolean {
  return role === 'author' || role === 'partner' || role === 'admin';
}
