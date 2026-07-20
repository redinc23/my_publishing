import { getAuth } from '@/lib/auth';
import { isBetterAuthPrimary } from '@/lib/auth/provider';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function handle(request: Request): Promise<Response> {
  if (!isBetterAuthPrimary()) {
    return NextResponse.json(
      {
        error: 'Better Auth is not the active provider',
        hint: 'Set AUTH_PROVIDER=better-auth after Phase 11 cutover readiness',
      },
      { status: 503 }
    );
  }

  const auth = await getAuth();
  return auth.handler(request);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
