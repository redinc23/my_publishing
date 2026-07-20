/**
 * Mongo mutation helpers for Phoenix WS2c server actions.
 * Callers own auth/RBAC and revalidatePath.
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { getDb } from '@/lib/mongo';
import {
  insertBook,
  updateBookById,
  type InsertBookInput,
  type UpdateBookInput,
} from '@/lib/mongo-queries';
import type { Book, Profile, Review } from '@/types/mongo';

function coerceId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

export async function mongoInsertBook(input: InsertBookInput, db?: Db): Promise<Book> {
  return insertBook(input, db);
}

export async function mongoUpdateBook(
  id: string,
  patch: UpdateBookInput,
  db?: Db
): Promise<Book | null> {
  return updateBookById(id, patch, db);
}

export type InsertReviewInput = {
  book_id: string;
  user_id: string;
  rating: number;
  title?: string;
  content?: string;
  verified_purchase?: boolean;
};

/**
 * Insert a review, then atomically recompute books.avg_rating + review_count.
 */
export async function mongoInsertReview(
  input: InsertReviewInput,
  db?: Db
): Promise<{ review: Review; avg_rating: number; review_count: number }> {
  const database = await resolveDb(db);
  const now = new Date();
  const bookId = coerceId(input.book_id);

  const doc = {
    book_id: bookId,
    user_id: input.user_id,
    rating: input.rating,
    title: input.title,
    content: input.content,
    helpful_count: 0,
    verified_purchase: Boolean(input.verified_purchase),
    created_at: now,
    updated_at: now,
  };

  const result = await database.collection('reviews').insertOne(doc);
  const review = { _id: result.insertedId, ...doc } as Review;

  const { avg_rating, review_count } = await recomputeBookRating(String(bookId), database);
  return { review, avg_rating, review_count };
}

/**
 * Aggregate avg+count over reviews for a book and write onto the book doc.
 */
export async function recomputeBookRating(
  bookId: string,
  db?: Db
): Promise<{ avg_rating: number; review_count: number }> {
  const database = await resolveDb(db);
  const id = coerceId(bookId);

  const [agg] = await database
    .collection('reviews')
    .aggregate<{ avg: number; count: number }>([
      { $match: { book_id: id } },
      {
        $group: {
          _id: null,
          avg: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const avg_rating = agg ? Math.round(agg.avg * 100) / 100 : 0;
  const review_count = agg?.count ?? 0;
  const now = new Date();

  await database
    .collection('books')
    .updateOne({ _id: id } as Filter<Document>, {
      $set: { avg_rating, review_count, updated_at: now },
    });

  return { avg_rating, review_count };
}

export type UpdateProfileInput = Partial<
  Pick<Profile, 'display_name' | 'bio' | 'avatar_url' | 'role' | 'email'>
>;

export async function mongoUpdateProfile(
  authUserId: string,
  patch: UpdateProfileInput,
  db?: Db
): Promise<Profile | null> {
  const database = await resolveDb(db);
  const now = new Date();
  const result = await database
    .collection('profiles')
    .findOneAndUpdate(
      { auth_user_id: authUserId },
      { $set: { ...patch, updated_at: now } },
      { returnDocument: 'after' }
    );
  return (result as unknown as Profile | null) ?? null;
}
