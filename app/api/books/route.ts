/**
 * Books API — list + create (Phoenix WS2b Task 2b.1.1)
 *
 * Dual-run: DATABASE_PROVIDER=mongodb uses mongo-queries;
 * default supabase keeps production on Postgres until cutover.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canMutateBooks, getApiUser } from '@/lib/api/request-user';
import { isMongoPrimary } from '@/lib/db/provider';
import { createBook, getBooks } from '@/lib/mongo-queries';
import { serializeMongoDoc } from '@/lib/mongo-serialize';
import { createClient } from '@/lib/supabase/server';
import { createPublicCatalogClient, PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';

export const dynamic = 'force-dynamic';

const CreateBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  author_id: z.string().min(1).optional(),
  cover_url: z.string().url().optional().nullable(),
  manuscript_url: z.string().url().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  genre: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function parsePagination(request: NextRequest) {
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') ?? '1') || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get('perPage') ?? '20') || 20)
  );
  return { page, perPage };
}

export async function GET(request: NextRequest) {
  try {
    const { page, perPage } = parsePagination(request);
    const statusParam = request.nextUrl.searchParams.get('status');
    const genre = request.nextUrl.searchParams.get('genre') ?? undefined;
    const q = request.nextUrl.searchParams.get('q')?.trim();

    if (isMongoPrimary()) {
      const { searchBooks } = await import('@/lib/mongo-queries');
      if (q) {
        const result = await searchBooks(q, {
          page,
          perPage,
          status: (statusParam as 'published' | undefined) ?? 'published',
        });
        return NextResponse.json({
          success: true,
          ...result,
          items: result.items.map((b) => serializeMongoDoc(b)),
        });
      }

      const result = await getBooks(
        {
          status: (statusParam as 'draft' | 'published' | 'archived' | undefined) ?? 'published',
          genre,
        },
        { page, perPage }
      );
      return NextResponse.json({
        success: true,
        ...result,
        items: result.items.map((b) => serializeMongoDoc(b)),
      });
    }

    const supabase = createPublicCatalogClient();
    const status = statusParam ?? 'published';
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('books')
      .select(PUBLIC_BOOK_SELECT, { count: 'exact' })
      .eq('status', status)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status === 'published') {
      query = query.eq('visibility', 'public');
    }

    if (genre) query = query.contains('categories', [genre]);
    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

    const { data, error, count } = await query;
    if (error) {
      console.error('[api/books] supabase list failed:', error);
      return NextResponse.json({ success: false, error: 'Failed to list books' }, { status: 500 });
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
    console.error('[api/books] GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canMutateBooks(user)) {
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
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body' },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const slug = input.slug ?? slugify(input.title);
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Could not derive slug' }, { status: 400 });
    }

    if (isMongoPrimary()) {
      const authorId = input.author_id ?? user.id;
      const book = await createBook({
        title: input.title,
        slug,
        author_id: authorId,
        description: input.description,
        cover_url: input.cover_url,
        manuscript_url: input.manuscript_url,
        status: input.status ?? 'draft',
        price: input.price,
        currency: input.currency,
        genre: input.genre,
        tags: input.tags,
      });
      return NextResponse.json({ success: true, book: serializeMongoDoc(book) }, { status: 201 });
    }

    const supabase = await createClient();
    const { data: book, error } = await supabase
      .from('books')
      .insert({
        title: input.title,
        slug,
        description: input.description ?? null,
        cover_url: input.cover_url ?? null,
        manuscript_url: input.manuscript_url ?? null,
        author_id: input.author_id ?? user.id,
        status: input.status ?? 'draft',
        price: input.price ?? 0,
      })
      .select(PUBLIC_BOOK_SELECT)
      .single();

    if (error) {
      const status = error.code === '23505' ? 409 : 500;
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to create book' },
        { status }
      );
    }

    return NextResponse.json({ success: true, book }, { status: 201 });
  } catch (error) {
    console.error('[api/books] POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const conflict = /duplicate|E11000/i.test(message);
    return NextResponse.json(
      { success: false, error: conflict ? 'Slug already exists' : 'Internal server error' },
      { status: conflict ? 409 : 500 }
    );
  }
}
