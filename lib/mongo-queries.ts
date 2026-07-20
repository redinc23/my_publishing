/**
 * MongoDB query layer (Phoenix WS2a.3).
 * Server-only — used when DATABASE_PROVIDER=mongodb (WS2d wires pages).
 */

import '@/lib/server-only-guard';
import { ObjectId, type Filter } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type {
  Book,
  BookWithAuthor,
  Order,
  OrderWithBooks,
} from '@/types/mongo';
import { MONGO_COLLECTIONS } from '@/types/mongo';

const DEFAULT_PAGE_SIZE = 20;

export type BookSort = 'newest' | 'oldest' | 'rating' | 'popular' | 'price';

export interface GetBooksFilters {
  genre?: string;
  contentType?: string;
  sort?: BookSort;
  page?: number;
  limit?: number;
}

function toObjectId(value: ObjectId | string | undefined): ObjectId | null {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  return null;
}

function buildPublishedBookMatch(filters: GetBooksFilters): Filter<Book> {
  const match: Filter<Book> = {
    status: 'published',
    visibility: 'public',
  };
  if (filters.genre) {
    match.genre = filters.genre;
  }
  if (filters.contentType) {
    match.content_type = filters.contentType as Book['content_type'];
  }
  return match;
}

function sortStage(sort: BookSort = 'newest'): Record<string, 1 | -1> {
  switch (sort) {
    case 'oldest':
      return { published_at: 1 };
    case 'rating':
      return { avg_rating: -1 };
    case 'popular':
      return { total_reads: -1 };
    case 'price':
      return { price: 1 };
    case 'newest':
    default:
      return { published_at: -1 };
  }
}

/**
 * Paginated catalog list with author lookup (2a.3.1).
 */
export async function getBooks(filters: GetBooksFilters = {}): Promise<BookWithAuthor[]> {
  const db = await getDb();
  const page = Math.max(0, filters.page ?? 0);
  const limit = filters.limit ?? DEFAULT_PAGE_SIZE;
  const skip = page * limit;

  const pipeline = [
    { $match: buildPublishedBookMatch(filters) },
    {
      $lookup: {
        from: MONGO_COLLECTIONS.authors,
        let: { authorId: '$author_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$_id', '$$authorId'] },
                  { $eq: [{ $toString: '$_id' }, { $toString: '$$authorId' }] },
                ],
              },
            },
          },
          {
            $lookup: {
              from: MONGO_COLLECTIONS.profiles,
              let: { profileId: '$profile_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $or: [
                        { $eq: ['$_id', '$$profileId'] },
                        { $eq: [{ $toString: '$_id' }, { $toString: '$$profileId' }] },
                      ],
                    },
                  },
                },
                { $project: { display_name: 1, avatar_url: 1 } },
              ],
              as: 'profile',
            },
          },
          { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
        ],
        as: 'author_docs',
      },
    },
    { $unwind: { path: '$author_docs', preserveNullAndEmptyArrays: true } },
    { $sort: sortStage(filters.sort) },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        title: 1,
        slug: 1,
        description: 1,
        cover_url: 1,
        manuscript_url: 1,
        author_id: 1,
        status: 1,
        visibility: 1,
        price: 1,
        currency: 1,
        genre: 1,
        tags: 1,
        content_type: 1,
        avg_rating: 1,
        review_count: 1,
        total_reads: 1,
        is_featured: 1,
        published_at: 1,
        created_at: 1,
        updated_at: 1,
        author: {
          _id: '$author_docs._id',
          pen_name: '$author_docs.pen_name',
          profile: '$author_docs.profile',
        },
      },
    },
  ];

  return db.collection<Book>(MONGO_COLLECTIONS.books).aggregate<BookWithAuthor>(pipeline).toArray();
}

/**
 * Single published book by slug with author join (2a.3.2).
 */
