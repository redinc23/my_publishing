/**
 * Centralized MongoDB query helpers (Phoenix WS2a Task 2a.3).
 *
 * Server-only. Accepts an optional `Db` for unit tests; production callers
 * omit it and use the cached singleton via `getDb()`.
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { getDb } from '@/lib/mongo';
import type { Book, BookWithAuthor, MongoPagination, Order, PaginatedResult } from '@/types/mongo';

export const DEFAULT_PAGE_SIZE = 20;

/** Prefer ObjectId when the string is a 24-char hex id (Atlas imports). */
function coerceId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

/**
 * Match `_id` whether stored as ObjectId or legacy string UUID.
 * Driver Filter typings assume ObjectId-only `_id`; cast via unknown.
 */
function idMatchFilter(id: string): Filter<Document> {
  const coerced = coerceId(id);
  const filter =
    coerced instanceof ObjectId ? { $or: [{ _id: coerced }, { _id: id }] } : { _id: id };
  return filter as unknown as Filter<Document>;
}

export type GetBooksFilters = {
  status?: Book['status'];
  authorId?: string;
  genre?: string;
  visibility?: Book['visibility'];
};

export type SearchBooksOptions = MongoPagination & {
  /** Restrict to published by default for storefront search. */
  status?: Book['status'];
  visibility?: Book['visibility'];
};

function normalizePagination(opts: MongoPagination = {}): {
  page: number;
  perPage: number;
  skip: number;
} {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Math.floor(opts.perPage ?? DEFAULT_PAGE_SIZE)));
  return { page, perPage, skip: (page - 1) * perPage };
}

function toPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  perPage: number
): PaginatedResult<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
  return {
    items,
    total,
    page,
    perPage,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && totalPages > 0,
  };
}

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

function authorLookupStages(): Document[] {
  return [
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
  ];
}

/**
 * Paginated book list with author `$lookup` (default 20 per page).
 */
export async function getBooks(
  filters: GetBooksFilters = {},
  pagination: MongoPagination = {},
  db?: Db
): Promise<PaginatedResult<BookWithAuthor>> {
  const database = await resolveDb(db);
  const { page, perPage, skip } = normalizePagination(pagination);

  const match: Filter<Document> = {};
  if (filters.status) match.status = filters.status;
  if (filters.genre) match.genre = filters.genre;
  if (filters.visibility) match.visibility = filters.visibility;
  if (filters.authorId) match.author_id = coerceId(filters.authorId);

  const pipeline: Document[] = [
    { $match: match },
    { $sort: { created_at: -1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: perPage }, ...authorLookupStages()],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [facet] = await database.collection('books').aggregate(pipeline).toArray();
  const items = (facet?.items ?? []) as BookWithAuthor[];
  const total = Number(facet?.total?.[0]?.count ?? 0);
  return toPaginatedResult(items, total, page, perPage);
}

/**
 * Single book by id (ObjectId hex or legacy string UUID), with author join.
 */
export async function getBookById(
  id: string,
  options: { status?: Book['status']; visibility?: Book['visibility'] } = {},
  db?: Db
): Promise<BookWithAuthor | null> {
  const database = await resolveDb(db);
  const andClauses: Filter<Document>[] = [idMatchFilter(id)];
  if (options.status) andClauses.push({ status: options.status });
  if (options.visibility) andClauses.push({ visibility: options.visibility });

  const pipeline: Document[] = [
    { $match: andClauses.length === 1 ? andClauses[0] : { $and: andClauses } },
    ...authorLookupStages(),
    { $limit: 1 },
  ];

  const [doc] = await database.collection('books').aggregate(pipeline).toArray();
  return (doc as BookWithAuthor | undefined) ?? null;
}

/**
 * Insert a book document. Returns the inserted id as string.
 */
export async function createBook(
  input: {
    title: string;
    slug: string;
    author_id: string;
    description?: string;
    genre?: string;
    price?: number;
    currency?: string;
    status?: Book['status'];
    visibility?: Book['visibility'];
    cover_url?: string | null;
  },
  db?: Db
): Promise<string> {
  const database = await resolveDb(db);
  const now = new Date();
  const doc = {
    title: input.title,
    slug: input.slug,
    description: input.description ?? '',
    author_id: coerceId(input.author_id),
    genre: input.genre,
    price: input.price ?? 0,
    currency: input.currency ?? 'usd',
    status: input.status ?? 'draft',
    visibility: input.visibility ?? 'private',
    cover_url: input.cover_url ?? null,
    manuscript_url: null,
    avg_rating: 0,
    review_count: 0,
    created_at: now,
    updated_at: now,
  };
  const result = await database.collection('books').insertOne(doc);
  return String(result.insertedId);
}

/**
 * Patch a book by id. Returns false when no document matched.
 */
export async function updateBook(
  id: string,
  patch: Partial<{
    title: string;
    slug: string;
    description: string;
    genre: string;
    price: number;
    status: Book['status'];
    visibility: Book['visibility'];
    cover_url: string | null;
    manuscript_url: string | null;
  }>,
  db?: Db
): Promise<boolean> {
  const database = await resolveDb(db);
  const filter = idMatchFilter(id);

  const $set: Document = { updated_at: new Date() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) $set[key] = value;
  }

  const result = await database.collection('books').updateOne(filter, { $set });
  return result.matchedCount > 0;
}

