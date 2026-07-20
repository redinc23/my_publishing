/**
 * @jest-environment node
 *
 * Phoenix 2c.1.2 — avg_rating recompute after review insert.
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('getDb should not be called when Db is injected');
  }),
}));

import { ObjectId } from 'mongodb';
import { mongoInsertReview, recomputeBookRating } from '@/lib/actions/mongo-mutations';

describe('mongo review + avg_rating recompute', () => {
  it('recomputeBookRating aggregates avg and count onto the book', async () => {
    const bookId = new ObjectId();
    const toArray = jest.fn().mockResolvedValue([{ avg: 4.5, count: 2 }]);
    const aggregate = jest.fn().mockReturnValue({ toArray });
    const updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });

    const collection = jest.fn().mockImplementation((name: string) => {
      if (name === 'reviews') return { aggregate };
      if (name === 'books') return { updateOne };
      return {};
    });
    const db = { collection } as unknown as import('mongodb').Db;

    const result = await recomputeBookRating(String(bookId), db);

    expect(result).toEqual({ avg_rating: 4.5, review_count: 2 });
    expect(updateOne).toHaveBeenCalled();
    const [, update] = updateOne.mock.calls[0];
    expect(update.$set.avg_rating).toBe(4.5);
    expect(update.$set.review_count).toBe(2);
  });

  it('mongoInsertReview inserts then recomputes', async () => {
    const bookId = new ObjectId();
    const insertOne = jest.fn().mockResolvedValue({ insertedId: new ObjectId() });
    const toArray = jest.fn().mockResolvedValue([{ avg: 5, count: 1 }]);
    const aggregate = jest.fn().mockReturnValue({ toArray });
    const updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });

    const collection = jest.fn().mockImplementation((name: string) => {
      if (name === 'reviews') return { insertOne, aggregate };
      if (name === 'books') return { updateOne };
      return {};
    });
    const db = { collection } as unknown as import('mongodb').Db;

    const result = await mongoInsertReview(
      { book_id: String(bookId), user_id: 'u1', rating: 5, title: 'Great' },
      db
    );

    expect(result.avg_rating).toBe(5);
    expect(result.review_count).toBe(1);
    expect(insertOne).toHaveBeenCalled();
    expect(updateOne).toHaveBeenCalled();
  });
});
