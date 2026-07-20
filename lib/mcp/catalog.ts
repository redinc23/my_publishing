/**
 * Public catalog data access for the MCP server (dual-run).
 * DATABASE_PROVIDER=mongodb → mongo-queries; default → Supabase anon + RLS.
 */

import { createClient } from '@supabase/supabase-js';
import { isMongoPrimary } from '@/lib/db/provider';
import { serializeMongo } from '@/lib/api/serialize-mongo';
import { getBookById, getBooks, searchBooks } from '@/lib/mongo-queries';
import { getDb } from '@/lib/mongo';
import { pingMongo } from '@/lib/mongodb';
import { sanitizeSearchQuery } from '@/lib/mcp/guard';

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function toMcpBook(doc: Record<string, unknown>) {
  const author = doc.author as { _id?: unknown; pen_name?: string; photo_url?: string } | null;
  return {
    id: String(doc._id ?? doc.id ?? ''),
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    genre: doc.genre,
    cover_url: doc.cover_url,
    price: doc.price,
    avg_rating: doc.avg_rating,
    review_count: doc.review_count,
    created_at: doc.created_at,
    author: author
      ? {
          id: String(author._id ?? ''),
          full_name: author.pen_name ?? null,
          avatar_url: author.photo_url ?? null,
        }
      : null,
    stats: {
      total_views: 0,
      total_purchases: 0,
      total_revenue: 0,
      avg_rating: doc.avg_rating ?? 0,
      review_count: doc.review_count ?? 0,
    },
  };
}

export async function mcpRecommendBooks(input: {
  limit: number;
  genre?: string;
  exclude_book_ids?: string[];
}): Promise<unknown[]> {
  if (isMongoPrimary()) {
    const result = await getBooks(
      { status: 'published', genre: input.genre },
      { page: 1, perPage: Math.min(50, Math.max(input.limit * 3, input.limit)) }
    );
    const exclude = new Set(input.exclude_book_ids ?? []);
    const scored = result.items
      .filter((b) => !exclude.has(String(b._id)))
      .map((book) => {
        const created =
          book.created_at instanceof Date ? book.created_at : new Date(book.created_at);
        const recencyDays = Math.floor((Date.now() - created.getTime()) / 86_400_000);
        const score =
          (book.review_count || 0) * 10 +
          (book.avg_rating || 0) * 5 +
          Math.max(0, 30 - recencyDays) * 5;
        return { book, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit)
      .map(({ book }) => toMcpBook(serializeMongo(book) as Record<string, unknown>));
    return scored;
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
    .limit(input.limit);

  if (input.genre) query = query.eq('genre', input.genre);
  if (input.exclude_book_ids?.length) {
    query = query.not('id', 'in', `(${input.exclude_book_ids.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Query failed: ${error.message}`);

  return (data || [])
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
}

export async function mcpSearchBooks(input: { query: string; limit: number }): Promise<unknown> {
  const safe = sanitizeSearchQuery(input.query);
  if (!safe) return [];

  if (isMongoPrimary()) {
    const result = await searchBooks(safe, {
      status: 'published',
      page: 1,
      perPage: input.limit,
    });
    return result.items.map((b) => {
      const s = serializeMongo(b) as Record<string, unknown>;
      return {
        id: String(s._id),
        title: s.title,
        description: s.description,
        genre: s.genre,
        created_at: s.created_at,
        author: toMcpBook(s).author,
      };
    });
  }

  const { data, error } = await supabase()
    .from('books')
    .select(
      'id, title, description, genre, created_at, author:profiles!books_author_id_fkey(id, full_name)'
    )
    .eq('status', 'published')
    .eq('visibility', 'public')
    .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .limit(input.limit);
  if (error) throw new Error(`Search failed: ${error.message}`);
  return data;
}

export async function mcpGetBook(bookId: string): Promise<unknown> {
  if (isMongoPrimary()) {
    const book = await getBookById(bookId, { status: 'published' });
    if (!book) throw new Error('Book not found');
    return toMcpBook(serializeMongo(book) as Record<string, unknown>);
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
  return data;
}

export async function mcpListGenres(): Promise<Record<string, number>> {
  if (isMongoPrimary()) {
    const db = await getDb();
    const rows = await db
      .collection('books')
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: 'published', genre: { $exists: true, $ne: null } } },
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
    const ping = await pingMongo();
    return {
      status: ping.ok ? 'ok' : 'degraded',
      db: ping.ok ? 'connected' : ping.message || 'unreachable',
      provider: 'mongodb',
    };
  }

  const { error } = await supabase().from('books').select('id').limit(1);
  return {
    status: error ? 'degraded' : 'ok',
    db: error ? error.message : 'connected',
    provider: 'supabase',
  };
}
