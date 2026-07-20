/**
 * Dual-run request auth for App Router handlers (Phoenix WS2b).
 *
 * AUTH_PROVIDER=supabase (default) → Supabase getUser()
 * AUTH_PROVIDER=better-auth → Better Auth getSession({ headers })
 *
 * Never import into Edge middleware — Better Auth session validation hits Mongo.
 */

import type { NextRequest } from 'next/server';
import { getAuth } from '@/lib/auth';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { createClient } from '@/lib/supabase/server';

export type RequestUser = {
  id: string;
  email?: string | null;
  role?: string | null;
};

export async function getRequestUser(request: NextRequest): Promise<RequestUser | null> {
  if (isBetterAuthPrimary()) {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return null;
    return {
      id: session.user.id,
      email: session.user.email ?? null,
      role: (session.user as { role?: string | null }).role ?? null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    role: (user.user_metadata?.role as string | undefined) ?? null,
  };
}
