/**
 * Dual-run request auth for API routes (Phoenix WS1 + WS2b).
 *
 * AUTH_PROVIDER=supabase → Supabase session
 * AUTH_PROVIDER=better-auth → Better Auth getSession({ headers })
 *
 * Never call from Edge middleware (Mongo/Better Auth DB path is Node-only).
 */

import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { normalizeManguRole, type ManguRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

export type ApiRequestUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: ManguRole;
};

export async function getApiRequestUser(): Promise<ApiRequestUser | null> {
  if (isBetterAuthPrimary()) {
    const auth = await getAuth();
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });
    if (!session?.user?.id) return null;
    return {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      role: normalizeManguRole((session.user as { role?: unknown }).role),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    name: profile?.full_name ?? user.user_metadata?.full_name ?? null,
    role: normalizeManguRole(profile?.role),
  };
}

export { canMutateCatalog } from '@/lib/auth/roles';
