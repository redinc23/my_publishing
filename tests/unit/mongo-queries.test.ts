/**
 * Unit tests for Phoenix WS2a mongo query library (Task 2a.3).
 * Uses an in-memory collection mock — no live Atlas.
 */

jest.mock('@/lib/server-only-guard', () => ({}));

const aggregateMock = jest.fn();
const findMock = jest.fn();
const countDocumentsMock = jest.fn();
const collectionMock = jest.fn();
const getDbMock = jest.fn();

jest.mock('@/lib/mongodb', () => ({
  getDb: (...args: unknown[]) => getDbMock(...args),
}));

import {
  getBookBySlug,
  getBooks,
  getUserOrders,
  searchBooks,
  __mongoQueryInternals,
} from '@/lib/mongo-queries';

function chainableFind(result: unknown[]) {
  const cursor = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn().mockResolvedValue(result),
  };
  findMock.mockReturnValue(cursor);
  return cursor;
}

function chainableAggregate(result: unknown[]) {
  const cursor = {
    toArray: jest.fn().mockResolvedValue(result),
  };
  aggregateMock.mockReturnValue(cursor);
  return cursor;
}

describe('lib/mongo-queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    collectionMock.mockReturnValue({
      aggregate: aggregateMock,
      find: findMock,
      countDocuments: countDocumentsMock,
    });
    getDbMock.mockResolvedValue({ collection: collectionMock });
  });

  describe('pagination internals', () => {
    it('defaults to page 1 / limit 20', () => {
      expect(__mongoQueryInternals.normalizePagination({})).toEqual({
        page: 1,
        limit: 20,
        skip: 0,
      });
    });

    it('caps limit at MAX_PAGE_SIZE', () => {
      expect(__mongoQueryInternals.normalizePagination({ page: 2, limit: 999 })).toEqual({
        page: 2,
        limit: __mongoQueryInternals.MAX_PAGE_SIZE,
        skip: __mongoQueryInternals.MAX_PAGE_SIZE,
      });
    });
  });

  describe('getBooks', () => {
    it('returns paginated books with author lookup pipeline', async () => {
      const book = {
        title: 'Test',
        slug: 'test',
        author_id: 'a1',
        status: 'published',
        avg_rating: 0,
        review_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
        author: { pen_name: 'Ada' },
      };
      chainableAggregate([{ items: [book], total: [{ count: 1 }] }]);

      const result = await getBooks({ status: 'published', page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(collectionMock).toHaveBeenCalledWith('books');
      expect(aggregateMock).toHaveBeenCalled();
      const pipeline = aggregateMock.mock.calls[0][0];
      expect(pipeline[0]).toEqual({ $match: { status: 'published' } });
      expect(pipeline.some((stage: { $facet?: unknown }) => stage.$facet)).toBe(true);
    });
  });

  describe('getBookBySlug', () => {
    it('returns null for empty slug', async () => {
      expect(await getBookBySlug('  ')).toBeNull();
      expect(getDbMock).not.toHaveBeenCalled();
    });

    it('returns the first aggregate row', async () => {
      const row = { slug: 'mangu', title: 'Mangu', author: { pen_name: 'Faith' } };
      chainableAggregate([row]);
      await expect(getBookBySlug('mangu')).resolves.toEqual(row);
    });

    it('returns null when no match', async () => {
      chainableAggregate([]);
      await expect(getBookBySlug('missing')).resolves.toBeNull();
    });
  });

  describe('getUserOrders', () => {
    it('returns empty page for empty userId without hitting DB', async () => {
      const result = await getUserOrders('');
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(getDbMock).not.toHaveBeenCalled();
    });

    it('queries orders by user_id with pagination', async () => {
      const orders = [
        {
          user_id: 'u1',
          status: 'completed',
          amount: 999,
          currency: 'usd',
          order_items: [{ book_id: 'b1', quantity: 1, unit_amount: 999 }],
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      chainableFind(orders);
      countDocumentsMock.mockResolvedValue(1);

      const result = await getUserOrders('u1', { page: 1, limit: 20 });

      expect(result.items).toEqual(orders);
      expect(result.total).toBe(1);
      expect(collectionMock).toHaveBeenCalledWith('orders');
      expect(findMock).toHaveBeenCalledWith({ user_id: 'u1' });
    });
  });

  describe('searchBooks', () => {
    it('returns empty for blank query', async () => {
      const result = await searchBooks({ query: '   ' });
      expect(result.items).toEqual([]);
      expect(getDbMock).not.toHaveBeenCalled();
    });

    it('uses $text search and score sort', async () => {
      chainableAggregate([{ items: [], total: [] }]);
      await searchBooks({ query: 'resilience', page: 1, limit: 5 });

      const pipeline = aggregateMock.mock.calls[0][0];
      expect(pipeline[0]).toEqual({ $match: { $text: { $search: 'resilience' } } });
      expect(pipeline[1]).toEqual({ $addFields: { score: { $meta: 'textScore' } } });
      expect(pipeline[2]).toEqual({ $sort: { score: -1 } });
    });
  });
});
