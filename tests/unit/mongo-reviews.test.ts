/**
 * @jest-environment node
 *
 * Phoenix 2c.1.2 — review upsert + avg_rating recompute (mocked Db).
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('getDb should not be called when Db is injected');
  }),
}));

import { ObjectId } from 'mongodb';
import { recomputeBookRating, upsertReviewMongo } from '@/lib/mongo-reviews';

describe('lib/mongo-reviews', () => {
  it('recomputeBookRating sets avg_rating and review_count on books', async () => {
    const bookId = new ObjectId().toHexString();
    const updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const toArray = jest.fn().mockResolvedValue([{ avg: 4.5, count: 2 }]);
    const aggregate = jest.fn().mockReturnValue({ toArray });
    const collection = jest.fn().mockImplementation((name: string) => {
      if (name === 'reviews') return { aggregate };
      return { updateOne };
    });
    const db = { collection } as unknown as import('mongodb').Db;

    const stats = await recomputeBookRating(bookId, db);
    expect(stats).toEqual({ avg_rating: 4.5, review_count: 2 });
    expect(updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ avg_rating: 4.5, review_count: 2 }),
      })
    );
  });

  it('upsertReviewMongo writes review then recomputes', async () => {
    const bookId = new ObjectId().toHexString();
    const reviewId = new ObjectId();
    const findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: reviewId,
      book_id: bookId,
      user_id: 'user-1',
      rating: 5,
      helpful_count: 0,
    });
    const updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const toArray = jest.fn().mockResolvedValue([{ avg: 5, count: 1 }]);
    const aggregate = jest.fn().mockReturnValue({ toArray });
    const collection = jest.fn().mockImplementation((name: string) => {
      if (name === 'reviews') return { findOneAndUpdate, aggregate };
      return { updateOne };
    });
    const db = { collection } as unknown as import('mongodb').Db;

    const result = await upsertReviewMongo(
      { book_id: bookId, user_id: 'user-1', rating: 5, content: 'Great' },
      db
    );
    expect(result.stats.avg_rating).toBe(5);
    expect(result.stats.review_count).toBe(1);
    expect(findOneAndUpdate).toHaveBeenCalled();
  });
});
