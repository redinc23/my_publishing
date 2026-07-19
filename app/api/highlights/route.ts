import { NextResponse } from 'next/server';
import {
  guardRateLimit,
  requireAuth,
  parseJsonBody,
  parseQuery,
  isMissingEngagementTable,
  migrationMissingResponse,
  type HighlightRow,
} from '@/lib/reading/engagement';
import {
  CreateHighlightSchema,
  DeleteHighlightSchema,
  ListHighlightsQuerySchema,
  UpdateHighlightSchema,
} from '@/lib/validations/reader-engagement';

export const dynamic = 'force-dynamic';

/** GET /api/highlights[?book_id=][&with_notes=true] — list the caller's highlights. */
export async function GET(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const query = parseQuery(request, ListHighlightsQuerySchema);
  if (query.response) return query.response;

  let q = ctx.supabase
    .from('highlights')
    .select('*')
    .eq('user_id', ctx.user.id)
    .order('created_at', { ascending: false });
  if (query.data.book_id) q = q.eq('book_id', query.data.book_id);
  if (query.data.with_notes === 'true') q = q.not('note', 'is', null);

  const { data, error } = await q;
  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    console.error('[highlights] list failed:', error);
    return NextResponse.json({ error: 'Failed to load highlights' }, { status: 500 });
  }

  return NextResponse.json({ highlights: (data as HighlightRow[]) ?? [] });
}

/**
 * POST /api/highlights — create a highlight (optionally with a note).
 * Idempotent: an identical highlight (same book, text, position) returns the
 * existing row instead of a duplicate.
 */
export async function POST(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const body = await parseJsonBody(request, CreateHighlightSchema);
  if (body.response) return body.response;

  const { book_id, selected_text, position, color, note } = body.data;

  // Dedupe identical highlight (double-click / retry safety).
  let dupQuery = ctx.supabase
    .from('highlights')
    .select('*')
    .eq('user_id', ctx.user.id)
    .eq('book_id', book_id)
    .eq('selected_text', selected_text);
  dupQuery = position ? dupQuery.eq('position', position) : dupQuery.is('position', null);
  const { data: existing, error: dupError } = await dupQuery.limit(1).maybeSingle();

  if (dupError && isMissingEngagementTable(dupError)) return migrationMissingResponse();
  if (existing) {
    return NextResponse.json({ highlight: existing as HighlightRow }, { status: 200 });
  }

  const { data, error } = await ctx.supabase
    .from('highlights')
    .insert({
      user_id: ctx.user.id,
      book_id,
      selected_text,
      position: position ?? null,
      color,
      note: note ?? null,
    })
    .select()
    .single();

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    console.error('[highlights] create failed:', error);
    return NextResponse.json({ error: 'Failed to save highlight' }, { status: 500 });
  }

  return NextResponse.json({ highlight: data as HighlightRow }, { status: 201 });
}

/** PATCH /api/highlights — update color and/or note of an own highlight. */
export async function PATCH(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const body = await parseJsonBody(request, UpdateHighlightSchema);
  if (body.response) return body.response;

  const { id, color, note } = body.data;
  const patch: Record<string, unknown> = {};
  if (color !== undefined) patch.color = color;
  if (note !== undefined) patch.note = note; // null clears the note

  const { data, error } = await ctx.supabase
    .from('highlights')
    .update(patch)
    .eq('id', id)
    .eq('user_id', ctx.user.id)
    .select()
    .maybeSingle();

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    console.error('[highlights] update failed:', error);
    return NextResponse.json({ error: 'Failed to update highlight' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Highlight not found' }, { status: 404 });
  }

  return NextResponse.json({ highlight: data as HighlightRow });
}

/** DELETE /api/highlights — remove a highlight by id (body or ?id=). */
export async function DELETE(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const fromQuery = new URL(request.url).searchParams.get('id');
  let id: string;
  if (fromQuery) {
    id = fromQuery;
  } else {
    const body = await parseJsonBody(request, DeleteHighlightSchema);
    if (body.response) return body.response;
    id = body.data.id;
  }

  const { error } = await ctx.supabase
    .from('highlights')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.user.id);

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    console.error('[highlights] delete failed:', error);
    return NextResponse.json({ error: 'Failed to delete highlight' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
