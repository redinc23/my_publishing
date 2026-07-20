/**
 * Catalog data access for the public MCP tools (dual-run).
 *
 * DATABASE_PROVIDER=supabase (default) → anon Supabase client + RLS
 * DATABASE_PROVIDER=mongodb → mongo-queries (published/public filters in code)
 *
 * Tool names and JSON envelopes stay stable across providers.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isMongoPrimary } from '@/lib/db/provider';
import { pingMongo } from '@/lib/mongo';
import { getBookById, getBooks, listGenreCounts, searchBooks } from '@/lib/mongo-queries';
import { sanitizeSearchQuery } from '@/lib/mcp/guard';
import type { BookWithAuthor } from '@/types/mongo';

function supabaseAnon(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function mongoBookToPublicJson(book: BookWithAuthor) {
  return {
    id: String(book._id),
    title: book.title,
    slug: book.slug,
    description: book.description ?? null,
    genre: book.genre ?? null,
    cover_url: book.cover_url ?? null,
    price: book.price ?? null,
    discount_price: book.discount_price ?? null,
    avg_rating: book.avg_rating,
    review_count: book.review_count,
    status: book.status,
    visibility: book.visibility ?? 'public',
    created_at: book.created_at,
    author: book.author
      ? {
          id: String(book.author._id),
          full_name: book.author.pen_name,
          avatar_url: book.author.photo_url ?? null,
        }
      : null,
    stats: {
      total_views: 0,
      total_purchases: 0,
      total_revenue: 0,
      avg_rating: book.avg_rating,
      review_count: book.review_count,
    },
  };
}

export async function mcpRecommendBooks(input: {
  limit: number;
  genre?: string;
  exclude_book_ids?: string[];
}): Promise<{ books: unknown[]; total: number }> {
  const { limit, genre, exclude_book_ids } = input;

  if (isMongoPrimary()) {
    const page = await getBooks(
      { status: 'published', genre },
      { page: 1, perPage: Math.min(100, Math.max(limit * 3, limit)) }
    );
    const exclude = new Set(exclude_book_ids ?? []);
    const scored = page.items
      .filter((b) => (b.visibility ?? 'public') === 'public')
      .filter((b) => !exclude.has(String(b._id)))
      .map((book) => {
        const created =
          book.created_at instanceof Date
            ? book.created_at.getTime()
            : new Date(book.created_at).getTime();
        const recencyDays = Math.floor((Date.now() - created) / 86_400_000);
        const score =
          (book.review_count || 0) * 10 +
          (book.avg_rating || 0) * 20 +
          Math.max(0, 30 - recencyDays) * 5;
        return { book, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ book }) => mongoBookToPublicJson(book));

    return { books: scored, total: scored.length };
  }

  let query = supabaseAnon()
    .from('books')
    .select(
      `*, author:profiles!books_author_id_fkey(id, full_name, avatar_url),
       stats:book_stats_summary(total_views, total_purchases, total_revenue)`
    )
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (genre) query = query.eq('genre', genre);
  if (exclude_book_ids?.length) {
    query = query.not('id', 'in', `(${exclude_book_ids.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Query failed: ${error.message}`);

  const scored = (data || [])
    .map((book) => {
      const recencyDays = Math.floor(
        (Date.now() - new Date(book.created_at).getTime()) / 86_400_000
      );
      const score =
        (book.stats?.total_views || 0) +
        (book.stats?.total_purchases || 0) * 10 +
        Math.max(0, 30 - recencyDays) * 5;
      return { ...book, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...book }) => book);

  return { books: scored, total: scored.length };
}

export async function mcpSearchBooks(input: { query: string; limit: number }): Promise<unknown[]> {
  const safe = sanitizeSearchQuery(input.query);
  if (!safe) return [];

  if (isMongoPrimary()) {
    const page = await searchBooks(safe, {
      status: 'published',
      page: 1,
      perPage: input.limit,
    });
    return page.items
      .filter((b) => (b.visibility ?? 'public') === 'public')
      .map((b) => ({
        id: String(b._id),
        title: b.title,
        description: b.description ?? null,
        genre: b.genre ?? null,
        created_at: b.created_at,
        author: b.author ? { id: String(b.author._id), full_name: b.author.pen_name } : null,
      }));
  }

  const { data, error } = await supabaseAnon()
    .from('books')
    .select(
      'id, title, description, genre, created_at, author:profiles!books_author_id_fkey(id, full_name)'
    )
    .eq('status', 'published')
    .eq('visibility', 'public')
    .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .limit(input.limit);
  if (error) throw new Error(`Search failed: ${error.message}`);
  return data || [];
}

export async function mcpGetBook(bookId: string): Promise<unknown> {
  if (isMongoPrimary()) {
    const book = await getBookById(bookId, { status: 'published' });
    if (!book || (book.visibility ?? 'public') !== 'public') {
      throw new Error('Book not found');
    }
    return mongoBookToPublicJson(book);
  }

  const { data, error } = await supabaseAnon()
    .from('books')
    .select(
      `*, author:profiles!books_author_id_fkey(id, full_name, avatar_url),
       stats:book_stats_summary(total_views, total_purchases, total_revenue)`
    )
    .eq('id', bookId)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .single();
  if (error) throw new Error(`Book not found: ${error.message}`);
  return data;
}

export async function mcpListGenres(): Promise<Record<string, number>> {
  if (isMongoPrimary()) {
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

export async function mcpCatalogHealth(): Promise<{
  status: 'ok' | 'degraded';
  db: string;
  provider: 'mongodb' | 'supabase';
}> {
  if (isMongoPrimary()) {
    const ping = await pingMongo();
    if (ping.ok) {
      return { status: 'ok', db: 'connected', provider: 'mongodb' };
    }
    return {
      status: 'degraded',
      db: ping.message || 'mongo ping failed',
      provider: 'mongodb',
    };
  }

  const { error } = await supabaseAnon().from('books').select('id').limit(1);
  return {
    status: error ? 'degraded' : 'ok',
    db: error ? error.message : 'connected',
    provider: 'supabase',
  };
}
