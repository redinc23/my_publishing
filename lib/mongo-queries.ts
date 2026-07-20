/**
 * Centralized MongoDB query helpers (Phoenix WS2a Task 2a.3).
 *
 * Server-only. Accepts an optional `Db` for unit tests; production callers
 * omit it and use the cached singleton via `getDb()`.
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { getDb } from '@/lib/mongo';
import type {
  Book,
  BookWithAuthor,
  MongoPagination,
  Order,
  PaginatedResult,
} from '@/types/mongo';

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

  const pipeline: Document[] = [
    { $match: match },
    ...authorLookupStages(),
    { $limit: 1 },
  ];

  const [doc] = await database.collection('books').aggregate(pipeline).toArray();
  return (doc as BookWithAuthor | undefined) ?? null;
}

/**
 * Single book by id (ObjectId hex or string id), with author join.
 */
export async function getBookById(
  id: string,
  options: { status?: Book['status'] } = {},
  db?: Db
): Promise<BookWithAuthor | null> {
  const database = await resolveDb(db);
  const match: Filter<Document> = { _id: coerceId(id) };
  if (options.status) match.status = options.status;

  const pipeline: Document[] = [
    { $match: match },
    ...authorLookupStages(),
    { $limit: 1 },
  ];

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
    collection
      .find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(perPage)
      .toArray() as Promise<Order[]>,
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
