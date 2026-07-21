/**
 * Mongo review write + atomic avg_rating recompute (Phoenix 2c.1.2).
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { getDb } from '@/lib/mongo';
import type { Review } from '@/types/mongo';

function coerceId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

/** Driver Filter typings assume ObjectId-only `_id`. */
function asIdFilter(filter: Document): Filter<Document> {
  return filter as unknown as Filter<Document>;
}

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

export type UpsertReviewInput = {
  book_id: string;
  user_id: string;
  rating: number;
  title?: string;
  content?: string;
  verified_purchase?: boolean;
};

/**
 * Aggregate avg + count for a book, then `$set` on the books document.
 */
export async function recomputeBookRating(
  bookId: string,
  db?: Db
): Promise<{ avg_rating: number; review_count: number }> {
  const database = await resolveDb(db);
  const bookKey = coerceId(bookId);

  const [facet] = await database
    .collection('reviews')
    .aggregate<{ avg: number; count: number }>([
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

  const review_count = facet?.count ?? 0;
  const avg_rating = review_count ? Number((facet?.avg ?? 0).toFixed(2)) : 0;

  await database.collection('books').updateOne(asIdFilter({ _id: bookKey }), {
    $set: {
      avg_rating,
      review_count,
      updated_at: new Date(),
    },
  });

  return { avg_rating, review_count };
}

/**
 * Upsert one review per (book_id, user_id), then recompute book stats.
 */
export async function upsertReviewMongo(
  input: UpsertReviewInput,
  db?: Db
): Promise<{ review: Review; stats: { avg_rating: number; review_count: number } }> {
  const database = await resolveDb(db);
  const now = new Date();
  const bookKey = coerceId(input.book_id);
  const filter = { book_id: bookKey, user_id: input.user_id };

  const $set: Document = {
    rating: input.rating,
    title: input.title,
    content: input.content,
    verified_purchase: Boolean(input.verified_purchase),
    updated_at: now,
  };

  const result = await database.collection('reviews').findOneAndUpdate(
    filter,
    {
      $set,
      $setOnInsert: {
        book_id: bookKey,
        user_id: input.user_id,
        helpful_count: 0,
        created_at: now,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const review = result as Review | null;
  if (!review?._id) {
    throw new Error('Failed to upsert review');
  }

  const stats = await recomputeBookRating(input.book_id, database);
  return { review, stats };
}

export async function deleteReviewMongo(
  reviewId: string,
  userId: string,
  db?: Db
): Promise<{ deleted: boolean; bookId?: string }> {
  const database = await resolveDb(db);
  const existing = await database.collection('reviews').findOne(
    asIdFilter({
      _id: coerceId(reviewId),
      user_id: userId,
    })
  );
  if (!existing) {
    return { deleted: false };
  }

  await database.collection('reviews').deleteOne(asIdFilter({ _id: existing._id }));
  const bookId = String(existing.book_id);
  await recomputeBookRating(bookId, database);
  return { deleted: true, bookId };
}
