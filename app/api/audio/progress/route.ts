/**
 * Listening Progress Sync API (audiobooks)
 *
 * GET  /api/audio/progress?book_id=<uuid>  → caller's saved position (or null)
 * PUT  /api/audio/progress                 → upsert caller's position
 *
 * Honest-scope contract:
 *   - Not signed in                → 401 { status: 'unauthenticated' }
 *     (client silently falls back to localStorage-only persistence).
 *   - listening_progress missing   → 503 { status: 'disabled' }
 *     (migration not applied yet — feature no-ops, never 500s the client).
 *   - Validation failure           → 400 { status: 'invalid' }.
 *
 * The user id is ALWAYS taken from the verified session, never from the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import {
  ListeningProgressGetSchema,
  ListeningProgressPutSchema,
  type ListeningProgressPut,
} from '@/lib/validations/audio';
import { validateSafe, getFirstError } from '@/lib/validations/schemas';

type Status = 'ok' | 'unauthenticated' | 'invalid' | 'disabled' | 'error' | 'limited';

interface ProgressRow {
  book_id: string;
  position_seconds: number;
  duration_seconds: number;
  updated_at: string;
}

function json(
  body: { status: Status; message?: string; progress?: ProgressRow | null; updated_at?: string },
  status: number,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(body, { status, headers });
}

/** Postgres/PostgREST "table does not exist" signals (migration not applied). */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /listening_progress.*does not exist/i.test(error.message ?? '');
}

/**
 * Resolve the caller's internal profile id (listening_progress.user_id
 * references profiles.id, matching reading_progress conventions).
 * Returns null when signed out or when no profile row exists.
 */
async function getProfileId(): Promise<{
  profileId: string | null;
  client: Awaited<ReturnType<typeof createClient>>;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { profileId: null, client: supabase };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  return { profileId: profile?.id ?? null, client: supabase };
}

async function rateLimit(request: NextRequest, key: string | null) {
  const identifier = key ?? getClientIdentifier(request);
  return enforceRateLimit('api', identifier);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const parsed = validateSafe(ListeningProgressGetSchema, { book_id: searchParams.get('book_id') });
  if (!parsed.success) {
    return json({ status: 'invalid', message: getFirstError(parsed.error) }, 400);
  }

  const rl = await rateLimit(request, null);
  if (!rl.success) {
    return json(
      {
        status: 'limited',
        message:
          rl.reason === 'unavailable'
            ? 'Rate limiter unavailable. Please try again shortly.'
            : 'Rate limit exceeded. Please slow down.',
      },
      rl.reason === 'unavailable' ? 503 : 429,
      rl.headers
    );
  }

  const { profileId, client } = await getProfileId();
  if (!profileId) {
    return json({ status: 'unauthenticated', message: 'Sign in to sync listening progress.' }, 401);
  }

  const { data, error } = await client
    .from('listening_progress')
    .select('book_id, position_seconds, duration_seconds, updated_at')
    .eq('user_id', profileId)
    .eq('book_id', parsed.data.book_id)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      return json({ status: 'disabled', message: 'Listening sync is not enabled yet.' }, 503);
    }
    console.error('[audio/progress] GET failed:', error);
    return json({ status: 'error', message: 'Could not load listening progress.' }, 500);
  }

  return json({ status: 'ok', progress: (data as ProgressRow | null) ?? null }, 200);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ status: 'invalid', message: 'Invalid JSON body.' }, 400);
  }

  const parsed = validateSafe(ListeningProgressPutSchema, body);
  if (!parsed.success) {
    return json({ status: 'invalid', message: getFirstError(parsed.error) }, 400);
  }

  const { profileId, client } = await getProfileId();
  if (!profileId) {
    return json({ status: 'unauthenticated', message: 'Sign in to sync listening progress.' }, 401);
  }

  const rl = await rateLimit(request, profileId);
  if (!rl.success) {
    return json(
      {
        status: 'limited',
        message:
          rl.reason === 'unavailable'
            ? 'Rate limiter unavailable. Please try again shortly.'
            : 'Rate limit exceeded. Please slow down.',
      },
      rl.reason === 'unavailable' ? 503 : 429,
      rl.headers
    );
  }

  const payload: ListeningProgressPut = parsed.data;
  const updatedAt = new Date().toISOString();

  const { error } = await client.from('listening_progress').upsert(
    {
      user_id: profileId,
      book_id: payload.book_id,
      position_seconds: payload.position_seconds,
      duration_seconds: payload.duration_seconds,
      updated_at: updatedAt,
    },
    { onConflict: 'user_id,book_id' }
  );

  if (error) {
    if (isMissingTable(error)) {
      return json({ status: 'disabled', message: 'Listening sync is not enabled yet.' }, 503);
    }
    console.error('[audio/progress] PUT failed:', error);
    return json({ status: 'error', message: 'Could not save listening progress.' }, 500);
  }

  return json({ status: 'ok', updated_at: updatedAt }, 200);
}
