/**
 * Dual-run book data access for Phoenix WS2b API routes.
 * Default: Supabase. Mongo when DATABASE_PROVIDER=mongodb.
 */

import '@/lib/server-only-guard';

import { createClient } from '@/lib/supabase/server';
import { isMongoPrimary } from '@/lib/db/provider';
import { createBook, getBookById, getBookBySlug, getBooks, updateBook } from '@/lib/mongo-queries';

export type ApiBook = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  genre?: string | null;
  price?: number | null;
  discount_price?: number | null;
  status?: string;
  visibility?: string;
  cover_url?: string | null;
  author_id?: string;
  avg_rating?: number;
  review_count?: number;
  created_at?: string;
  [key: string]: unknown;
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export async function listPublishedBooks(opts: {
  page?: number;
  perPage?: number;
  genre?: string;
}): Promise<{ books: ApiBook[]; total: number; page: number; perPage: number }> {
  const page = opts.page ?? 1;
  const perPage = opts.perPage ?? 20;

  if (isMongoPrimary()) {
    const result = await getBooks(
      { status: 'published', visibility: 'public', genre: opts.genre },
      { page, perPage }
    );
    return {
      books: result.items.map((b) => ({
        id: String(b._id),
        title: b.title,
        slug: b.slug,
        description: b.description ?? null,
        genre: b.genre ?? null,
        price: b.price ?? null,
        status: b.status,
        visibility: b.visibility,
        cover_url: b.cover_url ?? null,
        author_id: String(b.author_id),
        avg_rating: b.avg_rating,
        review_count: b.review_count,
        created_at:
          b.created_at instanceof Date ? b.created_at.toISOString() : String(b.created_at ?? ''),
        author: b.author ? { id: String(b.author._id), full_name: b.author.pen_name } : null,
      })),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
    };
  }

  const supabase = await createClient();
  let query = supabase
    .from('books')
    .select('*', { count: 'exact' })
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (opts.genre) query = query.eq('genre', opts.genre);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    books: (data || []).map((row) => ({ ...row, id: row.id as string })),
    total: count ?? (data || []).length,
    page,
    perPage,
  };
}

export async function fetchBookForApi(idOrSlug: {
  id?: string;
  slug?: string;
}): Promise<ApiBook | null> {
  if (isMongoPrimary()) {
    const book = idOrSlug.id
      ? await getBookById(idOrSlug.id)
      : idOrSlug.slug
        ? await getBookBySlug(idOrSlug.slug)
        : null;
    if (!book) return null;
    return {
      id: String(book._id),
      title: book.title,
      slug: book.slug,
      description: book.description ?? null,
      genre: book.genre ?? null,
      price: book.price ?? 0,
      discount_price: null,
      status: book.status,
      visibility: book.visibility,
      cover_url: book.cover_url ?? null,
      author_id: String(book.author_id),
      avg_rating: book.avg_rating,
      review_count: book.review_count,
    };
  }

  const supabase = await createClient();
  let query = supabase.from('books').select('*');
  if (idOrSlug.id) query = query.eq('id', idOrSlug.id);
  else if (idOrSlug.slug) query = query.eq('slug', idOrSlug.slug);
  else return null;
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as ApiBook | null;
}

export async function createBookForApi(input: {
  title: string;
  author_id: string;
  description?: string;
  genre?: string;
  price?: number;
  status?: 'draft' | 'published' | 'archived';
  visibility?: 'public' | 'private' | 'unlisted';
  slug?: string;
}): Promise<ApiBook> {
  const slug = input.slug?.trim() || slugify(input.title);
  if (!slug) throw new Error('Invalid title for slug');

  if (isMongoPrimary()) {
    const id = await createBook({
      title: input.title,
      slug,
      author_id: input.author_id,
      description: input.description,
      genre: input.genre,
      price: input.price,
      status: input.status ?? 'draft',
      visibility: input.visibility ?? 'private',
    });
    const book = await getBookById(id);
    if (!book) throw new Error('Failed to load created book');
    return {
      id,
      title: book.title,
      slug: book.slug,
      description: book.description ?? null,
      genre: book.genre ?? null,
      price: book.price ?? 0,
      status: book.status,
      visibility: book.visibility,
      author_id: String(book.author_id),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('books')
    .insert({
      title: input.title,
      slug,
      author_id: input.author_id,
      description: input.description ?? '',
      genre: input.genre,
      price: input.price ?? 0,
      status: input.status ?? 'draft',
      visibility: input.visibility ?? 'private',
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Create failed');
  return data as ApiBook;
}

export async function patchBookForApi(
  id: string,
  patch: Partial<{
    title: string;
    slug: string;
    description: string;
    genre: string;
    price: number;
    status: 'draft' | 'published' | 'archived';
    visibility: 'public' | 'private' | 'unlisted';
  }>
): Promise<ApiBook | null> {
  if (isMongoPrimary()) {
    const ok = await updateBook(id, patch);
    if (!ok) return null;
    return fetchBookForApi({ id });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('books')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ApiBook | null) ?? null;
}
