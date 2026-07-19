import { NextResponse } from 'next/server';
import {
  guardRateLimit,
  requireAuth,
  parseJsonBody,
  parseQuery,
  isMissingEngagementTable,
  migrationMissingResponse,
} from '@/lib/reading/engagement';
import {
  AuthorFollowMutationSchema,
  AuthorFollowQuerySchema,
} from '@/lib/validations/reader-engagement';

export const dynamic = 'force-dynamic';

const AUTHOR_SELECT = 'id, pen_name, photo_url, bio, is_verified';

/**
 * Aggregate follower count for an author. RLS keeps author_follows rows
 * owner-visible, so the count is computed with the service-role client.
 * Returns null when the admin client is unavailable — never throws.
 */
async function getFollowerCount(authorId: string): Promise<number | null> {
  try {
    const { createClient: createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { count, error } = await admin
      .from('author_follows')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', authorId);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

/**
 * GET /api/follows?author_id=… — { following, followers } for one author.
 * GET /api/follows — the caller's followed authors with author details.
 */
export async function GET(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const query = parseQuery(request, AuthorFollowQuerySchema);
  if (query.response) return query.response;

  const { ctx, response } = await requireAuth();
  if (response) {
    // Anonymous visitors may still see the aggregate follower count for one
    // author (public social proof; never exposes who follows whom).
    if (query.data.author_id) {
      const followers = await getFollowerCount(query.data.author_id);
      return NextResponse.json({ following: false, followers });
    }
    return response;
  }

  if (query.data.author_id) {
    const authorId = query.data.author_id;
    const { data, error } = await ctx.supabase
      .from('author_follows')
      .select('id')
      .eq('user_id', ctx.user.id)
      .eq('author_id', authorId)
      .maybeSingle();

    if (error) {
      if (isMissingEngagementTable(error)) return migrationMissingResponse();
      console.error('[follows] state check failed:', error);
      return NextResponse.json({ error: 'Failed to check follow state' }, { status: 500 });
    }

    const followers = await getFollowerCount(authorId);
    return NextResponse.json({ following: !!data, followers });
  }

  const { data, error } = await ctx.supabase
    .from('author_follows')
    .select(`id, author_id, created_at, author:authors(${AUTHOR_SELECT})`)
    .eq('user_id', ctx.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    console.error('[follows] list failed:', error);
    return NextResponse.json({ error: 'Failed to load followed authors' }, { status: 500 });
  }

  const items = (data ?? []).filter(
    (row: { author?: unknown } | null) => row != null && row.author != null
  );
  return NextResponse.json({ items });
}

/** POST /api/follows — follow an author (idempotent). */
export async function POST(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const body = await parseJsonBody(request, AuthorFollowMutationSchema);
  if (body.response) return body.response;

  const { author_id } = body.data;

  const { error } = await ctx.supabase
    .from('author_follows')
    .upsert(
      { user_id: ctx.user.id, author_id },
      { onConflict: 'user_id,author_id', ignoreDuplicates: true }
    );

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 });
    }
    console.error('[follows] follow failed:', error);
    return NextResponse.json({ error: 'Failed to follow author' }, { status: 500 });
  }

  const followers = await getFollowerCount(author_id);
  return NextResponse.json({ following: true, followers }, { status: 201 });
}

/** DELETE /api/follows?author_id=… — unfollow an author. */
export async function DELETE(request: Request) {
  const limited = await guardRateLimit(request);
  if (limited) return limited;

  const { ctx, response } = await requireAuth();
  if (response) return response;

  const fromQuery = new URL(request.url).searchParams.get('author_id');
  let authorId: string;
  if (fromQuery) {
    authorId = fromQuery;
  } else {
    const body = await parseJsonBody(request, AuthorFollowMutationSchema);
    if (body.response) return body.response;
    authorId = body.data.author_id;
  }

  const { error } = await ctx.supabase
    .from('author_follows')
    .delete()
    .eq('user_id', ctx.user.id)
    .eq('author_id', authorId);

  if (error) {
    if (isMissingEngagementTable(error)) return migrationMissingResponse();
    console.error('[follows] unfollow failed:', error);
    return NextResponse.json({ error: 'Failed to unfollow author' }, { status: 500 });
  }

  const followers = await getFollowerCount(authorId);
  return NextResponse.json({ following: false, followers });
}
