/** @jest-environment node */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: jest.fn(() => false),
  getDatabaseProvider: jest.fn(() => 'supabase'),
}));
jest.mock('@/lib/mongo', () => ({
  pingMongo: jest.fn(),
}));
jest.mock('@/lib/mongo-queries', () => ({
  getBooks: jest.fn(),
  getBookById: jest.fn(),
  searchBooks: jest.fn(),
  listGenreCounts: jest.fn(),
}));

import { isMongoPrimary } from '@/lib/db/provider';
import { pingMongo } from '@/lib/mongo';
import { getBookById, getBooks, listGenreCounts, searchBooks } from '@/lib/mongo-queries';
import {
  mcpCatalogHealth,
  mcpGetBook,
  mcpListGenres,
  mcpRecommendBooks,
  mcpSearchBooks,
} from '@/lib/mcp/catalog';

const mockedIsMongo = isMongoPrimary as jest.MockedFunction<typeof isMongoPrimary>;
const mockedGetBooks = getBooks as jest.MockedFunction<typeof getBooks>;
const mockedGetBookById = getBookById as jest.MockedFunction<typeof getBookById>;
const mockedSearch = searchBooks as jest.MockedFunction<typeof searchBooks>;
const mockedGenres = listGenreCounts as jest.MockedFunction<typeof listGenreCounts>;
const mockedPing = pingMongo as jest.MockedFunction<typeof pingMongo>;

describe('lib/mcp/catalog (Mongo path)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsMongo.mockReturnValue(true);
  });

  it('recommend_books ranks and excludes ids', async () => {
    mockedGetBooks.mockResolvedValue({
      items: [
        {
          _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' as never,
          title: 'A',
          slug: 'a',
          author_id: 'x',
          status: 'published',
          visibility: 'public',
          avg_rating: 5,
          review_count: 10,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          _id: 'bbbbbbbbbbbbbbbbbbbbbbbb' as never,
          title: 'B',
          slug: 'b',
          author_id: 'x',
          status: 'published',
          visibility: 'public',
          avg_rating: 1,
          review_count: 0,
          created_at: new Date(Date.now() - 40 * 86_400_000),
          updated_at: new Date(),
        },
      ],
      total: 2,
      page: 1,
      perPage: 30,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    const result = await mcpRecommendBooks({
      limit: 10,
      exclude_book_ids: ['bbbbbbbbbbbbbbbbbbbbbbbb'],
    });

    expect(result.total).toBe(1);
    expect((result.books[0] as { id: string }).id).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('search_books returns empty for unsafe/blank after sanitize', async () => {
    const result = await mcpSearchBooks({ query: '   ', limit: 5 });
    expect(result).toEqual([]);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it('get_book throws when missing or private', async () => {
    mockedGetBookById.mockResolvedValue(null);
    await expect(mcpGetBook('aaaaaaaaaaaaaaaaaaaaaaaa')).rejects.toThrow(/not found/i);

    mockedGetBookById.mockResolvedValue({
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' as never,
      title: 'Hidden',
      slug: 'h',
      author_id: 'x',
      status: 'published',
      visibility: 'private',
      avg_rating: 0,
      review_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await expect(mcpGetBook('aaaaaaaaaaaaaaaaaaaaaaaa')).rejects.toThrow(/not found/i);
  });

  it('list_genres delegates to listGenreCounts', async () => {
    mockedGenres.mockResolvedValue({ Fantasy: 3 });
    await expect(mcpListGenres()).resolves.toEqual({ Fantasy: 3 });
    expect(mockedGenres).toHaveBeenCalledWith({
      status: 'published',
      visibility: 'public',
    });
  });

  it('health reports mongodb provider', async () => {
    mockedPing.mockResolvedValue({ ok: true, latency_ms: 1 });
    const health = await mcpCatalogHealth();
    expect(health).toEqual({ status: 'ok', db: 'connected', provider: 'mongodb' });
  });

  it('health degrades when mongo ping fails', async () => {
    mockedPing.mockResolvedValue({ ok: false, latency_ms: 2, message: 'paused' });
    const health = await mcpCatalogHealth();
    expect(health).toEqual({ status: 'degraded', db: 'paused', provider: 'mongodb' });
  });
});