export type UpsertOrderInput = {
  user_id: string;
  stripe_payment_intent_id: string;
  stripe_session_id?: string;
  amount: number;
  currency: string;
  order_items: Order['order_items'];
};

/**
 * Idempotent order upsert by `stripe_payment_intent_id` (WS2b.1.4).
 * Returns `{ inserted: true }` on first write, `{ inserted: false }` on duplicate.
 */
export async function upsertOrderByPaymentIntent(
  input: UpsertOrderInput,
  db?: Db
): Promise<{ inserted: boolean; orderId: string }> {
  const database = await resolveDb(db);
  const now = new Date();
  const filter = { stripe_payment_intent_id: input.stripe_payment_intent_id };

  const result = await database.collection('orders').updateOne(
    filter,
    {
      $setOnInsert: {
        user_id: input.user_id,
        status: 'completed',
        amount: input.amount,
        currency: input.currency,
        order_items: input.order_items,
        stripe_session_id: input.stripe_session_id ?? null,
        stripe_payment_intent_id: input.stripe_payment_intent_id,
        created_at: now,
        updated_at: now,
      },
    },
    { upsert: true }
  );

  const doc = await database.collection('orders').findOne(filter);
  const orderId = doc?._id ? String(doc._id) : '';
  return { inserted: Boolean(result.upsertedCount), orderId };
}

/**
 * Single book by slug, with author join. Returns null when not found.
 */
export async function getBookBySlug(
  slug: string,
  options: { status?: Book['status'] } = {},
  db?: Db
): Promise<BookWithAuthor | null> {
  const database = await resolveDb(db);
  const match: Filter<Document> = { slug };
  if (options.status) match.status = options.status;

  const pipeline: Document[] = [{ $match: match }, ...authorLookupStages(), { $limit: 1 }];

  const [doc] = await database.collection('books').aggregate(pipeline).toArray();
  return (doc as BookWithAuthor | undefined) ?? null;
}

/**
 * Orders for a user, newest first (default 20 per page).
 */
export async function getUserOrders(
  userId: string,
  pagination: MongoPagination = {},
  db?: Db
): Promise<PaginatedResult<Order>> {
  const database = await resolveDb(db);
  const { page, perPage, skip } = normalizePagination(pagination);

  const filter: Filter<Document> = { user_id: userId };
  const collection = database.collection('orders');

  const [total, items] = await Promise.all([
    collection.countDocuments(filter),
    collection.find(filter).sort({ created_at: -1 }).skip(skip).limit(perPage).toArray() as Promise<
      Order[]
    >,
  ]);

  return toPaginatedResult(items, total, page, perPage);
}

/**
 * Full-text book search (`$text`) sorted by text score (default 20 per page).
 * Requires the books text index from `npm run db:mongo:indexes`.
 */
export async function searchBooks(
  query: string,
  options: SearchBooksOptions = {},
  db?: Db
): Promise<PaginatedResult<BookWithAuthor>> {
  const database = await resolveDb(db);
  const { page, perPage, skip } = normalizePagination(options);
  const trimmed = query.trim();
  if (!trimmed) {
    return toPaginatedResult([], 0, page, perPage);
  }

  const match: Filter<Document> = {
    $text: { $search: trimmed },
  };
  if (options.status) match.status = options.status;
  if (options.visibility) match.visibility = options.visibility;

  const pipeline: Document[] = [
    { $match: match },
    { $addFields: { score: { $meta: 'textScore' } } },
    { $sort: { score: { $meta: 'textScore' } } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: perPage }, ...authorLookupStages()],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [facet] = await database.collection('books').aggregate(pipeline).toArray();
  const items = (facet?.items ?? []) as BookWithAuthor[];
  const total = Number(facet?.total?.[0]?.count ?? 0);
  return toPaginatedResult(items, total, page, perPage);
}
