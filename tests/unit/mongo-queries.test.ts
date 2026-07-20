/**
 * @jest-environment node
 *
 * Unit tests for Phoenix WS2a mongo-queries (mocked Db — no live Atlas).
 * Node env required: the mongodb driver needs TextEncoder (not in jsdom).
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('getDb should not be called when Db is injected');
  }),
}));

import {
  DEFAULT_PAGE_SIZE,
  getBookById,
  getBookBySlug,
  getBooks,
  getUserOrders,
  searchBooks,
} from '@/lib/mongo-queries';

type AggFn = jest.Mock;
type FindFn = jest.Mock;
type CountFn = jest.Mock;

function mockDb(
  handlers: {
    aggregateResult?: unknown[];
    findResult?: unknown[];
    countResult?: number;
  } = {}
) {
  const toArray: AggFn = jest.fn().mockResolvedValue(handlers.aggregateResult ?? []);
  const aggregate = jest.fn().mockReturnValue({ toArray });

  const findToArray: FindFn = jest.fn().mockResolvedValue(handlers.findResult ?? []);
  const limit = jest.fn().mockReturnValue({ toArray: findToArray });
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  const find = jest.fn().mockReturnValue({ sort });
  const countDocuments: CountFn = jest.fn().mockResolvedValue(handlers.countResult ?? 0);

  const collection = jest.fn().mockImplementation((name: string) => {
    if (name === 'orders') {
      return { find, countDocuments };
    }
    return { aggregate };
  });

  return {
    db: { collection } as unknown as import('mongodb').Db,
    aggregate,
    toArray,
    find,
    countDocuments,
    sort,
    skip,
    limit,
  };
}

describe('lib/mongo-queries', () => {
  it('exports default page size of 20', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });

  it('getBooks aggregates with author lookup and pagination defaults', async () => {
    const { db, aggregate, toArray } = mockDb({
      aggregateResult: [
        {
          items: [{ _id: 'b1', title: 'Test', slug: 'test', author: { pen_name: 'A' } }],
          total: [{ count: 1 }],
        },
      ],
    });

    const result = await getBooks({ status: 'published' }, {}, db);

    expect(aggregate).toHaveBeenCalled();
    const pipeline = aggregate.mock.calls[0][0] as Record<string, unknown>[];
    expect(pipeline[0]).toEqual({ $match: { status: 'published' } });
    expect(pipeline[1]).toEqual({ $sort: { created_at: -1 } });
    const facet = pipeline[2] as { $facet: { items: unknown[] } };
    expect(facet.$facet.items[0]).toEqual({ $skip: 0 });
    expect(facet.$facet.items[1]).toEqual({ $limit: 20 });
    expect(facet.$facet.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ $lookup: expect.any(Object) })])
    );

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
    expect(result.hasNext).toBe(false);
    expect(toArray).toHaveBeenCalled();
  });

  it('getBookBySlug returns null when missing', async () => {
    const { db } = mockDb({ aggregateResult: [] });
    await expect(getBookBySlug('missing', {}, db)).resolves.toBeNull();
  });

  it('getBookBySlug returns joined book', async () => {
    const doc = { _id: 'b2', slug: 'hello', title: 'Hello', author: null };
    const { db, aggregate } = mockDb({ aggregateResult: [doc] });
    const result = await getBookBySlug('hello', { status: 'published' }, db);
    expect(result?.slug).toBe('hello');
    const pipeline = aggregate.mock.calls[0][0] as Record<string, unknown>[];
    expect(pipeline[0]).toEqual({ $match: { slug: 'hello', status: 'published' } });
  });

  it('getUserOrders pages by user_id', async () => {
    const { db, find, countDocuments, sort, skip, limit } = mockDb({
      findResult: [
        {
          _id: 'o1',
          user_id: 'user-1',
          order_items: [],
          amount: 10,
          currency: 'usd',
          status: 'completed',
        },
      ],
      countResult: 21,
    });

    const result = await getUserOrders('user-1', { page: 2, perPage: 20 }, db);

    expect(countDocuments).toHaveBeenCalledWith({ user_id: 'user-1' });
    expect(find).toHaveBeenCalledWith({ user_id: 'user-1' });
    expect(sort).toHaveBeenCalledWith({ created_at: -1 });
    expect(skip).toHaveBeenCalledWith(20);
    expect(limit).toHaveBeenCalledWith(20);
    expect(result.total).toBe(21);
    expect(result.page).toBe(2);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(true);
  });

  it('searchBooks returns empty for blank query without hitting the driver', async () => {
    const { db, aggregate } = mockDb();
    const result = await searchBooks('   ', {}, db);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('searchBooks uses $text and textScore sort', async () => {
    const { db, aggregate } = mockDb({
      aggregateResult: [{ items: [{ slug: 'a', score: 1.5 }], total: [{ count: 1 }] }],
    });

    const result = await searchBooks('resonance', { status: 'published', perPage: 10 }, db);
    expect(result.total).toBe(1);
    expect(result.perPage).toBe(10);

    const pipeline = aggregate.mock.calls[0][0] as Record<string, unknown>[];
    expect(pipeline[0]).toEqual({
      $match: { $text: { $search: 'resonance' }, status: 'published' },
    });
    expect(pipeline[1]).toEqual({ $addFields: { score: { $meta: 'textScore' } } });
    expect(pipeline[2]).toEqual({ $sort: { score: { $meta: 'textScore' } } });
  });

  it('getBookById matches on coerced ObjectId', async () => {
    const { db, aggregate, toArray } = mockDb({
      aggregateResult: [{ _id: '507f1f77bcf86cd799439011', slug: 'x', title: 'X' }],
    });
    const book = await getBookById('507f1f77bcf86cd799439011', {}, db);
    expect(book?.slug).toBe('x');
    expect(aggregate).toHaveBeenCalled();
    const pipeline = aggregate.mock.calls[0][0] as Record<string, unknown>[];
    expect((pipeline[0] as { $match: { _id: unknown } }).$match._id).toBeTruthy();
    expect(toArray).toHaveBeenCalled();
  });
});
