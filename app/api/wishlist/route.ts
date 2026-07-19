import { NextResponse } from 'next/server';
import {
  guardRateLimit,
  requireAuth,
  parseJsonBody,
  parseQuery,
  isMissingEngagementTable,
  migrationMissingResponse,
  type WishlistRow,
} from '@/lib/reading/engagement';
import {
  WishlistMutationSchema,
  WishlistQuerySchema,
} from '@/lib/validations/reader-engagement';

export const dynamic = 'force-dynamic';

const WISHLIST_BOOK_SELECT =
  'id, title, slug, cover_url, price, discount_price, author:authors(id, pen_name)';

/**
 * GET /api/wishlist — the caller's wishlist with book details.
 * GET /api/wishlist?book_id=… — { wishlisted: boolean } toggle-state check.
 */
export async function GET(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const query = parseQuery(request, WishlistQuerySchema);
  if (query.response) return query.response;

  // Toggle-state probe for a single book.
  if (query.data.book_id) {
    const { data, error } = await ctx.supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', ctx.user.id)
      .eq('book_id', query.data.book_id)
      .maybeSingle();

    if (error) {
      if (isMissingEngagementTable(error)) return migrationMissingResponse();
      console.error('[wishlist] state check failed:', error);
      return NextResponse.json({ error: 'Failed to check wishlist' }, { status: 500 });
    }
    return NextResponse.json({ wishlisted: !!data });
  }

  const { data, error } = await ctx.supabase
    .from('wishlist')
    .select(`id, book_id, created_at, book:books(${WISHLIST_BOOK_SELECT})`)
    .eq('user_id', ctx.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    console.error('[wishlist] list failed:', error);
    return NextResponse.json({ error: 'Failed to load wishlist' }, { status: 500 });
  }

  // Drop rows whose book is no longer readable (unpublished/removed).
  const items = (data ?? []).filter(
    (row: { book?: unknown } | null) => row != null && row.book != null
  );
  return NextResponse.json({ items });
}

/** POST /api/wishlist — add a book to the caller's wishlist (idempotent). */
export async function POST(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const body = await parseJsonBody(request, WishlistMutationSchema);
  if (body.response) return body.response;

  const { book_id } = body.data;

  const { data, error } = await ctx.supabase
    .from('wishlist')
    .upsert(
      { user_id: ctx.user.id, book_id },
      { onConflict: 'user_id,book_id', ignoreDuplicates: true }
    )
    .select()
    .maybeSingle();

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    console.error('[wishlist] add failed:', error);
    return NextResponse.json({ error: 'Failed to update wishlist' }, { status: 500 });
  }

  // Best-effort analytics signal (engagement_events has a 'wishlist' type).
  // RLS blocks user-context inserts there, so use the service-role client
  // (same pattern as /api/resonance/track). Never blocks or fails the request.
  try {
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('id')
      .eq('user_id', ctx.user.id)
      .maybeSingle();
    if (profile?.id) {
      const { createClient: createAdminClient } = await import('@/lib/supabase/admin');
      await createAdminClient().from('engagement_events').insert({
        user_id: profile.id,
        book_id,
        event_type: 'wishlist',
        event_value: { source: 'wishlist_button' },
      });
    }
  } catch (eventError) {
    console.warn('[wishlist] engagement event skipped:', eventError);
  }

  return NextResponse.json(
    { wishlisted: true, item: (data as WishlistRow | null) ?? null },
    { status: 201 }
  );
}

/** DELETE /api/wishlist?book_id=… — remove a book from the caller's wishlist. */
export async function DELETE(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const fromQuery = new URL(request.url).searchParams.get('book_id');
  let bookId: string;
  if (fromQuery) {
    bookId = fromQuery;
  } else {
    const body = await parseJsonBody(request, WishlistMutationSchema);
    if (body.response) return body.response;
    bookId = body.data.book_id;
  }

  const { error } = await ctx.supabase
    .from('wishlist')
    .delete()
    .eq('user_id', ctx.user.id)
    .eq('book_id', bookId);

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    console.error('[wishlist] remove failed:', error);
    return NextResponse.json({ error: 'Failed to update wishlist' }, { status: 500 });
  }

  return NextResponse.json({ wishlisted: false });
}
