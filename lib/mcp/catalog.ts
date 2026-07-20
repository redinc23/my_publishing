/**
 * Public catalog data access for the MCP server (Phoenix dual-run).
 *
 * Supabase (default): anon client + RLS (published + public).
 * Mongo (`DATABASE_PROVIDER=mongodb`): query helpers with the same filters
 * applied in code. Tool names and response envelopes stay stable.
 */

import { createClient } from '@supabase/supabase-js';
import { ObjectId, type Db } from 'mongodb';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBookById, getBooks, searchBooks } from '@/lib/mongo-queries';
import { getDb } from '@/lib/mongo';
import { pingMongo } from '@/lib/mongodb';

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function bookIdString(id: unknown): string {
  if (id instanceof ObjectId) return id.toHexString();
  return String(id);
}

/** Normalize Mongo book docs toward the historical MCP JSON shape. */
function shapeMongoBook(book: {
  _id: unknown;
  title: string;
  slug?: string;
  description?: string;
  genre?: string;
  cover_url?: string | null;
  price?: number;
  avg_rating?: number;
  review_count?: number;
  created_at?: Date | string;
  author?: { pen_name?: string; photo_url?: string | null; _id?: unknown } | null;
  visibility?: string;
}) {
  const created =
    book.created_at instanceof Date
      ? book.created_at.toISOString()
      : book.created_at
        ? String(book.created_at)
        : null;

  return {
    id: bookIdString(book._id),
    title: book.title,
    slug: book.slug,
    description: book.description ?? null,
    genre: book.genre ?? null,
    cover_url: book.cover_url ?? null,
    price: book.price ?? null,
    created_at: created,
    average_rating: book.avg_rating ?? 0,
    review_count: book.review_count ?? 0,
    author: book.author
      ? {
          id: book.author._id != null ? bookIdString(book.author._id) : null,
          full_name: book.author.pen_name ?? null,
          avatar_url: book.author.photo_url ?? null,
        }
      : null,
    stats: {
      total_views: 0,
      total_purchases: book.review_count ?? 0,
      total_revenue: 0,
    },
  };
}

export async function mcpRecommendBooks(opts: {
  limit: number;
  genre?: string;
  exclude_book_ids?: string[];
}): Promise<{ books: unknown[]; total: number }> {
  const { limit, genre, exclude_book_ids } = opts;

  if (isMongoPrimary()) {
    const page = await getBooks(
      { status: 'published', genre },
      { page: 1, perPage: Math.min(100, Math.max(limit * 3, limit)) }
    );
    const exclude = new Set(exclude_book_ids ?? []);
    const scored = page.items
      .filter((b) => (b.visibility ? b.visibility === 'public' : true))
      .filter((b) => !exclude.has(bookIdString(b._id)))
      .map((book) => {
        const created = book.created_at instanceof Date ? book.created_at.getTime() : Date.now();
        const recencyDays = Math.floor((Date.now() - created) / 86_400_000);
        const score =
          (book.review_count || 0) * 10 +
          (book.avg_rating || 0) * 20 +
          Math.max(0, 30 - recencyDays) * 5;
        return { book, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ book }) => shapeMongoBook(book));

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

export async function mcpSearchBooks(safeQuery: string, limit: number): Promise<unknown[]> {
  if (!safeQuery) return [];

  if (isMongoPrimary()) {
    const page = await searchBooks(safeQuery, {
      status: 'published',
      page: 1,
      perPage: limit,
    });
    return page.items
      .filter((b) => (b.visibility ? b.visibility === 'public' : true))
      .map((b) => ({
        id: bookIdString(b._id),
        title: b.title,
        description: b.description ?? null,
        genre: b.genre ?? null,
        created_at:
          b.created_at instanceof Date ? b.created_at.toISOString() : (b.created_at ?? null),
        author: b.author
          ? {
              id: b.author._id != null ? bookIdString(b.author._id) : null,
              full_name: b.author.pen_name ?? null,
            }
          : null,
      }));
  }

  const { data, error } = await supabaseAnon()
    .from('books')
    .select(
      'id, title, description, genre, created_at, author:profiles!books_author_id_fkey(id, full_name)'
    )
    .eq('status', 'published')
    .eq('visibility', 'public')
    .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
    .limit(limit);
  if (error) throw new Error(`Search failed: ${error.message}`);
  return data ?? [];
}

export async function mcpGetBook(bookId: string): Promise<unknown> {
  if (isMongoPrimary()) {
    const book = await getBookById(bookId, { status: 'published' });
    if (!book || (book.visibility && book.visibility !== 'public')) {
      throw new Error('Book not found');
    }
    return shapeMongoBook(book);
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

export async function mcpListGenres(db?: Db): Promise<Record<string, number>> {
  if (isMongoPrimary()) {
    const database = db ?? (await getDb());
    const rows = await database
      .collection('books')
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            status: 'published',
            $or: [{ visibility: 'public' }, { visibility: { $exists: false } }],
            genre: { $type: 'string', $ne: '' },
          },
        },
        { $group: { _id: '$genre', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (row._id) counts[row._id] = row.count;
    }
    return counts;
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

export async function mcpHealth(): Promise<{ status: string; db: string; provider: string }> {
  if (isMongoPrimary()) {
    try {
      await pingMongo();
      return { status: 'ok', db: 'connected', provider: 'mongodb' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      return { status: 'degraded', db: message, provider: 'mongodb' };
    }
  }

  const { error } = await supabaseAnon().from('books').select('id').limit(1);
  return {
    status: error ? 'degraded' : 'ok',
    db: error ? error.message : 'connected',
    provider: 'supabase',
  };
}
