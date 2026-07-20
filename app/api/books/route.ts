/**
 * Books API — Phoenix WS2b Task 2b.1.1
 *
 * GET  /api/books — paginated list (public published catalog by default)
 * POST /api/books — create (author/admin; dual-run Mongo | Supabase)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBooks, searchBooks } from '@/lib/mongo-queries';
import { createBookMongo } from '@/lib/mongo-books';
import { getRequestUser, isStaffRole } from '@/lib/api/request-user';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import type { BookStatus } from '@/types/mongo';

export const dynamic = 'force-dynamic';

const CreateBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  cover_url: z.string().url().optional().nullable(),
  manuscript_url: z.string().url().optional().nullable(),
  genre: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  author_id: z.string().min(1).optional(),
});

async function rateLimited(request: NextRequest) {
  const result = await enforceRateLimit('api', getClientIdentifier(request));
  if (result.success) return null;
  return NextResponse.json(
    {
      error: result.reason === 'unavailable' ? 'Rate limiter unavailable' : 'Rate limit exceeded',
    },
    {
      status: result.reason === 'unavailable' ? 503 : 429,
      headers: result.headers,
    }
  );
}

export async function GET(request: NextRequest) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get('perPage') || '20', 10) || 20));
  const q = sp.get('q')?.trim() || '';
  const genre = sp.get('genre')?.trim() || undefined;
  const status = (sp.get('status')?.trim() || 'published') as BookStatus;

  try {
    if (isMongoPrimary()) {
      const result = q
        ? await searchBooks(q, { page, perPage, status })
        : await getBooks({ status, genre }, { page, perPage });
      return NextResponse.json({
        success: true,
        provider: 'mongodb',
        ...result,
      });
    }

    const admin = createAdminClient();
    let query = admin
      .from('books')
      .select(PUBLIC_BOOK_SELECT, { count: 'exact' })
      .eq('status', status)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (genre) query = query.eq('genre', genre);
    if (q) query = query.textSearch('title', q, { type: 'websearch' });

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
    return NextResponse.json({
      success: true,
      provider: 'supabase',
      items: data ?? [],
      total,
      page,
      perPage,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1 && totalPages > 0,
    });
  } catch (error) {
    console.error('[api/books GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isStaffRole(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const authorId = user.role === 'admin' && input.author_id ? input.author_id : user.id;

  try {
    if (isMongoPrimary()) {
      const result = await createBookMongo({
        title: input.title,
        description: input.description,
        cover_url: input.cover_url,
        manuscript_url: input.manuscript_url,
        author_id: authorId,
        genre: input.genre,
        tags: input.tags,
        price: input.price,
        currency: input.currency,
        status: input.status,
        slug: input.slug,
      });
      if ('error' in result) {
        const status = result.code === 'DUPLICATE_SLUG' ? 409 : 400;
        return NextResponse.json(
          { success: false, error: result.error, code: result.code },
          { status }
        );
      }
      return NextResponse.json(
        { success: true, provider: 'mongodb', book: result.book },
        { status: 201 }
      );
    }

    const supabase = await createClient();
    const slug =
      input.slug ||
      input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const { data, error } = await supabase
      .from('books')
      .insert({
        title: input.title,
        description: input.description ?? null,
        cover_url: input.cover_url ?? null,
        manuscript_url: input.manuscript_url ?? null,
        genre: input.genre ?? null,
        tags: input.tags ?? [],
        price: input.price ?? 0,
        status: input.status ?? 'draft',
        slug,
        author_id: authorId,
        author_name: user.email || 'Author',
      })
      .select()
      .single();

    if (error) {
      const status = error.code === '23505' ? 409 : 500;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }

    return NextResponse.json({ success: true, provider: 'supabase', book: data }, { status: 201 });
  } catch (error) {
    console.error('[api/books POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
