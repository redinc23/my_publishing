/**
 * @jest-environment node
 *
 * Phoenix MCP catalog dual-run (Mongo path mocked).
 */

const mockGetBooks = jest.fn();
const mockSearchBooks = jest.fn();
const mockGetBookById = jest.fn();
const mockPingMongo = jest.fn();
const mockAggregateToArray = jest.fn();

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: jest.fn(() => true),
}));
jest.mock('@/lib/mongo-queries', () => ({
  getBooks: (...args: unknown[]) => mockGetBooks(...args),
  searchBooks: (...args: unknown[]) => mockSearchBooks(...args),
  getBookById: (...args: unknown[]) => mockGetBookById(...args),
}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(async () => ({
    collection: () => ({
      aggregate: () => ({ toArray: mockAggregateToArray }),
    }),
  })),
}));
jest.mock('@/lib/mongodb', () => ({
  pingMongo: (...args: unknown[]) => mockPingMongo(...args),
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => {
    throw new Error('Supabase should not be used when Mongo is primary');
  }),
}));

import { isMongoPrimary } from '@/lib/db/provider';
import {
  mcpGetBook,
  mcpHealth,
  mcpListGenres,
  mcpRecommendBooks,
  mcpSearchBooks,
} from '@/lib/mcp/catalog';

describe('lib/mcp/catalog (mongodb primary)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isMongoPrimary as jest.Mock).mockReturnValue(true);
  });

  it('recommend_books scores and shapes Mongo docs', async () => {
    mockGetBooks.mockResolvedValue({
      items: [
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'Alpha',
          slug: 'alpha',
          status: 'published',
          visibility: 'public',
          avg_rating: 4,
          review_count: 2,
          created_at: new Date(),
          author: { pen_name: 'Ada', _id: 'a1' },
        },
      ],
      total: 1,
    });

    const result = await mcpRecommendBooks({ limit: 5 });
    expect(result.total).toBe(1);
    expect(result.books[0]).toMatchObject({
      id: '507f1f77bcf86cd799439011',
      title: 'Alpha',
      author: { full_name: 'Ada' },
    });
  });

  it('search_books returns empty for blank sanitized query without querying', async () => {
    const result = await mcpSearchBooks('', 10);
    expect(result).toEqual([]);
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('get_book rejects non-public titles', async () => {
    mockGetBookById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      title: 'Secret',
      status: 'published',
      visibility: 'private',
    });
    await expect(mcpGetBook('507f1f77bcf86cd799439011')).rejects.toThrow('Book not found');
  });

  it('list_genres aggregates counts', async () => {
    mockAggregateToArray.mockResolvedValue([
      { _id: 'Fiction', count: 3 },
      { _id: 'Poetry', count: 1 },
    ]);
    await expect(mcpListGenres()).resolves.toEqual({ Fiction: 3, Poetry: 1 });
  });

  it('health reports mongodb provider', async () => {
    mockPingMongo.mockResolvedValue({ ok: true });
    await expect(mcpHealth()).resolves.toEqual({
      status: 'ok',
      db: 'connected',
      provider: 'mongodb',
    });
  });
});
