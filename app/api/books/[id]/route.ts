/**
 * Book by id API (Phoenix WS2b Task 2b.1.2).
 *
 * GET   /api/books/[id]
 * PATCH /api/books/[id] — owner/admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { canMutateBooks, getRequestAuthUser } from '@/lib/auth/request-user';
import { isMongoPrimary } from '@/lib/db/provider';
import { updateBookById } from '@/lib/mongo-books';
import { getBookById } from '@/lib/mongo-queries';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createPublicCatalogClient } from '@/lib/supabase/public-queries';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

function resolveId(context: RouteContext): string {
  return context.params.id;
}

function jsonError(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ success: false, error: message }, { status, headers });
}

function serializeBook(book: Record<string, unknown>) {
  const id = book._id ?? book.id;
  return {
    ...book,
    id: id instanceof ObjectId ? id.toHexString() : id != null ? String(id) : undefined,
    _id: undefined,
  };
}

async function applyRateLimit(request: NextRequest) {
  const result = await enforceRateLimit('api', getClientIdentifier(request));
  if (result.success) return null;
  return jsonError(
    result.reason === 'unavailable'
      ? 'Rate limiter unavailable. Please try again shortly.'
      : 'Rate limit exceeded. Please try again later.',
    result.reason === 'unavailable' ? 503 : 429,
    result.headers
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const id = resolveId(context);
  if (!id) return jsonError('Book id required', 400);

  try {
    if (isMongoPrimary()) {
      const book = await getBookById(id);
      if (!book) return jsonError('Book not found', 404);
      return NextResponse.json({
        success: true,
        data: serializeBook(book as unknown as Record<string, unknown>),
      });
    }

    const supabase = createPublicCatalogClient();
    const { data, error } = await supabase.from('books').select('*').eq('id', id).single();
    if (error || !data) return jsonError('Book not found', 404);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[api/books/[id]] GET failed:', error);
    return jsonError('Failed to load book', 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const user = await getRequestAuthUser(request.headers);
  if (!user) return jsonError('Unauthorized', 401);
  if (!canMutateBooks(user.role)) {
    return jsonError('Forbidden — author, partner, or admin role required', 403);
  }

  const id = resolveId(context);
  if (!id) return jsonError('Book id required', 400);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  try {
    if (isMongoPrimary()) {
      const existing = await getBookById(id);
      if (!existing) return jsonError('Book not found', 404);

      const authorId =
        existing.author_id instanceof ObjectId
          ? existing.author_id.toHexString()
          : String(existing.author_id);
      if (user.role !== 'admin' && authorId !== user.id) {
        return jsonError('Forbidden — not the book owner', 403);
      }

      const updated = await updateBookById(id, {
        title: typeof body.title === 'string' ? body.title : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        status:
          body.status === 'published' || body.status === 'draft' || body.status === 'archived'
            ? body.status
            : undefined,
        visibility:
          body.visibility === 'public' ||
          body.visibility === 'private' ||
          body.visibility === 'unlisted'
            ? body.visibility
            : undefined,
        price: typeof body.price === 'number' ? body.price : undefined,
        currency: typeof body.currency === 'string' ? body.currency : undefined,
        genre: typeof body.genre === 'string' ? body.genre : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        cover_url: typeof body.cover_url === 'string' ? body.cover_url : undefined,
        manuscript_url: typeof body.manuscript_url === 'string' ? body.manuscript_url : undefined,
        slug: typeof body.slug === 'string' ? body.slug : undefined,
      });

      if (!updated) return jsonError('Book not found', 404);
      return NextResponse.json({
        success: true,
        data: serializeBook(updated as unknown as Record<string, unknown>),
      });
    }

    const supabase = await createClient();
    const { data: existing, error: loadError } = await supabase
      .from('books')
      .select('id, author_id')
      .eq('id', id)
      .single();

    if (loadError || !existing) return jsonError('Book not found', 404);
    if (user.role !== 'admin' && existing.author_id !== user.id) {
      return jsonError('Forbidden — not the book owner', 403);
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.title === 'string') patch.title = body.title.trim();
    if (typeof body.description === 'string') patch.description = body.description;
    if (body.status === 'published' || body.status === 'draft' || body.status === 'archived') {
      patch.status = body.status;
    }
    if (
      body.visibility === 'public' ||
      body.visibility === 'private' ||
      body.visibility === 'unlisted'
    ) {
      patch.visibility = body.visibility;
    }
    if (typeof body.price === 'number') patch.price = body.price;
    if (Array.isArray(body.tags)) patch.tags = body.tags.map(String);

    const { data, error } = await supabase
      .from('books')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[api/books/[id]] PATCH failed:', error);
    return jsonError('Failed to update book', 500);
  }
}
