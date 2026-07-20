/**
 * MongoDB query library (Phoenix WS2a / Task 2a.3).
 *
 * Server-only. Callers must ensure `DATABASE_PROVIDER=mongodb` (or migration
 * scripts) before relying on these — production stays on Supabase until cutover.
 */

import '@/lib/server-only-guard';

import type { Document, Filter } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type {
  Book,
  BookWithAuthor,
  Order,
  PaginatedResult,
  PaginationInput,
} from '@/types/mongo';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface GetBooksFilters extends PaginationInput {
  status?: Book['status'];
  visibility?: Book['visibility'];
  authorId?: string;
  genre?: string;
}

function normalizePagination(input: PaginationInput = {}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input.limit ?? DEFAULT_PAGE_SIZE)));
  return { page, limit, skip: (page - 1) * limit };
}

function paginated<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return {
    items,
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}

function authorLookupStages(): Document[] {
  return [
    {
      $lookup: {
        from: 'authors',
        localField: 'author_id',
        foreignField: '_id',
        as: '_author',
      },
    },
    {
      $addFields: {
        author: {
          $let: {
            vars: { a: { $arrayElemAt: ['$_author', 0] } },
            in: {
              $cond: [
                { $eq: ['$$a', null] },
                null,
                {
                  _id: '$$a._id',
                  pen_name: '$$a.pen_name',
                  photo_url: '$$a.photo_url',
                  bio: '$$a.bio',
                },
              ],
            },
          },
        },
      },
    },
    { $project: { _author: 0 } },
  ];
}

/**
 * List books with author `$lookup`. Default page size 20.
 */
export async function getBooks(filters: GetBooksFilters = {}): Promise<PaginatedResult<BookWithAuthor>> {
  const { page, limit, skip } = normalizePagination(filters);
  const match: Filter<Book> = {};

  if (filters.status) match.status = filters.status;
  if (filters.visibility) match.visibility = filters.visibility;
  if (filters.authorId) match.author_id = filters.authorId as Book['author_id'];
  if (filters.genre) match.genre = filters.genre;

  const db = await getDb();
  const collection = db.collection<Book>('books');

  const [facet] = await collection
    .aggregate<{ items: BookWithAuthor[]; total: Array<{ count: number }> }>([
      { $match: match },
      { $sort: { created_at: -1 } },
      {
        $facet: {
          items: [...authorLookupStages(), { $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ])
    .toArray();

  const total = facet?.total?.[0]?.count ?? 0;
  return paginated(facet?.items ?? [], total, page, limit);
}

/**
 * Fetch a single book by slug (with author join).
 */
export async function getBookBySlug(slug: string): Promise<BookWithAuthor | null> {
  const normalized = slug.trim();
  if (!normalized) return null;

  const db = await getDb();
  const rows = await db
    .collection<Book>('books')
    .aggregate<BookWithAuthor>([{ $match: { slug: normalized } }, ...authorLookupStages(), { $limit: 1 }])
    .toArray();

  return rows[0] ?? null;
}

/**
 * Orders for a user, newest first. Default page size 20.
 */
export async function getUserOrders(
  userId: string,
  pagination: PaginationInput = {}
): Promise<PaginatedResult<Order>> {
  const { page, limit, skip } = normalizePagination(pagination);
  if (!userId) {
    return paginated<Order>([], 0, page, limit);
  }

  const db = await getDb();
  const collection = db.collection<Order>('orders');
  const filter: Filter<Order> = { user_id: userId };

  const [items, total] = await Promise.all([
    collection.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);

  return paginated(items, total, page, limit);
}

export interface SearchBooksInput extends PaginationInput {
  query: string;
}

/**
 * Full-text search over books (`$text` + textScore sort). Default page size 20.
 * Requires the books text index (see `scripts/mongo-ensure-indexes.ts`).
 */
export async function searchBooks(input: SearchBooksInput): Promise<PaginatedResult<BookWithAuthor>> {
  const { page, limit, skip } = normalizePagination(input);
  const q = input.query?.trim() ?? '';
  if (!q) {
    return paginated<BookWithAuthor>([], 0, page, limit);
  }

  const db = await getDb();
  const collection = db.collection<Book>('books');

  const [facet] = await collection
    .aggregate<{ items: BookWithAuthor[]; total: Array<{ count: number }> }>([
      { $match: { $text: { $search: q } } },
      { $addFields: { score: { $meta: 'textScore' } } },
      { $sort: { score: -1 } },
      {
        $facet: {
          items: [...authorLookupStages(), { $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ])
    .toArray();

  const total = facet?.total?.[0]?.count ?? 0;
  return paginated(facet?.items ?? [], total, page, limit);
}

/** Test helper exports (pagination math). */
export const __mongoQueryInternals = {
  normalizePagination,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
};
