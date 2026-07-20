/**
 * @jest-environment node
 *
 * MCP catalog dual-run (Mongo path) — no live Atlas.
 */

jest.mock('@/lib/server-only-guard', () => ({}));

const getBooks = jest.fn();
const searchBooks = jest.fn();
const getBookById = jest.fn();
const pingMongo = jest.fn();

jest.mock('@/lib/mongo-queries', () => ({
  getBooks: (...args: unknown[]) => getBooks(...args),
  searchBooks: (...args: unknown[]) => searchBooks(...args),
  getBookById: (...args: unknown[]) => getBookById(...args),
}));

jest.mock('@/lib/mongodb', () => ({
  pingMongo: (...args: unknown[]) => pingMongo(...args),
}));

jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(async () => ({
    collection: () => ({
      aggregate: () => ({
        toArray: async () => [{ _id: 'Fiction', count: 3 }],
      }),
    }),
  })),
}));

import {
  mcpGetBook,
  mcpHealth,
  mcpListGenres,
  mcpRecommendBooks,
  mcpSearchBooks,
} from '@/lib/mcp/catalog';

describe('lib/mcp/catalog (mongodb provider)', () => {
  const original = process.env.DATABASE_PROVIDER;

  beforeEach(() => {
    process.env.DATABASE_PROVIDER = 'mongodb';
    getBooks.mockReset();
    searchBooks.mockReset();
    getBookById.mockReset();
    pingMongo.mockReset();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_PROVIDER;
    else process.env.DATABASE_PROVIDER = original;
  });

  it('recommend_books maps mongo docs to MCP envelope', async () => {
    getBooks.mockResolvedValue({
      items: [
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'A',
          slug: 'a',
          avg_rating: 4,
          review_count: 2,
          created_at: new Date(),
          author: { _id: 'a1', pen_name: 'Ada' },
        },
      ],
      total: 1,
    });

    const books = await mcpRecommendBooks({ limit: 5 });
    expect(books).toHaveLength(1);
    expect((books[0] as { title: string }).title).toBe('A');
    expect((books[0] as { author: { full_name: string } }).author.full_name).toBe('Ada');
  });

  it('search_books uses searchBooks helper', async () => {
    searchBooks.mockResolvedValue({
      items: [{ _id: '1', title: 'Hello', description: 'world', author: null }],
      total: 1,
    });
    const data = (await mcpSearchBooks({ query: 'hello', limit: 10 })) as unknown[];
    expect(searchBooks).toHaveBeenCalled();
    expect(data[0]).toMatchObject({ title: 'Hello' });
  });

  it('get_book throws when missing', async () => {
    getBookById.mockResolvedValue(null);
    await expect(mcpGetBook('missing')).rejects.toThrow(/not found/i);
  });

  it('list_genres aggregates counts', async () => {
    const counts = await mcpListGenres();
    expect(counts).toEqual({ Fiction: 3 });
  });

  it('health reports mongodb provider', async () => {
    pingMongo.mockResolvedValue({ ok: true, latency_ms: 12 });
    const health = await mcpHealth();
    expect(health).toEqual({ status: 'ok', db: 'connected', provider: 'mongodb' });
  });
});
