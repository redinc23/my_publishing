/**
 * Books collection API (Phoenix WS2b Task 2b.1.1).
 *
 * GET  — paginated list (public; defaults to published when status omitted on Mongo)
 * POST — create book (authenticated author/admin)
 *
 * Dual-run: DATABASE_PROVIDER=mongodb uses mongo-queries; default supabase
 * keeps production behavior unchanged.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/api/request-auth';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBooks, insertBook, DEFAULT_PAGE_SIZE } from '@/lib/mongo-queries';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { BookStatus } from '@/types/mongo';

export const dynamic = 'force-dynamic';

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = parsePositiveInt(sp.get('page'), 1);
  const perPage = Math.min(
    100,
    parsePositiveInt(sp.get('perPage') ?? sp.get('limit'), DEFAULT_PAGE_SIZE)
  );
  const status = (sp.get('status') as BookStatus | null) ?? undefined;
  const genre = sp.get('genre') ?? undefined;
  const authorId = sp.get('authorId') ?? sp.get('author_id') ?? undefined;

  try {
    if (isMongoPrimary()) {
      const result = await getBooks(
        {
          status: status ?? 'published',
          genre,
          authorId,
        },
        { page, perPage }
      );
      return NextResponse.json({ success: true, ...result });
    }

    const admin = createAdminClient();
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    let query = admin
      .from('books')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    const effectiveStatus = status ?? 'published';
    query = query.eq('status', effectiveStatus);
    if (genre) query = query.eq('genre', genre);
    if (authorId) query = query.eq('author_id', authorId);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

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
    console.error('[api/books GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: {
      title?: string;
      description?: string;
      cover_url?: string;
      manuscript_url?: string;
      price?: number;
      discount_price?: number;
      genre?: string;
      tags?: string[];
      status?: BookStatus;
      slug?: string;
      author_id?: string;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
    }

    const slug = (body.slug?.trim() || slugify(title)).slice(0, 200);
    const status: BookStatus = body.status ?? 'draft';

    if (isMongoPrimary()) {
      const authorId = body.author_id?.trim() || user.id;
      const id = await insertBook({
        title,
        slug,
        description: body.description,
        cover_url: body.cover_url ?? null,
        manuscript_url: body.manuscript_url ?? null,
        author_id: authorId,
        status,
        price: body.price,
        discount_price: body.discount_price ?? null,
        genre: body.genre,
        tags: body.tags,
      });
      return NextResponse.json({ success: true, id }, { status: 201 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('books')
      .insert({
        title,
        slug,
        description: body.description ?? null,
        cover_url: body.cover_url ?? null,
        manuscript_url: body.manuscript_url ?? null,
        author_id: user.id,
        author_name: user.email || 'Anonymous',
        status,
        price: body.price ?? 0,
        discount_price: body.discount_price ?? null,
        tags: body.tags ?? [],
      })
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Failed to create book' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error) {
    console.error('[api/books POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
