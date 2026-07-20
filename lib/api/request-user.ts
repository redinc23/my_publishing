/**
 * Dual-run API auth helper (Phoenix WS2b).
 *
 * Resolves the current user for Route Handlers without redirects.
 * AUTH_PROVIDER=better-auth → Better Auth session (role on user).
 * AUTH_PROVIDER=supabase (default) → Supabase auth + profiles.role.
 */

import type { NextRequest } from 'next/server';
import { getAuth } from '@/lib/auth';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { normalizeManguRole, type ManguRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

export type ApiUser = {
  id: string;
  email: string | null;
  role: ManguRole;
  name?: string | null;
};

export async function getApiUser(request: NextRequest): Promise<ApiUser | null> {
  if (isBetterAuthPrimary()) {
    try {
      const auth = await getAuth();
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user?.id) return null;
      const role = normalizeManguRole((session.user as { role?: unknown }).role);
      return {
        id: session.user.id,
        email: session.user.email ?? null,
        role,
        name: session.user.name ?? null,
      };
    } catch (error) {
      console.error('[api] Better Auth getSession failed:', error);
      return null;
    }
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email ?? null,
      role: normalizeManguRole(profile?.role),
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
    };
  } catch (error) {
    console.error('[api] Supabase getUser failed:', error);
    return null;
  }
}

export function canMutateBooks(user: ApiUser): boolean {
  return user.role === 'author' || user.role === 'admin' || user.role === 'partner';
}

export function canAdminBooks(user: ApiUser): boolean {
  return user.role === 'admin';
}
