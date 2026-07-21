/**
 * MCP public-catalog data access (dual-run).
 *
 * DATABASE_PROVIDER=mongodb → mongo-queries (published only).
 * Default supabase → anon client + RLS (unchanged production path).
 *
 * Response envelopes stay JSON-stable for MCP clients (id as string, author name).
 */

import { createClient } from '@supabase/supabase-js';
import { ObjectId, type Document, type Filter } from 'mongodb';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBooks, searchBooks } from '@/lib/mongo-queries';
import { getDb } from '@/lib/mongo';
import { sanitizeSearchQuery } from '@/lib/mcp/guard';
import type { BookWithAuthor } from '@/types/mongo';

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function coerceId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

function serializeValue(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return value;
}

/** Stable MCP book card — works for both providers. */
export type McpBookCard = {
  id: string;
  title: string;
  slug?: string;
  description?: string | null;
  genre?: string | null;
  cover_url?: string | null;
  price?: number | null;
  created_at?: string | null;
  author?: { id?: string; full_name?: string | null; pen_name?: string | null } | null;
  stats?: {
    total_views?: number;
    total_purchases?: number;
    avg_rating?: number;
    review_count?: number;
  } | null;
  _score?: number;
};

function mapMongoBook(book: BookWithAuthor): McpBookCard {
  const serialized = serializeValue(book) as BookWithAuthor & {
    _id: string;
    author?: { _id?: string; pen_name?: string } | null;
    created_at?: string;
  };

  return {
    id: String(serialized._id),
    title: serialized.title,
    slug: serialized.slug,
    description: serialized.description ?? null,
    genre: serialized.genre ?? null,
    cover_url: serialized.cover_url ?? null,
    price: serialized.price ?? null,
    created_at: serialized.created_at ?? null,
    author: serialized.author
      ? {
          id: serialized.author._id ? String(serialized.author._id) : undefined,
          pen_name: serialized.author.pen_name ?? null,
          full_name: serialized.author.pen_name ?? null,
        }
      : null,
    stats: {
      avg_rating: serialized.avg_rating,
      review_count: serialized.review_count,
      total_views: 0,
      total_purchases: 0,
    },
  };
}

async function getPublishedMongoBookById(id: string): Promise<BookWithAuthor | null> {
  const db = await getDb();
  const match: Filter<Document> = {
    _id: coerceId(id) as Filter<Document>['_id'],
    status: 'published',
  };
  const pipeline: Document[] = [
    { $match: match },
    {
      $lookup: {
        from: 'authors',
        localField: 'author_id',
        foreignField: '_id',
        as: '_authors',
      },
    },
    {
      $addFields: {
        author: { $ifNull: [{ $arrayElemAt: ['$_authors', 0] }, null] },
      },
    },
    { $project: { _authors: 0 } },
    { $limit: 1 },
  ];
  const [doc] = await db.collection('books').aggregate(pipeline).toArray();
  return (doc as BookWithAuthor | undefined) ?? null;
}

function scoreBook(book: McpBookCard): number {
  const createdMs = book.created_at ? new Date(book.created_at).getTime() : Date.now();
  const recencyDays = Math.floor((Date.now() - createdMs) / 86_400_000);
  return (
    (book.stats?.total_views || 0) +
    (book.stats?.total_purchases || 0) * 10 +
    (book.stats?.avg_rating || 0) * 20 +
    Math.max(0, 30 - recencyDays) * 5
  );
}

export async function mcpRecommendBooks(opts: {
  limit: number;
  genre?: string;
  exclude_book_ids?: string[];
}): Promise<{ books: McpBookCard[]; total: number }> {
  const exclude = new Set(opts.exclude_book_ids ?? []);

  if (isMongoPrimary()) {
    const result = await getBooks(
      { status: 'published', genre: opts.genre },
      { page: 1, perPage: Math.min(100, Math.max(opts.limit * 3, opts.limit)) }
    );
    const scored = result.items
      .map((b) => mapMongoBook(b))
      .filter((b) => !exclude.has(b.id))
      .map((b) => {
        const s = scoreBook(b);
        return { ...b, _score: s };
      })
      .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
      .slice(0, opts.limit)
      .map(({ _score, ...book }) => book);

    return { books: scored, total: scored.length };
  }

  let query = supabase()
    .from('books')
    .select(
      `*, author:profiles!books_author_id_fkey(id, full_name, avatar_url),
       stats:book_stats_summary(total_views, total_purchases, total_revenue)`
    )
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(opts.limit);

  if (opts.genre) query = query.eq('genre', opts.genre);
  if (opts.exclude_book_ids?.length) {
    query = query.not('id', 'in', `(${opts.exclude_book_ids.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Query failed: ${error.message}`);

  const scored = (data || [])
    .map((book) => {
      const card = book as McpBookCard;
      return { ...card, _score: scoreBook(card) };
    })
    .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
    .map(({ _score, ...book }) => book);

  return { books: scored, total: scored.length };
}

export async function mcpSearchBooks(opts: {
  query: string;
  limit: number;
}): Promise<McpBookCard[]> {
  const safe = sanitizeSearchQuery(opts.query);
  if (!safe) return [];

  if (isMongoPrimary()) {
    const result = await searchBooks(safe, {
      status: 'published',
      page: 1,
      perPage: opts.limit,
    });
    return result.items.map((b) => mapMongoBook(b));
  }

  const { data, error } = await supabase()
    .from('books')
    .select(
      'id, title, description, genre, created_at, author:profiles!books_author_id_fkey(id, full_name)'
    )
    .eq('status', 'published')
    .eq('visibility', 'public')
    .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .limit(opts.limit);
  if (error) throw new Error(`Search failed: ${error.message}`);
  return (data || []) as McpBookCard[];
}

export async function mcpGetBook(bookId: string): Promise<McpBookCard> {
  if (isMongoPrimary()) {
    const book = await getPublishedMongoBookById(bookId);
    if (!book) throw new Error('Book not found');
    return mapMongoBook(book);
  }

  const { data, error } = await supabase()
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
  return data as McpBookCard;
}

export async function mcpListGenres(): Promise<Record<string, number>> {
  if (isMongoPrimary()) {
    const db = await getDb();
    const rows = await db
      .collection('books')
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: 'published', genre: { $type: 'string', $ne: '' } } },
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

  const { data, error } = await supabase()
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
      const db = await getDb();
      await db.command({ ping: 1 });
      return { status: 'ok', db: 'connected', provider: 'mongodb' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      return { status: 'degraded', db: message, provider: 'mongodb' };
    }
  }

  const { error } = await supabase().from('books').select('id').limit(1);
  return {
    status: error ? 'degraded' : 'ok',
    db: error ? error.message : 'connected',
    provider: 'supabase',
  };
}

/** Exported for unit tests — scoring heuristic used by recommend_books. */
export function __scoreBookForTests(book: McpBookCard): number {
  return scoreBook(book);
}
