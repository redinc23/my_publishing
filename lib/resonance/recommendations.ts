import '@/lib/server-only-guard';
import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';
import { getCompletedOrderBookIds } from '@/lib/reading/entitlement';
import type { BookWithAuthor } from '@/types';

/**
 * Resonance Engine — Phase 2 recommendation fallback chain.
 *
 * Every stage is independently fault-tolerant: a stage that errors or returns
 * nothing simply hands off to the next one, so the chain degrades gracefully
 * (e.g. no OPENAI_API_KEY → no embeddings → vector stages yield nothing and
 * the SQL trending/editorial stages answer instead).
 *
 *   signed-in:  user_vector → similar_to_recent → trending → editorial
 *   anonymous:                                trending → editorial
 */

export type RecommendationAlgorithm =
  | 'user_vector'
  | 'similar_to_recent'
  | 'trending'
  | 'editorial'
  | 'cold_start';

export type RecommendationMode = 'auto' | 'personal' | 'trending' | 'editorial';

export interface RecommendationAnchor {
  id: string;
  title: string;
}

export interface RecommendationItem {
  book: BookWithAuthor;
  score: number;
  reason: string;
  algorithm: RecommendationAlgorithm;
}

export interface RecommendationResult {
  items: RecommendationItem[];
  /** Algorithm of the first (dominant) item; 'cold_start' when empty. */
  algorithm: RecommendationAlgorithm;
  /** Book anchoring personalization ("Because you read …"), when known. */
  anchor: RecommendationAnchor | null;
}

