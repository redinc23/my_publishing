import { NextResponse } from 'next/server';
import {
  guardRateLimit,
  requireAuth,
  parseJsonBody,
  parseQuery,
  isMissingEngagementTable,
  migrationMissingResponse,
  type BookmarkRow,
} from '@/lib/reading/engagement';
import {
  CreateBookmarkSchema,
  DeleteBookmarkSchema,
  ListBookmarksQuerySchema,
} from '@/lib/validations/reader-engagement';

export const dynamic = 'force-dynamic';

/** GET /api/bookmarks[?book_id=] — list the caller's bookmarks. */
export async function GET(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const query = parseQuery(request, ListBookmarksQuerySchema);
  if (query.response) return query.response;

  let q = ctx.supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', ctx.user.id)
    .order('created_at', { ascending: false });
  if (query.data.book_id) q = q.eq('book_id', query.data.book_id);

  const { data, error } = await q;
  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    console.error('[bookmarks] list failed:', error);
    return NextResponse.json({ error: 'Failed to load bookmarks' }, { status: 500 });
  }

  return NextResponse.json({ bookmarks: (data as BookmarkRow[]) ?? [] });
}

/** POST /api/bookmarks — create a bookmark (idempotent on unique position). */
export async function POST(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const body = await parseJsonBody(request, CreateBookmarkSchema);
  if (body.response) return body.response;

  const { book_id, position, label } = body.data;

  const { data, error } = await ctx.supabase
    .from('bookmarks')
    .upsert(
      { user_id: ctx.user.id, book_id, position, label: label ?? null },
      { onConflict: 'user_id,book_id,position' }
    )
    .select()
    .single();

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    console.error('[bookmarks] create failed:', error);
    return NextResponse.json({ error: 'Failed to save bookmark' }, { status: 500 });
  }

  return NextResponse.json({ bookmark: data as BookmarkRow }, { status: 201 });
}

/** DELETE /api/bookmarks — remove a bookmark by id (body or ?id=). */
export async function DELETE(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  // Accept id in JSON body or query string.
  const fromQuery = new URL(request.url).searchParams.get('id');
  let id: string;
  if (fromQuery) {
    id = fromQuery;
  } else {
    const body = await parseJsonBody(request, DeleteBookmarkSchema);
    if (body.response) return body.response;
    id = body.data.id;
  }

  const { error } = await ctx.supabase
    .from('bookmarks')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.user.id);

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    console.error('[bookmarks] delete failed:', error);
    return NextResponse.json({ error: 'Failed to delete bookmark' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
