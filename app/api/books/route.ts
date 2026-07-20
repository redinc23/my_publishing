/**
 * Books collection API (Phoenix 2b.1.1).
 *
 * Dual-run: DATABASE_PROVIDER=mongodb|supabase (default supabase).
 * Mutations require author|admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { canMutateCatalog, getApiRequestUser } from '@/lib/api/request-user';
import { serializeMongo, slugifyTitle } from '@/lib/api/serialize-mongo';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBooks, insertBook, searchBooks } from '@/lib/mongo-queries';
import { createClient } from '@/lib/supabase/server';
import type { BookStatus } from '@/types/mongo';

export const runtime = 'nodejs';

function parsePage(searchParams: URLSearchParams): { page: number; perPage: number } {
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage') || 20) || 20));
  return { page, perPage };
}

async function listBooksMongo(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { page, perPage } = parsePage(searchParams);
  const q = searchParams.get('q')?.trim();
  const status = (searchParams.get('status') as BookStatus | null) || 'published';
  const genre = searchParams.get('genre') || undefined;
  const authorId = searchParams.get('authorId') || undefined;

  if (q) {
    const result = await searchBooks(q, { page, perPage, status });
    return NextResponse.json(serializeMongo(result));
  }

  const result = await getBooks({ status, genre, authorId }, { page, perPage });
  return NextResponse.json(serializeMongo(result));
}

async function listBooksSupabase(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { page, perPage } = parsePage(searchParams);
  const status = searchParams.get('status') || 'published';
  const genre = searchParams.get('genre');
  const q = searchParams.get('q')?.trim();

  const supabase = await createClient();
  let query = supabase
    .from('books')
    .select('*, author:profiles!books_author_id_fkey(id, full_name, avatar_url)', {
      count: 'exact',
    })
    .eq('status', status)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (genre) query = query.eq('genre', genre);
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
  return NextResponse.json({
    items: data ?? [],
    total,
    page,
    perPage,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && totalPages > 0,
  });
}

export async function GET(request: NextRequest) {
  try {
    if (isMongoPrimary()) {
      return await listBooksMongo(request);
    }
    return await listBooksSupabase(request);
  } catch (error) {
    console.error('[api/books] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type CreateBody = {
  title?: string;
  description?: string;
  genre?: string;
  price?: number;
  currency?: string;
  status?: BookStatus;
  cover_url?: string | null;
  tags?: string[];
  slug?: string;
};

async function createBookMongo(body: CreateBody, userId: string) {
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const slug = (body.slug?.trim() || slugifyTitle(body.title)).slice(0, 120);
  if (!slug) {
    return NextResponse.json({ error: 'Could not derive slug from title' }, { status: 400 });
  }

  try {
    const book = await insertBook({
      title: body.title.trim(),
      slug,
      author_id: userId,
      description: body.description,
      genre: body.genre,
      price: body.price,
      currency: body.currency,
      status: body.status ?? 'draft',
      cover_url: body.cover_url,
      tags: body.tags,
    });
    return NextResponse.json(serializeMongo(book), { status: 201 });
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 11000) {
      return NextResponse.json({ error: 'A book with this slug already exists' }, { status: 409 });
    }
    throw error;
  }
}

async function createBookSupabase(body: CreateBody, userId: string, authorName: string | null) {
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const slug = (body.slug?.trim() || slugifyTitle(body.title)).slice(0, 120);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('books')
    .insert({
      title: body.title.trim(),
      slug,
      description: body.description ?? '',
      genre: body.genre ?? null,
      price: body.price ?? 0,
      status: body.status ?? 'draft',
      cover_url: body.cover_url ?? null,
      tags: body.tags ?? [],
      author_id: userId,
      author_name: authorName || 'Anonymous',
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A book with this slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getApiRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canMutateCatalog(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: CreateBody;
    try {
      body = (await request.json()) as CreateBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (isMongoPrimary()) {
      return await createBookMongo(body, user.id);
    }

    return await createBookSupabase(body, user.id, user.name ?? null);
  } catch (error) {
    console.error('[api/books] POST failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
