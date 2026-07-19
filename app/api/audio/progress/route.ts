/**
 * GET/PUT /api/audio/progress — audiobook listening position sync.
 *
 * Auth: Supabase session required for every method.
 * Table: listening_progress (migration 20260719130000). When the migration
 * is missing the route returns 503 so the player can silently fall back to
 * localStorage-only persistence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateSafe, getFirstError } from '@/lib/validations/schemas';
import {
  ListeningProgressGetSchema,
  ListeningProgressPutSchema,
} from '@/lib/validations/audio';

export const dynamic = 'force-dynamic';

/** Detects "table does not exist" / schema-cache errors from PostgREST. */
function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    /listening_progress.*does not exist/i.test(error.message ?? '')
  );
}

function tableMissingResponse() {
  return NextResponse.json(
    { status: 'disabled', reason: 'listening_progress table missing' },
    { status: 503 }
  );
}

/** Resolve the caller's profiles.id (listening_progress.user_id FK target). */
async function getProfileId(supabase: Awaited<ReturnType<typeof createClient>>, authUserId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }

  const parsed = validateSafe(ListeningProgressGetSchema, {
    book_id: request.nextUrl.searchParams.get('book_id') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { status: 'error', message: getFirstError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const profileId = await getProfileId(supabase, user.id);
    if (!profileId) {
      return NextResponse.json({ status: 'ok', progress: null });
    }

    const { data, error } = await supabase
      .from('listening_progress')
      .select('position_seconds, duration_seconds, updated_at')
      .eq('user_id', profileId)
      .eq('book_id', parsed.data.book_id)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) return tableMissingResponse();
      console.error('[audio/progress] GET failed:', error);
      return NextResponse.json(
        { status: 'error', message: 'Failed to load progress' },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: 'ok', progress: data ?? null });
  } catch (error) {
    console.error('[audio/progress] GET unexpected:', error);
    return NextResponse.json({ status: 'error', message: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'error', message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = validateSafe(ListeningProgressPutSchema, body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: 'error', message: getFirstError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const profileId = await getProfileId(supabase, user.id);
    if (!profileId) {
      return NextResponse.json(
        { status: 'error', message: 'Profile not found' },
        { status: 404 }
      );
    }

    const { error } = await supabase.from('listening_progress').upsert(
      {
        user_id: profileId,
        book_id: parsed.data.book_id,
        position_seconds: parsed.data.position_seconds,
        duration_seconds: parsed.data.duration_seconds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' }
    );

    if (error) {
      if (isMissingTableError(error)) return tableMissingResponse();
      console.error('[audio/progress] PUT failed:', error);
      return NextResponse.json(
        { status: 'error', message: 'Failed to save progress' },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[audio/progress] PUT unexpected:', error);
    return NextResponse.json({ status: 'error', message: 'Internal error' }, { status: 500 });
  }
}
