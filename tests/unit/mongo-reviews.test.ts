/**
 * @jest-environment node
 *
 * Phoenix 2c.1.2 — avg_rating / review_count recompute (mocked Db).
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('getDb should not be called when Db is injected');
  }),
}));

import { recomputeBookRating, upsertMongoReview } from '@/lib/mongo-reviews';

function mockReviewDb(opts: {
  aggregateResult?: unknown[];
  existingReview?: unknown | null;
  insertId?: string;
}) {
  const toArray = jest.fn().mockResolvedValue(opts.aggregateResult ?? []);
  const aggregate = jest.fn().mockReturnValue({ toArray });
  const findOne = jest.fn().mockResolvedValue(opts.existingReview ?? null);
  const updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
  const insertOne = jest.fn().mockResolvedValue({ insertedId: opts.insertId ?? 'rev1' });
  const deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });

  const collection = jest.fn().mockImplementation((name: string) => {
    if (name === 'reviews') {
      return { aggregate, findOne, updateOne, insertOne, deleteOne };
    }
    if (name === 'books') {
      return { updateOne };
    }
    if (name === 'orders') {
      return { findOne: jest.fn().mockResolvedValue(null) };
    }
    return { aggregate, findOne, updateOne, insertOne };
  });

  return {
    db: { collection } as unknown as import('mongodb').Db,
    aggregate,
    updateOne,
    insertOne,
    findOne,
    collection,
  };
}

describe('lib/mongo-reviews', () => {
  it('recomputes avg_rating and review_count onto books', async () => {
    const { db, updateOne, collection } = mockReviewDb({
      aggregateResult: [{ avg: 4.333, count: 3 }],
    });

    const stats = await recomputeBookRating('507f1f77bcf86cd799439011', db);

    expect(stats).toEqual({ avg_rating: 4.33, review_count: 3 });
    expect(collection).toHaveBeenCalledWith('reviews');
    expect(collection).toHaveBeenCalledWith('books');
    expect(updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          avg_rating: 4.33,
          review_count: 3,
        }),
      })
    );
  });

  it('upserts a new review then recomputes', async () => {
    const { db, insertOne } = mockReviewDb({
      existingReview: null,
      aggregateResult: [{ avg: 5, count: 1 }],
      insertId: 'new-rev',
    });

    const result = await upsertMongoReview(
      {
        bookId: '507f1f77bcf86cd799439011',
        userId: 'user-1',
        rating: 5,
        title: 'Great',
        content: 'Loved it',
        verifiedPurchase: true,
      },
      db
    );

    expect(insertOne).toHaveBeenCalled();
    expect(result.created).toBe(true);
    expect(result.avg_rating).toBe(5);
    expect(result.review_count).toBe(1);
  });

  it('updates existing review without insert', async () => {
    const { db, insertOne, updateOne } = mockReviewDb({
      existingReview: { _id: 'old-rev', book_id: 'b1', user_id: 'user-1' },
      aggregateResult: [{ avg: 4, count: 1 }],
    });

    const result = await upsertMongoReview(
      {
        bookId: 'b1',
        userId: 'user-1',
        rating: 4,
        content: 'Updated',
      },
      db
    );

    expect(insertOne).not.toHaveBeenCalled();
    expect(updateOne).toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.reviewId).toBe('old-rev');
  });
});
