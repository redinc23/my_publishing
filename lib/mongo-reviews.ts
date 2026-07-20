/**
 * Mongo review mutations + atomic avg_rating / review_count recompute (2c.1.2).
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db } from 'mongodb';
import { getDb } from '@/lib/mongo';
import type { Review } from '@/types/mongo';

function coerceId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

export type UpsertMongoReviewInput = {
  bookId: string;
  userId: string;
  rating: number;
  title?: string;
  content?: string;
  verifiedPurchase?: boolean;
};

export type UpsertMongoReviewResult = {
  reviewId: string;
  created: boolean;
  avg_rating: number;
  review_count: number;
};

/**
 * Aggregate reviews for a book and write avg_rating + review_count onto books.
 */
export async function recomputeBookRating(
  bookId: string,
  db?: Db
): Promise<{ avg_rating: number; review_count: number }> {
  const database = await resolveDb(db);
  const bookKey = coerceId(bookId);

  const [agg] = await database
    .collection('reviews')
    .aggregate<{ avg: number | null; count: number }>([
      { $match: { book_id: bookKey } },
      {
        $group: {
          _id: null,
          avg: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const review_count = agg?.count ?? 0;
  const avg_rating = review_count
    ? Number((agg?.avg ?? 0).toFixed(2))
    : 0;

  await database.collection('books').updateOne(
    { _id: bookKey },
    {
      $set: {
        avg_rating,
        review_count,
        updated_at: new Date(),
      },
    }
  );

  return { avg_rating, review_count };
}

/**
 * Insert or update the user's review for a book, then recompute book stats.
 */
export async function upsertMongoReview(
  input: UpsertMongoReviewInput,
  db?: Db
): Promise<UpsertMongoReviewResult> {
  const database = await resolveDb(db);
  const now = new Date();
  const bookKey = coerceId(input.bookId);
  const reviews = database.collection('reviews');

  const existing = await reviews.findOne({
    book_id: bookKey,
    user_id: input.userId,
  });

  if (existing) {
    await reviews.updateOne(
      { _id: existing._id },
      {
        $set: {
          rating: input.rating,
          title: input.title,
          content: input.content,
          verified_purchase: Boolean(input.verifiedPurchase),
          updated_at: now,
        },
      }
    );
    const stats = await recomputeBookRating(input.bookId, database);
    return {
      reviewId: String(existing._id),
      created: false,
      ...stats,
    };
  }

  const doc: Omit<Review, '_id'> = {
    book_id: bookKey,
    user_id: input.userId,
    rating: input.rating,
    title: input.title,
    content: input.content,
    helpful_count: 0,
    verified_purchase: Boolean(input.verifiedPurchase),
    created_at: now,
    updated_at: now,
  };

  const inserted = await reviews.insertOne(doc);
  const stats = await recomputeBookRating(input.bookId, database);
  return {
    reviewId: String(inserted.insertedId),
    created: true,
    ...stats,
  };
}

export async function deleteMongoReview(
  reviewId: string,
  userId: string,
  db?: Db
): Promise<{ deleted: boolean; bookId?: string; avg_rating?: number; review_count?: number }> {
  const database = await resolveDb(db);
  const reviews = database.collection('reviews');
  const existing = await reviews.findOne({ _id: coerceId(reviewId) });
  if (!existing || existing.user_id !== userId) {
    return { deleted: false };
  }

  const bookId = String(existing.book_id);
  await reviews.deleteOne({ _id: existing._id });
  const stats = await recomputeBookRating(bookId, database);
  return { deleted: true, bookId, ...stats };
}

/** True when the user has a completed Mongo order containing the book. */
export async function hasMongoPurchaseForBook(
  userId: string,
  bookId: string,
  db?: Db
): Promise<boolean> {
  const database = await resolveDb(db);
  const bookKey = coerceId(bookId);
  const order = await database.collection('orders').findOne({
    user_id: userId,
    status: 'completed',
    'order_items.book_id': bookKey,
  });
  return Boolean(order);
}