export async function getBookBySlug(slug: string): Promise<BookWithAuthor | null> {
  const db = await getDb();
  const results = await db
    .collection<Book>(MONGO_COLLECTIONS.books)
    .aggregate<BookWithAuthor>([
      { $match: { slug, status: 'published', visibility: 'public' } },
      {
        $lookup: {
          from: MONGO_COLLECTIONS.authors,
          let: { authorId: '$author_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$authorId'] },
                    { $eq: [{ $toString: '$_id' }, { $toString: '$$authorId' }] },
                  ],
                },
              },
            },
          ],
          as: 'author_docs',
        },
      },
      { $unwind: { path: '$author_docs', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          title: 1,
          slug: 1,
          description: 1,
          cover_url: 1,
          manuscript_url: 1,
          author_id: 1,
          status: 1,
          visibility: 1,
          price: 1,
          currency: 1,
          genre: 1,
          tags: 1,
          content_type: 1,
          avg_rating: 1,
          review_count: 1,
          total_reads: 1,
          is_featured: 1,
          published_at: 1,
          created_at: 1,
          updated_at: 1,
          author: {
            _id: '$author_docs._id',
            pen_name: '$author_docs.pen_name',
          },
        },
      },
      { $limit: 1 },
    ])
    .toArray();

  return results[0] ?? null;
}

/**
 * Orders for a Better Auth user id (2a.3.3).
 * Resolves profile by auth_user_id, then matches orders by profile id or auth id.
 */
export async function getUserOrders(authUserId: string): Promise<OrderWithBooks[]> {
  const db = await getDb();
  const profile = await db
    .collection(MONGO_COLLECTIONS.profiles)
    .findOne({ auth_user_id: authUserId });

  if (!profile) {
    return [];
  }

  const profileId = profile._id;
  const userMatchers: Array<ObjectId | string> = [authUserId];
  if (profileId) {
    userMatchers.push(profileId, profileId.toString());
  }

  const orders = await db
    .collection<Order>(MONGO_COLLECTIONS.orders)
    .find({ user_id: { $in: userMatchers } })
    .sort({ created_at: -1 })
    .toArray();

  if (orders.length === 0) {
    return [];
  }

  const bookIds = Array.from(
    new Set(
      orders.flatMap((order) =>
        (order.order_items ?? []).map((item) => item.book_id).filter(Boolean)
      )
    )
  );

  const objectIds = bookIds
    .map((id) => toObjectId(id))
    .filter((id): id is ObjectId => id !== null);
  const stringIds = bookIds.filter((id) => typeof id === 'string');

  type BookSummary = Pick<Book, '_id' | 'title' | 'cover_url' | 'slug' | 'author_id'>;

  const books = (await db
    .collection<Book>(MONGO_COLLECTIONS.books)
    .find({
      $or: [
        ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
        ...(stringIds.length ? [{ _id: { $in: stringIds as never[] } }] : []),
      ],
    })
    .project({ title: 1, cover_url: 1, slug: 1, author_id: 1 })
    .toArray()) as BookSummary[];

  const bookByKey = new Map<string, BookSummary>();
  for (const book of books) {
    if (book._id) {
      bookByKey.set(book._id.toString(), book);
    }
  }

  return orders.map((order) => ({
    ...order,
    books: (order.order_items ?? [])
      .map((item) => {
        const key =
          item.book_id instanceof ObjectId ? item.book_id.toString() : String(item.book_id);
        const book = bookByKey.get(key);
        if (!book?._id) return null;
        return {
          _id: book._id,
          title: book.title,
          cover_url: book.cover_url,
          slug: book.slug,
          author_id: book.author_id,
        };
      })
      .filter((book): book is NonNullable<typeof book> => book !== null),
  }));
}

/**
 * Full-text search with text score sort (2a.3.4).
 */
export async function searchBooks(query: string, limit = DEFAULT_PAGE_SIZE): Promise<BookWithAuthor[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const db = await getDb();
  return db
    .collection<Book>(MONGO_COLLECTIONS.books)
    .aggregate<BookWithAuthor>([
      {
        $match: {
          $text: { $search: trimmed },
          status: 'published',
          visibility: 'public',
        },
      },
      { $addFields: { score: { $meta: 'textScore' } } },
      { $sort: { score: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: MONGO_COLLECTIONS.authors,
          let: { authorId: '$author_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$authorId'] },
                    { $eq: [{ $toString: '$_id' }, { $toString: '$$authorId' }] },
                  ],
                },
              },
            },
          ],
          as: 'author_docs',
        },
      },
      { $unwind: { path: '$author_docs', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          title: 1,
          slug: 1,
          description: 1,
          cover_url: 1,
          author_id: 1,
          avg_rating: 1,
          review_count: 1,
          genre: 1,
          price: 1,
          score: 1,
          author: {
            _id: '$author_docs._id',
            pen_name: '$author_docs.pen_name',
          },
        },
      },
    ])
    .toArray();
}
