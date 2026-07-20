/**
 * MCP public-catalog data access (dual-run).
 *
 * Default: Supabase anon + RLS (production today).
 * When DATABASE_PROVIDER=mongodb: Phoenix query layer (`lib/mongo-queries`).
 *
 * Tool names and response envelopes stay stable so MCP clients do not break.
 */

import '@/lib/server-only-guard';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseProvider } from '@/lib/db/provider';
import { getBookById, getBooks, listGenreCounts, searchBooks } from '@/lib/mongo-queries';
import type { BookWithAuthor } from '@/types/mongo';

const PUBLIC_SELECT = `*, author:profiles!books_author_id_fkey(id, full_name, avatar_url),
             stats:book_stats_summary(total_views, total_purchases, total_revenue)`;

const SEARCH_SELECT =
  'id, title, description, genre, created_at, author:profiles!books_author_id_fkey(id, full_name)';

export type McpCatalogProvider = 'supabase' | 'mongodb';

export type McpBookStats = {
  total_views?: number;
  total_purchases?: number;
  total_revenue?: number;
};

/** Stable MCP book shape (Supabase-era field names preserved). */
export type McpBook = {
  id: string;
  title: string;
  description?: string | null;
  genre?: string | null;
  slug?: string | null;
  cover_url?: string | null;
  status?: string;
  visibility?: string;
  created_at?: string;
  avg_rating?: number;
  review_count?: number;
  author?: {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
    pen_name?: string | null;
  } | null;
  stats?: McpBookStats | null;
  [key: string]: unknown;
};

export type RecommendBooksInput = {
  limit: number;
  genre?: string;
  exclude_book_ids?: string[];
  /** Optional seed: prefer same genre as this book (additive; clients may ignore). */
  similar_to_book_id?: string;
};

