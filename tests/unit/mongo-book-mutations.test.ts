/**
 * @jest-environment node
 *
 * Phoenix WS2b — getBookById / createBook / updateBook (mocked Db).
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('getDb should not be called when Db is injected');
  }),
}));

import { ObjectId } from 'mongodb';
import { createBook, getBookById, updateBook } from '@/lib/mongo-queries';

describe('mongo-queries book mutations', () => {
  it('getBookById aggregates by coerced ObjectId', async () => {
    const id = new ObjectId();
    const toArray = jest
      .fn()
      .mockResolvedValue([{ _id: id, title: 'Hello', slug: 'hello', author: null }]);
    const aggregate = jest.fn().mockReturnValue({ toArray });
    const db = {
      collection: jest.fn().mockReturnValue({ aggregate }),
    } as unknown as import('mongodb').Db;

    const book = await getBookById(id.toString(), {}, db);
    expect(book?.title).toBe('Hello');
    expect(aggregate).toHaveBeenCalled();
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[0].$match._id).toBeInstanceOf(ObjectId);
  });

  it('createBook inserts with avg_rating 0 and returns _id', async () => {
    const insertedId = new ObjectId();
    const insertOne = jest.fn().mockResolvedValue({ insertedId });
    const db = {
      collection: jest.fn().mockReturnValue({ insertOne }),
    } as unknown as import('mongodb').Db;

    const book = await createBook(
      {
        title: 'New',
        slug: 'new',
        author_id: new ObjectId().toString(),
        status: 'draft',
      },
      db
    );

    expect(book._id).toEqual(insertedId);
    expect(book.avg_rating).toBe(0);
    expect(book.review_count).toBe(0);
    expect(insertOne).toHaveBeenCalled();
  });

  it('updateBook applies $set and returns after document', async () => {
    const id = new ObjectId();
    const findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: id,
      title: 'Updated',
      slug: 'new',
      avg_rating: 0,
      review_count: 0,
      author_id: id,
      status: 'published',
      created_at: new Date(),
      updated_at: new Date(),
    });
    const db = {
      collection: jest.fn().mockReturnValue({ findOneAndUpdate }),
    } as unknown as import('mongodb').Db;

    const book = await updateBook(id.toString(), { title: 'Updated', status: 'published' }, db);
    expect(book?.title).toBe('Updated');
    expect(findOneAndUpdate.mock.calls[0][1].$set.title).toBe('Updated');
    expect(findOneAndUpdate.mock.calls[0][1].$set.status).toBe('published');
  });
});
