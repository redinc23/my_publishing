/**
 * @jest-environment node
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(),
}));
jest.mock('@/lib/mongo-queries', () => ({
  getBooks: jest.fn(),
  searchBooks: jest.fn(),
}));
jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: jest.fn(() => false),
}));

import { __scoreBookForTests } from '@/lib/mcp/catalog';

describe('lib/mcp/catalog scoring', () => {
  it('ranks books with purchases and ratings higher', () => {
    const low = __scoreBookForTests({
      id: '1',
      title: 'A',
      created_at: new Date().toISOString(),
      stats: { total_views: 1, total_purchases: 0, avg_rating: 0 },
    });
    const high = __scoreBookForTests({
      id: '2',
      title: 'B',
      created_at: new Date().toISOString(),
      stats: { total_views: 1, total_purchases: 5, avg_rating: 4 },
    });
    expect(high).toBeGreaterThan(low);
  });
});