function supabaseAnon(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export function getMcpCatalogProvider(): McpCatalogProvider {
  return getDatabaseProvider() === 'mongodb' ? 'mongodb' : 'supabase';
}

function bookIdString(book: BookWithAuthor): string {
  return String(book._id);
}

function mongoBookToMcp(book: BookWithAuthor): McpBook {
  const author = book.author
    ? {
        id: book.author._id ? String(book.author._id) : undefined,
        full_name: book.author.pen_name ?? null,
        pen_name: book.author.pen_name ?? null,
        avatar_url: book.author.photo_url ?? null,
      }
    : null;

  return {
    id: bookIdString(book),
    title: book.title,
    description: book.description ?? null,
    genre: book.genre ?? null,
    slug: book.slug ?? null,
    cover_url: book.cover_url ?? null,
    status: book.status,
    visibility: book.visibility,
    created_at:
      book.created_at instanceof Date
        ? book.created_at.toISOString()
        : String(book.created_at ?? ''),
    avg_rating: book.avg_rating ?? 0,
    review_count: book.review_count ?? 0,
    author,
    stats: {
      total_views: 0,
      total_purchases: 0,
      total_revenue: 0,
    },
  };
}

function scoreBook(book: McpBook): number {
  const created = book.created_at ? new Date(book.created_at).getTime() : Date.now();
  const recencyDays = Math.floor((Date.now() - created) / 86_400_000);
  const views = book.stats?.total_views ?? 0;
  const purchases = book.stats?.total_purchases ?? 0;
  const ratingBoost = Math.round((book.avg_rating ?? 0) * 8);
  const reviewBoost = Math.min(40, (book.review_count ?? 0) * 2);
  return views + purchases * 10 + Math.max(0, 30 - recencyDays) * 5 + ratingBoost + reviewBoost;
}

function excludeSet(ids: string[] | undefined): Set<string> {
  return new Set((ids ?? []).filter(Boolean));
}

async function recommendFromSupabase(input: RecommendBooksInput): Promise<McpBook[]> {
  let genre = input.genre;
  if (!genre && input.similar_to_book_id) {
    const seed = await getBookDetails(input.similar_to_book_id);
    genre = seed?.genre ?? undefined;
  }

  const fetchLimit = Math.min(50, Math.max(input.limit * 3, input.limit));
  let query = supabaseAnon()
    .from('books')
    .select(PUBLIC_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (genre) query = query.eq('genre', genre);
  if (input.exclude_book_ids?.length) {
    query = query.not('id', 'in', `(${input.exclude_book_ids.join(',')})`);
  }
  if (input.similar_to_book_id) {
    query = query.neq('id', input.similar_to_book_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Query failed: ${error.message}`);

  const scored = ((data || []) as McpBook[])
    .map((book) => ({ book, score: scoreBook(book) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit)
    .map(({ book }) => book);

  return scored;
}

async function recommendFromMongo(input: RecommendBooksInput): Promise<McpBook[]> {
  let genre = input.genre;
  if (!genre && input.similar_to_book_id) {
    const seed = await getBookById(input.similar_to_book_id, {
      status: 'published',
      visibility: 'public',
    });
    genre = seed?.genre ?? undefined;
  }

  const fetchLimit = Math.min(100, Math.max(input.limit * 5, 40));
  const result = await getBooks(
    { status: 'published', visibility: 'public', genre },
    { page: 1, perPage: fetchLimit }
  );

  const excluded = excludeSet(input.exclude_book_ids);
  if (input.similar_to_book_id) excluded.add(input.similar_to_book_id);

  return result.items
    .map(mongoBookToMcp)
    .filter((book) => !excluded.has(book.id))
    .map((book) => ({ book, score: scoreBook(book) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit)
    .map(({ book }) => book);
}

export async function recommendBooks(input: RecommendBooksInput): Promise<{
  books: McpBook[];
  total: number;
}> {
  const books =
    getMcpCatalogProvider() === 'mongodb'
      ? await recommendFromMongo(input)
      : await recommendFromSupabase(input);
  return { books, total: books.length };
}

async function searchFromSupabase(query: string, limit: number): Promise<McpBook[]> {
  const { data, error } = await supabaseAnon()
    .from('books')
    .select(SEARCH_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(limit);
  if (error) throw new Error(`Search failed: ${error.message}`);
  return (data || []) as McpBook[];
}

async function searchFromMongo(query: string, limit: number): Promise<McpBook[]> {
  const result = await searchBooks(query, {
    status: 'published',
    visibility: 'public',
    page: 1,
    perPage: limit,
  });
  return result.items.map(mongoBookToMcp);
}

/** Empty sanitized query → empty array (stable contract). */
export async function searchPublishedBooks(query: string, limit: number): Promise<McpBook[]> {
  if (!query) return [];
  return getMcpCatalogProvider() === 'mongodb'
    ? searchFromMongo(query, limit)
    : searchFromSupabase(query, limit);
}

export async function getBookDetails(bookId: string): Promise<McpBook | null> {
  if (getMcpCatalogProvider() === 'mongodb') {
    const book = await getBookById(bookId, { status: 'published', visibility: 'public' });
    return book ? mongoBookToMcp(book) : null;
  }

  const { data, error } = await supabaseAnon()
    .from('books')
    .select(PUBLIC_SELECT)
    .eq('id', bookId)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .maybeSingle();
  if (error) throw new Error(`Book not found: ${error.message}`);
  return (data as McpBook | null) ?? null;
}

export async function listPublishedGenres(): Promise<Record<string, number>> {
  if (getMcpCatalogProvider() === 'mongodb') {
    return listGenreCounts({ status: 'published', visibility: 'public' });
  }

  const { data, error } = await supabaseAnon()
    .from('books')
    .select('genre')
    .eq('status', 'published')
    .eq('visibility', 'public');
  if (error) throw new Error(`Query failed: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    if (row.genre) counts[row.genre] = (counts[row.genre] || 0) + 1;
  }
  return counts;
}

export async function checkCatalogHealth(): Promise<{
  status: 'ok' | 'degraded';
  db: string;
  provider: McpCatalogProvider;
}> {
  const provider = getMcpCatalogProvider();
  try {
    if (provider === 'mongodb') {
      const ping = await getBooks({ status: 'published', visibility: 'public' }, { perPage: 1 });
      return { status: 'ok', db: `connected (${ping.total} published public)`, provider };
    }
    const { error } = await supabaseAnon().from('books').select('id').limit(1);
    return {
      status: error ? 'degraded' : 'ok',
      db: error ? error.message : 'connected',
      provider,
    };
  } catch (err) {
    return {
      status: 'degraded',
      db: err instanceof Error ? err.message : 'unknown error',
      provider,
    };
  }
}

/** Book id for MCP: legacy UUID or Mongo ObjectId hex (24). */
export function isMcpBookId(value: string): boolean {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return true;
  }
  return /^[a-fA-F0-9]{24}$/.test(value);
}
