/**
 * @jest-environment node
 *
 * Phoenix 2b.1.1/2b.1.2 — Mongo book create/update (mocked Db).
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('getDb should not be called when Db is injected');
  }),
}));

import { ObjectId } from 'mongodb';
import { createBookMongo, slugifyTitle, updateBookMongo } from '@/lib/mongo-books';

describe('lib/mongo-books', () => {
  it('slugifyTitle normalizes titles', () => {
    expect(slugifyTitle('  Hello, World!  ')).toBe('hello-world');
  });

  it('createBookMongo inserts draft with avg_rating 0', async () => {
    const insertedId = new ObjectId();
    const findOne = jest.fn().mockResolvedValue(null);
    const insertOne = jest.fn().mockResolvedValue({ insertedId });
    const collection = jest.fn().mockReturnValue({ findOne, insertOne });
    const db = { collection } as unknown as import('mongodb').Db;

    const result = await createBookMongo(
      { title: 'My Novel', author_id: '507f1f77bcf86cd799439011', price: 9.99 },
      db
    );

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.book._id).toEqual(insertedId);
    expect(result.book.slug).toBe('my-novel');
    expect(result.book.status).toBe('draft');
    expect(result.book.avg_rating).toBe(0);
    expect(result.book.review_count).toBe(0);
    expect(insertOne).toHaveBeenCalled();
  });

  it('createBookMongo rejects duplicate slug', async () => {
    const findOne = jest.fn().mockResolvedValue({ _id: new ObjectId() });
    const insertOne = jest.fn();
    const collection = jest.fn().mockReturnValue({ findOne, insertOne });
    const db = { collection } as unknown as import('mongodb').Db;

    const result = await createBookMongo(
      { title: 'Taken', author_id: 'user-1', slug: 'taken' },
      db
    );
    expect(result).toEqual({
      error: 'A book with this slug already exists',
      code: 'DUPLICATE_SLUG',
    });
    expect(insertOne).not.toHaveBeenCalled();
  });

  it('updateBookMongo returns NOT_FOUND when missing', async () => {
    const findOneAndUpdate = jest.fn().mockResolvedValue(null);
    const findOne = jest.fn().mockResolvedValue(null);
    const collection = jest.fn().mockReturnValue({ findOneAndUpdate, findOne });
    const db = { collection } as unknown as import('mongodb').Db;

    const result = await updateBookMongo('507f1f77bcf86cd799439011', { title: 'Updated' }, db);
    expect(result).toEqual({ error: 'Book not found', code: 'NOT_FOUND' });
  });
});
