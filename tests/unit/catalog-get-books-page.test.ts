/**
 * @jest-environment node
 */

jest.mock('react', () => {
  const actual = jest.requireActual<typeof import('react')>('react');
  return { ...actual, cache: <T>(fn: T) => fn };
});

jest.mock('@/lib/server-only-guard', () => ({}));

const getBooks = jest.fn();
const searchBooks = jest.fn();

jest.mock('@/lib/mongo-queries', () => ({
  getBooks: (...args: unknown[]) => getBooks(...args),
  searchBooks: (...args: unknown[]) => searchBooks(...args),
}));

jest.mock('@/lib/supabase/queries', () => ({
  getBooksPage: jest.fn(async () => [{ id: 'supabase-1', title: 'S', slug: 's' }]),
}));

import { getCatalogBooksPageUncached } from '@/lib/catalog/get-books-page';

describe('getCatalogBooksPageUncached', () => {
  const original = process.env.DATABASE_PROVIDER;

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_PROVIDER;
    else process.env.DATABASE_PROVIDER = original;
    getBooks.mockReset();
    searchBooks.mockReset();
  });

  it('uses Supabase helper by default', async () => {
    delete process.env.DATABASE_PROVIDER;
    const rows = await getCatalogBooksPageUncached({ contentType: 'book' });
    expect(rows[0]?.id).toBe('supabase-1');
  });

  it('maps Mongo books when DATABASE_PROVIDER=mongodb', async () => {
    process.env.DATABASE_PROVIDER = 'mongodb';
    getBooks.mockResolvedValue({
      items: [
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'Mongo Book',
          slug: 'mongo-book',
          author_id: 'a1',
          status: 'published',
          content_type: 'book',
          avg_rating: 4.2,
          review_count: 3,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-02'),
          author: { _id: 'a1', pen_name: 'Ada' },
        },
      ],
      total: 1,
    });

    const rows = await getCatalogBooksPageUncached({ contentType: 'book' });
    expect(getBooks).toHaveBeenCalled();
    expect(rows[0]).toMatchObject({
      id: '507f1f77bcf86cd799439011',
      title: 'Mongo Book',
      slug: 'mongo-book',
      average_rating: 4.2,
      author: { full_name: 'Ada' },
    });
  });
});
