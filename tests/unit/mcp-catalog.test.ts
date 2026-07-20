/** @jest-environment node */

/**
 * MCP catalog dual-run layer — unit tests (mocked providers; no live DB).
 */

jest.mock('@/lib/server-only-guard', () => ({}));

const mockGetBooks = jest.fn();
const mockGetBookById = jest.fn();
const mockSearchBooks = jest.fn();
const mockListGenreCounts = jest.fn();

jest.mock('@/lib/mongo-queries', () => ({
  getBooks: (...args: unknown[]) => mockGetBooks(...args),
  getBookById: (...args: unknown[]) => mockGetBookById(...args),
  searchBooks: (...args: unknown[]) => mockSearchBooks(...args),
  listGenreCounts: (...args: unknown[]) => mockListGenreCounts(...args),
}));

jest.mock('@/lib/db/provider', () => ({
  getDatabaseProvider: jest.fn(() => 'mongodb'),
}));

import { getDatabaseProvider } from '@/lib/db/provider';
import {
  checkCatalogHealth,
  getBookDetails,
  isMcpBookId,
  listPublishedGenres,
  recommendBooks,
  searchPublishedBooks,
} from '@/lib/mcp/catalog';

const mockedProvider = getDatabaseProvider as jest.MockedFunction<typeof getDatabaseProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedProvider.mockReturnValue('mongodb');
});

describe('isMcpBookId', () => {
  it('accepts UUIDs and ObjectId hex', () => {
    expect(isMcpBookId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isMcpBookId('507f1f77bcf86cd799439011')).toBe(true);
    expect(isMcpBookId('not-an-id')).toBe(false);
    expect(isMcpBookId('')).toBe(false);
  });
});

describe('MCP catalog (mongodb provider)', () => {
  it('recommendBooks scores and respects excludes + similar_to seed', async () => {
    mockGetBookById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      title: 'Seed',
      genre: 'Fantasy',
      slug: 'seed',
      author_id: 'a1',
      status: 'published',
      visibility: 'public',
      avg_rating: 4,
      review_count: 2,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    });
    mockGetBooks.mockResolvedValue({
      items: [
        {
          _id: '507f1f77bcf86cd799439012',
          title: 'Keep',
          genre: 'Fantasy',
          slug: 'keep',
          author_id: 'a1',
          status: 'published',
          visibility: 'public',
          avg_rating: 5,
          review_count: 10,
          created_at: new Date(),
          updated_at: new Date(),
          author: { _id: 'a1', pen_name: 'Ada', photo_url: null },
        },
        {
          _id: '507f1f77bcf86cd799439013',
          title: 'Exclude me',
          genre: 'Fantasy',
          slug: 'exclude',
          author_id: 'a1',
          status: 'published',
          visibility: 'public',
          avg_rating: 1,
          review_count: 0,
          created_at: new Date('2020-01-01'),
          updated_at: new Date('2020-01-01'),
        },
      ],
      total: 2,
      page: 1,
      perPage: 40,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    const result = await recommendBooks({
      limit: 10,
      similar_to_book_id: '507f1f77bcf86cd799439011',
      exclude_book_ids: ['507f1f77bcf86cd799439013'],
    });

    expect(mockGetBookById).toHaveBeenCalled();
    expect(mockGetBooks).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published', visibility: 'public', genre: 'Fantasy' }),
      expect.any(Object)
    );
    expect(result.books).toHaveLength(1);
    expect(result.books[0].title).toBe('Keep');
    expect(result.books[0].author?.full_name).toBe('Ada');
  });

  it('searchPublishedBooks returns [] for empty query', async () => {
    await expect(searchPublishedBooks('', 5)).resolves.toEqual([]);
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('getBookDetails maps mongo docs to MCP shape', async () => {
    mockGetBookById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      title: 'Mapped',
      slug: 'mapped',
      description: 'd',
      genre: 'Sci-Fi',
      author_id: 'a1',
      status: 'published',
      visibility: 'public',
      avg_rating: 4.5,
      review_count: 3,
      created_at: new Date('2026-06-01T00:00:00.000Z'),
      updated_at: new Date('2026-06-01T00:00:00.000Z'),
      author: { _id: 'a1', pen_name: 'Bee', photo_url: '/x.png' },
    });

    const book = await getBookDetails('507f1f77bcf86cd799439011');
    expect(book).toMatchObject({
      id: '507f1f77bcf86cd799439011',
      title: 'Mapped',
      genre: 'Sci-Fi',
      avg_rating: 4.5,
      author: { full_name: 'Bee' },
    });
  });

  it('listPublishedGenres delegates to listGenreCounts', async () => {
    mockListGenreCounts.mockResolvedValue({ Fantasy: 3 });
    await expect(listPublishedGenres()).resolves.toEqual({ Fantasy: 3 });
    expect(mockListGenreCounts).toHaveBeenCalledWith({
      status: 'published',
      visibility: 'public',
    });
  });

  it('checkCatalogHealth reports mongodb provider', async () => {
    mockGetBooks.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      perPage: 1,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
    const health = await checkCatalogHealth();
    expect(health.provider).toBe('mongodb');
    expect(health.status).toBe('ok');
  });
});
