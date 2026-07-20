/**
 * Books collection API (Phoenix WS2b Task 2b.1.1).
 *
 * GET  /api/books — paginated list (public published by default)
 * POST /api/books — create draft (author|partner|admin)
 *
 * Dual-run: Mongo when DATABASE_PROVIDER=mongodb; Supabase otherwise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { canMutateBooks, getRequestAuthUser } from '@/lib/auth/request-user';
import { isMongoPrimary } from '@/lib/db/provider';
import { insertBook } from '@/lib/mongo-books';
import { getBooks } from '@/lib/mongo-queries';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createPublicCatalogClient } from '@/lib/supabase/public-queries';

export const dynamic = 'force-dynamic';

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

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get('page') || 1) || 1);
  const perPage = Math.min(100, Math.max(1, Number(sp.get('perPage') || sp.get('limit') || 20) || 20));
  const status = (sp.get('status') || 'published') as 'draft' | 'published' | 'archived';
  const genre = sp.get('genre') || undefined;
  const q = sp.get('q')?.trim();

  try {
    if (isMongoPrimary()) {
      if (q) {
        const { searchBooks } = await import('@/lib/mongo-queries');
        const result = await searchBooks(q, { page, perPage, status });
        return NextResponse.json({
          success: true,
          ...result,
          items: result.items.map((b) => serializeBook(b as unknown as Record<string, unknown>)),
        });
      }

      const result = await getBooks({ status, genre }, { page, perPage });
      return NextResponse.json({
        success: true,
        ...result,
        items: result.items.map((b) => serializeBook(b as unknown as Record<string, unknown>)),
      });
    }

    // Supabase path (prod default until Mongo cutover)
    const supabase = createPublicCatalogClient();
    const from = (page - 1) * perPage;
    let query = supabase
      .from('books')
      .select(
        'id, title, slug, description, cover_url, price, discount_price, status, visibility, genre, tags, average_rating, total_reviews, author_id, published_at, created_at',
        { count: 'exact' }
      )
      .eq('status', status === 'published' ? 'published' : status)
      .range(from, from + perPage - 1)
      .order('published_at', { ascending: false });

    if (status === 'published') {
      query = query.eq('visibility', 'public');
    }
    if (genre) query = query.eq('genre', genre);
    if (q) query = query.ilike('title', `%${q}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
    return NextResponse.json({
      success: true,
      items: data ?? [],
      total,
      page,
      perPage,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1 && totalPages > 0,
    });
  } catch (error) {
    console.error('[api/books] GET failed:', error);
    return jsonError('Failed to list books', 500);
  }
}

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const user = await getRequestAuthUser(request.headers);
  if (!user) return jsonError('Unauthorized', 401);
  if (!canMutateBooks(user.role)) {
    return jsonError('Forbidden — author, partner, or admin role required', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return jsonError('title is required', 400);

  try {
    if (isMongoPrimary()) {
      const book = await insertBook({
        title,
        description: typeof body.description === 'string' ? body.description : undefined,
        authorId: user.id,
        status: body.status === 'published' ? 'published' : 'draft',
        visibility: body.visibility === 'public' ? 'public' : 'private',
        price: typeof body.price === 'number' ? body.price : undefined,
        currency: typeof body.currency === 'string' ? body.currency : undefined,
        genre: typeof body.genre === 'string' ? body.genre : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        cover_url: typeof body.cover_url === 'string' ? body.cover_url : null,
        slug: typeof body.slug === 'string' ? body.slug : undefined,
      });

      return NextResponse.json(
        { success: true, data: serializeBook(book as unknown as Record<string, unknown>) },
        { status: 201 }
      );
    }

    const supabase = await createClient();
    const slug =
      (typeof body.slug === 'string' && body.slug.trim()) ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const { data, error } = await supabase
      .from('books')
      .insert({
        title,
        slug,
        description: typeof body.description === 'string' ? body.description : null,
        author_id: user.id,
        author_name: user.name || user.email || 'Anonymous',
        status: body.status === 'published' ? 'published' : 'draft',
        visibility: body.visibility === 'public' ? 'public' : 'private',
        price: typeof body.price === 'number' ? body.price : 0,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('[api/books] POST failed:', error);
    return jsonError('Failed to create book', 500);
  }
}
