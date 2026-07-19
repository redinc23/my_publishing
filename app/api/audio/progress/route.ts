import { NextResponse } from 'next/server';
import {
  guardRateLimit,
  requireAuth,
  parseJsonBody,
  parseQuery,
  isMissingEngagementTable,
  migrationMissingResponse,
} from '@/lib/reading/engagement';
import { ListeningProgressGetSchema, ListeningProgressPutSchema } from '@/lib/validations/audio';

export const dynamic = 'force-dynamic';

async function getProfileId(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAuth>>['ctx']>['supabase'],
  userId: string
): Promise<{ id: string | null; response: NextResponse | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[audio-progress] profile lookup failed:', error);
    return {
      id: null,
      response: NextResponse.json({ error: 'Failed to load audio progress' }, { status: 500 }),
    };
  }
  if (!data?.id) {
    return {
      id: null,
      response: NextResponse.json({ error: 'Profile is not initialized' }, { status: 409 }),
    };
  }

  return { id: data.id as string, response: null };
}

/** GET /api/audio/progress?book_id=... — load the caller's saved position. */
export async function GET(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const query = parseQuery(request, ListeningProgressGetSchema);
  if (query.response) return query.response;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const profile = await getProfileId(ctx.supabase, ctx.user.id);
  if (profile.response) return profile.response;

  const { data, error } = await ctx.supabase
    .from('listening_progress')
    .select('book_id, position_seconds, duration_seconds, updated_at')
    .eq('user_id', profile.id)
    .eq('book_id', query.data.book_id)
    .maybeSingle();

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    console.error('[audio-progress] load failed:', error);
    return NextResponse.json({ error: 'Failed to load audio progress' }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok', progress: data ?? null });
}

/** PUT /api/audio/progress — save the caller's current playback position. */
export async function PUT(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const body = await parseJsonBody(request, ListeningProgressPutSchema);
  if (body.response) return body.response;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const profile = await getProfileId(ctx.supabase, ctx.user.id);
  if (profile.response) return profile.response;

  const { data, error } = await ctx.supabase
    .from('listening_progress')
    .upsert(
      {
        user_id: profile.id,
        book_id: body.data.book_id,
        position_seconds: body.data.position_seconds,
        duration_seconds: body.data.duration_seconds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' }
    )
    .select('book_id, position_seconds, duration_seconds, updated_at')
    .single();

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    console.error('[audio-progress] save failed:', error);
    return NextResponse.json({ error: 'Failed to save audio progress' }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok', progress: data });
}
