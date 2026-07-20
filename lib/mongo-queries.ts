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

export type GetBooksFilters = {
  status?: Book['status'];
  authorId?: string;
  genre?: string;
};

export type SearchBooksOptions = MongoPagination & {
  /** Restrict to published by default for storefront search. */
  status?: Book['status'];
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
 * Single book by id (ObjectId hex or legacy string id), with author join.
 */
export async function getBookById(
  id: string,
  options: { status?: Book['status'] } = {},
  db?: Db
): Promise<BookWithAuthor | null> {
  const database = await resolveDb(db);
  const match: Filter<Document> = { _id: coerceId(id) };
  if (options.status) match.status = options.status;

  const pipeline: Document[] = [{ $match: match }, ...authorLookupStages(), { $limit: 1 }];

  const [doc] = await database.collection('books').aggregate(pipeline).toArray();
  return (doc as BookWithAuthor | undefined) ?? null;
}

export type InsertBookInput = Omit<
  Book,
  '_id' | 'avg_rating' | 'review_count' | 'created_at' | 'updated_at'
> & {
  avg_rating?: number;
  review_count?: number;
};

/**
 * Insert a book document. Returns the inserted id as a string.
 */
export async function insertBook(input: InsertBookInput, db?: Db): Promise<string> {
  const database = await resolveDb(db);
  const now = new Date();
  const doc = {
    ...input,
    author_id: typeof input.author_id === 'string' ? coerceId(input.author_id) : input.author_id,
    avg_rating: input.avg_rating ?? 0,
    review_count: input.review_count ?? 0,
    created_at: now,
    updated_at: now,
  };
  const result = await database.collection('books').insertOne(doc);
  return result.insertedId.toString();
}

export type UpdateBookPatch = Partial<
  Pick<
    Book,
    | 'title'
    | 'slug'
    | 'description'
    | 'cover_url'
    | 'manuscript_url'
    | 'status'
    | 'visibility'
    | 'price'
    | 'discount_price'
    | 'currency'
    | 'genre'
    | 'tags'
    | 'content_type'
    | 'published_at'
  >
>;

/**
 * Patch a book by id. Returns false when no document matched.
 */
export async function updateBook(id: string, patch: UpdateBookPatch, db?: Db): Promise<boolean> {
  const database = await resolveDb(db);
  const $set: Document = { ...patch, updated_at: new Date() };
  const result = await database
    .collection('books')
    .updateOne({ _id: coerceId(id) as ObjectId }, { $set });
  return result.matchedCount > 0;
}

export type UpsertOrderInput = {
  user_id: string;
  status: Order['status'];
  amount: number;
  currency: string;
  order_items: Order['order_items'];
  stripe_session_id?: string | null;
  stripe_payment_intent_id: string;
};

/**
 * Idempotent order upsert keyed by `stripe_payment_intent_id` (Phoenix 2b.1.4).
 * Uses `$setOnInsert` so duplicate webhook deliveries leave the first order intact.
 * Returns `{ upserted: true }` when a new order was created.
 */
export async function upsertOrderByPaymentIntent(
  input: UpsertOrderInput,
  db?: Db
): Promise<{ upserted: boolean; orderId: string | null }> {
  const database = await resolveDb(db);
  const now = new Date();
  const filter = { stripe_payment_intent_id: input.stripe_payment_intent_id };

  const result = await database.collection('orders').updateOne(
    filter,
    {
      $setOnInsert: {
        user_id: input.user_id,
        status: input.status,
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

  const upserted = Boolean(result.upsertedCount && result.upsertedCount > 0);
  const orderId = result.upsertedId
    ? String(result.upsertedId)
    : ((
        await database.collection('orders').findOne(filter, { projection: { _id: 1 } })
      )?._id?.toString() ?? null);

  return { upserted, orderId };
}

/**
 * Mark an order refunded by Stripe payment intent id.
 */
export async function markOrderRefundedByPaymentIntent(
  paymentIntentId: string,
  refundReason?: string | null,
  db?: Db
): Promise<boolean> {
  const database = await resolveDb(db);
  const result = await database.collection('orders').updateOne(
    { stripe_payment_intent_id: paymentIntentId },
    {
      $set: {
        status: 'refunded' as const,
        refund_reason: refundReason ?? null,
        updated_at: new Date(),
      },
    }
  );
  return result.matchedCount > 0;
}

/**
 * Distinct genres among published (+ optional visibility) books with counts.
 */
export async function listGenreCounts(
  options: { status?: Book['status']; visibility?: Book['visibility'] } = {},
  db?: Db
): Promise<Record<string, number>> {
  const database = await resolveDb(db);
  const match: Filter<Document> = {
    status: options.status ?? 'published',
  };
  if (options.visibility) match.visibility = options.visibility;

  const rows = await database
    .collection('books')
    .aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: '$genre', count: { $sum: 1 } } },
    ])
    .toArray();

  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row._id) counts[row._id] = row.count;
  }
  return counts;
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