export interface RecommendationOptions {
  /** Resolved server-side profile id (profiles.id). Null/omitted → anonymous. */
  profileId?: string | null;
  limit?: number;
  genre?: string;
  excludeBookIds?: string[];
  mode?: RecommendationMode;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 24;
/** How far back engagement counts toward "trending". */
const TRENDING_WINDOW_DAYS = 7;
/** Cap on recent events scanned for the trending aggregation. */
const TRENDING_EVENT_SCAN = 5000;
/** Taste vector uses at most this many most-recent signal embeddings. */
const TASTE_VECTOR_SIGNALS = 12;
/** Guard against pathological array-param sizes. */
const MAX_EXCLUSIONS = 200;

const EVENT_WEIGHTS: Record<string, number> = {
  purchase: 6,
  share: 4,
  read: 3,
  rating: 2,
  wishlist: 2,
  click: 1.5,
  view: 1,
  impression: 0.2,
};

const PERSONAL_SIGNAL_WEIGHTS: Record<string, number> = {
  purchase: 3,
  rating: 2.5,
  read: 2,
  share: 2,
  wishlist: 1.5,
  finished: 2,
  progress: 1,
};

/** A scored public-catalog book; the unit cached stages return. */
interface ScoredBook {
  book: BookWithAuthor;
  score: number;
  is_featured?: boolean;
}

interface UserSignals {
  /** Most-recent first book ids the user engaged with. */
  signalBookIds: string[];
  /** Per-book personalisation weight. */
  weights: Map<string, number>;
  /** All ids that must never be recommended (engaged/purchased/authored). */
  exclusionIds: string[];
  /** Anchor = most recent signal book, title hydrated when possible. */
  anchor: RecommendationAnchor | null;
}

function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function truncateTitle(title: string, max = 48): string {
  return title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title;
}

/** pgvector returns embeddings as text ("[0.1,0.2,…]") over PostgREST. */
function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Compact bracket literal pgvector accepts as vector input. */
function embeddingToLiteral(vector: number[]): string {
  return `[${vector.map((n) => Number(n.toFixed(6))).join(',')}]`;
}

/**
 * Hydrate book ids to public catalog rows, preserving input order and
 * enforcing the public catalog contract (published + public visibility).
 */
async function hydrateBooks(
  admin: SupabaseClient,
  ids: string[],
  genre?: string
): Promise<BookWithAuthor[]> {
  const uniqueIds = Array.from(new Set(ids)).slice(0, MAX_EXCLUSIONS);
  if (uniqueIds.length === 0) return [];

  let query = admin
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .in('id', uniqueIds)
    .eq('status', 'published')
    .eq('visibility', 'public');
  if (genre) query = query.eq('genre', genre);

  const { data, error } = await query;
  if (error || !data) return [];

  const byId = new Map<string, BookWithAuthor>();
  for (const row of data as unknown as BookWithAuthor[]) {
    byId.set(row.id, row);
  }
  const ordered: BookWithAuthor[] = [];
  for (const id of uniqueIds) {
    const book = byId.get(id);
    if (book) ordered.push(book);
  }
  return ordered;
}

/**
 * Collect everything this profile has engaged with: reading progress,
 * completed purchases and engagement events. Best-effort per source.
 */
async function gatherUserSignals(
  admin: SupabaseClient,
  profileId: string
): Promise<UserSignals> {
  const weights = new Map<string, number>();
  const recency = new Map<string, number>();
  const exclusions = new Set<string>();

  const note = (bookId: string, weight: number, at: string | null) => {
    if (!bookId) return;
    weights.set(bookId, (weights.get(bookId) ?? 0) + weight);
    const ts = at ? Date.parse(at) : 0;
    if (ts > (recency.get(bookId) ?? 0)) recency.set(bookId, ts);
    exclusions.add(bookId);
  };

  // 1) Reading progress (strongest recency signal).
  try {
    const { data: progress } = await admin
      .from('reading_progress')
      .select('book_id, current_position, is_finished, rating, last_accessed')
      .eq('user_id', profileId)
      .order('last_accessed', { ascending: false })
      .limit(50);
    for (const row of progress ?? []) {
      const base = row.is_finished
        ? (PERSONAL_SIGNAL_WEIGHTS.finished ?? 2)
        : (row.current_position ?? 0) > 0
          ? (PERSONAL_SIGNAL_WEIGHTS.progress ?? 1)
          : 0.5;
      const ratingBoost = typeof row.rating === 'number' && row.rating >= 4 ? 1 : 0;
      note(row.book_id, base + ratingBoost, row.last_accessed ?? null);
    }
  } catch (error) {
    console.warn('[Resonance] reading_progress signals unavailable:', error);
  }

  // 2) Completed purchases.
  try {
    const purchased = await getCompletedOrderBookIds(admin, profileId);
    for (const bookId of purchased) {
      note(bookId, PERSONAL_SIGNAL_WEIGHTS.purchase ?? 3, null);
    }
  } catch (error) {
    console.warn('[Resonance] purchase signals unavailable:', error);
  }

  // 3) Explicit engagement events.
  try {
    const { data: events } = await admin
      .from('engagement_events')
      .select('book_id, event_type, created_at')
      .eq('user_id', profileId)
      .in('event_type', ['read', 'purchase', 'rating', 'share', 'wishlist'])
      .order('created_at', { ascending: false })
      .limit(50);
    for (const event of events ?? []) {
      note(
        event.book_id,
        PERSONAL_SIGNAL_WEIGHTS[event.event_type as string] ?? 1,
        event.created_at ?? null
      );
    }
  } catch (error) {
    console.warn('[Resonance] engagement signals unavailable:', error);
  }

  // 4) Never recommend books the user authored.
  try {
    const { data: authorRows } = await admin
      .from('authors')
      .select('id')
      .eq('profile_id', profileId);
    const authorIds = (authorRows ?? []).map((row: { id: string }) => row.id);
    if (authorIds.length > 0) {
      const { data: ownBooks } = await admin
        .from('books')
        .select('id')
        .in('author_id', authorIds);
      for (const row of ownBooks ?? []) exclusions.add(row.id);
    }
  } catch (error) {
    console.warn('[Resonance] authored-book exclusions unavailable:', error);
  }

  const signalBookIds = Array.from(weights.keys()).sort(
    (a, b) => (recency.get(b) ?? 0) - (recency.get(a) ?? 0)
  );

  let anchor: RecommendationAnchor | null = null;
  const anchorId = signalBookIds[0];
  if (anchorId) {
    anchor = { id: anchorId, title: 'a book you read' };
    try {
      const { data: anchorBook } = await admin
        .from('books')
        .select('title')
        .eq('id', anchorId)
        .maybeSingle();
      if (anchorBook?.title) anchor = { id: anchorId, title: anchorBook.title as string };
    } catch {
      // Anchor title is cosmetic; keep the placeholder.
    }
  }

  return {
    signalBookIds,
    weights,
    exclusionIds: Array.from(exclusions).slice(0, MAX_EXCLUSIONS),
    anchor,
  };
}

/** Stage 1 — taste-vector match against pgvector embeddings. */
async function vectorStage(
  admin: SupabaseClient,
  signals: UserSignals,
  limit: number,
  genre?: string
): Promise<RecommendationItem[]> {
  const candidateIds = signals.signalBookIds.slice(0, TASTE_VECTOR_SIGNALS);
  if (candidateIds.length === 0) return [];

  const { data: vectorRows, error } = await admin
    .from('resonance_vectors')
    .select('book_id, embedding')
    .in('book_id', candidateIds)
    .not('embedding', 'is', null);
  if (error) {
    console.warn('[Resonance] resonance_vectors lookup failed:', error.message ?? error);
    return [];
  }

  const dims = 384;
  const accum = new Array<number>(dims).fill(0);
  let totalWeight = 0;
  for (const row of vectorRows ?? []) {
    const embedding = parseEmbedding(row.embedding);
    if (!embedding || embedding.length === 0) continue;
    const weight = signals.weights.get(row.book_id as string) ?? 1;
    for (let i = 0; i < Math.min(embedding.length, dims); i += 1) {
      accum[i] += (embedding[i] as number) * weight;
    }
    totalWeight += weight;
  }
  if (totalWeight === 0) return []; // no embeddings → no OpenAI coverage

  const taste = accum.map((sum) => sum / totalWeight);
  const { data: matches, error: rpcError } = await admin.rpc('match_resonance_vector', {
    query_embedding: embeddingToLiteral(taste),
    match_count: limit * 2,
    exclude_book_ids: signals.exclusionIds,
  });
  if (rpcError) {
    // Migration not applied yet, pgvector absent, etc. — next stage handles it.
    console.warn('[Resonance] match_resonance_vector RPC failed:', rpcError.message ?? rpcError);
    return [];
  }

  const rows = (matches ?? []) as Array<{ id: string; similarity: number }>;
  const books = await hydrateBooks(
    admin,
    rows.map((row) => row.id),
    genre
  );
  const scoreById = new Map(rows.map((row) => [row.id, row.similarity]));
  const reason = signals.anchor
    ? `Because you read ${truncateTitle(signals.anchor.title)}`
    : 'Picked for you';

  return books.slice(0, limit).map((book) => ({
    book,
    score: scoreById.get(book.id) ?? 0,
    reason,
    algorithm: 'user_vector' as const,
  }));
}

/** Stage 2 — vector-similar to the most recent signal book. */
async function similarToRecentStage(
  admin: SupabaseClient,
  signals: UserSignals,
  limit: number,
  genre?: string
): Promise<RecommendationItem[]> {
  const anchor = signals.anchor;
  if (!anchor) return [];

  const { data: matches, error } = await admin.rpc('get_similar_books', {
    target_book_id: anchor.id,
    match_count: limit * 2,
  });
  if (error) {
    console.warn('[Resonance] get_similar_books RPC failed:', error.message ?? error);
    return [];
  }

  const excluded = new Set(signals.exclusionIds);
  const rows = ((matches ?? []) as Array<{ id: string; similarity: number }>).filter(
    (row) => !excluded.has(row.id)
  );
  const books = await hydrateBooks(
    admin,
    rows.map((row) => row.id),
    genre
  );
  const scoreById = new Map(rows.map((row) => [row.id, row.similarity]));
  const reason = `Because you read ${truncateTitle(anchor.title)}`;

  return books.slice(0, limit).map((book) => ({
    book,
    score: scoreById.get(book.id) ?? 0,
    reason,
    algorithm: 'similar_to_recent' as const,
  }));
}

/** Stage 3 — weighted engagement over the trailing week (user-independent, cached). */
function getTrendingRanked(limit: number, genre?: string): Promise<ScoredBook[]> {
  return unstable_cache(
    async (): Promise<ScoredBook[]> => {
      const admin = createAdminClient();
      const since = new Date(
        Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: events, error } = await admin
        .from('engagement_events')
        .select('book_id, event_type')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(TRENDING_EVENT_SCAN);
      if (error) {
        console.warn('[Resonance] trending events unavailable:', error.message ?? error);
        return [];
      }

      const scores = new Map<string, number>();
      for (const event of events ?? []) {
        scores.set(
          event.book_id as string,
          (scores.get(event.book_id as string) ?? 0) +
            (EVENT_WEIGHTS[event.event_type as string] ?? 0)
        );
      }
      const ranked = Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
      if (ranked.length === 0) return [];

      const books = await hydrateBooks(
        admin,
        ranked.map(([id]) => id),
        genre
      );
      const scoreById = new Map(ranked);
      const max = ranked[0]?.[1] || 1;
      return books.map((book) => ({
        book,
        score: (scoreById.get(book.id) ?? 0) / max,
      }));
    },
    ['resonance-trending', genre ?? 'all', String(limit)],
    { tags: ['resonance'], revalidate: 120 }
  )();
}

/** Stage 4 — editorial/popular SQL ranking (user-independent, cached). */
function getEditorialRanked(limit: number, genre?: string): Promise<ScoredBook[]> {
  return unstable_cache(
    async (): Promise<ScoredBook[]> => {
      const admin = createAdminClient();
      let query = admin
        .from('books')
        .select(PUBLIC_BOOK_SELECT)
        .eq('status', 'published')
        .eq('visibility', 'public')
        .order('is_featured', { ascending: false })
        .order('total_reads', { ascending: false })
        .order('average_rating', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (genre) query = query.eq('genre', genre);

      const { data, error } = await query;
      if (error) {
        console.warn('[Resonance] editorial ranking unavailable:', error.message ?? error);
        return [];
      }
      const books = (data ?? []) as unknown as BookWithAuthor[];
      return books.map((book, index) => ({
        book,
        score: 1 - index / Math.max(books.length, 1),
        is_featured: Boolean(book.is_featured),
      }));
    },
    ['resonance-editorial', genre ?? 'all', String(limit)],
    { tags: ['resonance'], revalidate: 300 }
  )();
}

/**
 * Resolve recommendations through the fallback chain. Never throws — worst
 * case is an empty result with algorithm 'cold_start'.
 */
export async function getResonanceRecommendations(
  options: RecommendationOptions = {}
): Promise<RecommendationResult> {
  const limit = clampLimit(options.limit);
  const genre = options.genre?.trim() || undefined;
  const mode: RecommendationMode = options.mode ?? 'auto';
  const extraExclusions = (options.excludeBookIds ?? []).slice(0, MAX_EXCLUSIONS);
  const empty: RecommendationResult = { items: [], algorithm: 'cold_start', anchor: null };

  try {
    const admin = createAdminClient();
    const seen = new Set<string>(extraExclusions);
    const items: RecommendationItem[] = [];

    const push = (stageItems: RecommendationItem[]) => {
      for (const item of stageItems) {
        if (items.length >= limit) break;
        if (seen.has(item.book.id)) continue;
        seen.add(item.book.id);
        items.push(item);
      }
    };

    // ── Personal stages (signed-in users only) ─────────────────────────────
    let signals: UserSignals | null = null;
    if (options.profileId && (mode === 'auto' || mode === 'personal')) {
      signals = await gatherUserSignals(admin, options.profileId);
      for (const id of signals.exclusionIds) seen.add(id);

      if (signals.signalBookIds.length > 0) {
        try {
          push(await vectorStage(admin, signals, limit, genre));
        } catch (error) {
          console.warn('[Resonance] vector stage failed:', error);
        }
        if (items.length < limit) {
          try {
            push(await similarToRecentStage(admin, signals, limit, genre));
          } catch (error) {
            console.warn('[Resonance] similar-to-recent stage failed:', error);
          }
        }
      }

      if (mode === 'personal') {
        return {
          items: items.slice(0, limit),
          algorithm: items[0]?.algorithm ?? 'cold_start',
          anchor: signals.anchor,
        };
      }
    }

    // ── Trending stage ─────────────────────────────────────────────────────
    if (items.length < limit && (mode === 'auto' || mode === 'trending')) {
      try {
        const ranked = await getTrendingRanked(limit * 2, genre);
        push(
          ranked.map((entry) => ({
            book: entry.book,
            score: entry.score,
            reason: 'Trending now',
            algorithm: 'trending' as const,
          }))
        );
      } catch (error) {
        console.warn('[Resonance] trending stage failed:', error);
      }
    }

    // ── Editorial/popular stage ────────────────────────────────────────────
    if (items.length < limit) {
      try {
        const ranked = await getEditorialRanked(limit * 2, genre);
        push(
          ranked.map((entry) => ({
            book: entry.book,
            score: entry.score,
            reason: entry.is_featured ? 'Featured on MANGU' : 'Popular on MANGU',
            algorithm: 'editorial' as const,
          }))
        );
      } catch (error) {
        console.warn('[Resonance] editorial stage failed:', error);
      }
    }

    if (items.length === 0) return empty;
    return {
      items: items.slice(0, limit),
      algorithm: items[0].algorithm,
      anchor: signals?.anchor ?? null,
    };
  } catch (error) {
    console.error('[Resonance] recommendation chain failed:', error);
    return empty;
  }
}

/**
 * "Readers also enjoyed" — vector-similar books with SQL top-ups.
 * Never throws; returns an empty list when the catalog cannot answer.
 */
export async function getResonanceSimilarBooks(
  bookId: string,
  limitInput?: number
): Promise<{ items: RecommendationItem[]; algorithm: RecommendationAlgorithm }> {
  const limit = clampLimit(limitInput);

  try {
    const admin = createAdminClient();
    const seen = new Set<string>([bookId]);
    const items: RecommendationItem[] = [];

    const { data: source } = await admin
      .from('books')
      .select('id, genre')
      .eq('id', bookId)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .maybeSingle();
    if (!source) return { items: [], algorithm: 'cold_start' };

    // Stage 1 — pgvector cosine similarity (no-op without embeddings).
    try {
      const { data: matches, error } = await admin.rpc('get_similar_books', {
        target_book_id: bookId,
        match_count: limit * 2,
      });
      if (!error && matches) {
        const rows = matches as Array<{ id: string; similarity: number }>;
        const books = await hydrateBooks(
          admin,
          rows.map((row) => row.id)
        );
        const scoreById = new Map(rows.map((row) => [row.id, row.similarity]));
        for (const book of books) {
          if (items.length >= limit) break;
          if (seen.has(book.id)) continue;
          seen.add(book.id);
          items.push({
            book,
            score: scoreById.get(book.id) ?? 0,
            reason: 'Readers also enjoyed',
            algorithm: 'user_vector',
          });
        }
      } else if (error) {
        console.warn('[Resonance Similar] vector stage failed:', error.message ?? error);
      }
    } catch (error) {
      console.warn('[Resonance Similar] vector stage failed:', error);
    }

    // Stage 2 — same-genre popularity top-up.
    if (items.length < limit && source.genre) {
      const { data: genreRows } = await admin
        .from('books')
        .select('id')
        .eq('status', 'published')
        .eq('visibility', 'public')
        .eq('genre', source.genre as string)
        .neq('id', bookId)
        .order('total_reads', { ascending: false })
        .limit(limit * 2);
      const books = await hydrateBooks(
        admin,
        (genreRows ?? []).map((row: { id: string }) => row.id)
      );
      for (const book of books) {
        if (items.length >= limit) break;
        if (seen.has(book.id)) continue;
        seen.add(book.id);
        items.push({
          book,
          score: 0.5,
          reason: `More ${String(source.genre)}`,
          algorithm: 'editorial',
        });
      }
    }

    // Stage 3 — global popular top-up.
    if (items.length < limit) {
      const { data: popularRows } = await admin
        .from('books')
        .select('id')
        .eq('status', 'published')
        .eq('visibility', 'public')
        .neq('id', bookId)
        .order('total_reads', { ascending: false })
        .limit(limit * 2);
      const books = await hydrateBooks(
        admin,
        (popularRows ?? []).map((row: { id: string }) => row.id)
      );
      for (const book of books) {
        if (items.length >= limit) break;
        if (seen.has(book.id)) continue;
        seen.add(book.id);
        items.push({
          book,
          score: 0.25,
          reason: 'Popular on MANGU',
          algorithm: 'editorial',
        });
      }
    }

    return {
      items,
      algorithm: items[0]?.algorithm ?? 'cold_start',
    };
  } catch (error) {
    console.error('[Resonance Similar] chain failed:', error);
    return { items: [], algorithm: 'cold_start' };
  }
}
