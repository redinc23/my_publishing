/**
 * Unit tests for lib/mongo-queries.ts (WS2a.3 / Task 5.1.2 scaffold).
 */

jest.mock('mongodb', () => {
  class MockObjectId {
    private readonly value: string;
    constructor(value?: string) {
      this.value = value ?? '507f1f77bcf86cd799439011';
    }
    toString() {
      return this.value;
    }
    static isValid(id: string) {
      return /^[a-f0-9]{24}$/i.test(id);
    }
  }
  return { ObjectId: MockObjectId };
});

import { getBooks, getBookBySlug, getUserOrders, searchBooks } from '@/lib/mongo-queries';

const mockToArray = jest.fn();
const mockProject = jest.fn(() => ({ toArray: mockToArray }));
const mockSort = jest.fn(() => ({ toArray: mockToArray }));
const mockAggregate = jest.fn(() => ({ toArray: mockToArray }));
const mockFind = jest.fn();
const mockFindOne = jest.fn();
const mockCollection = jest.fn(() => ({
  aggregate: mockAggregate,
  find: mockFind,
  findOne: mockFindOne,
}));

jest.mock('@/lib/mongodb', () => ({
  getDb: jest.fn(async () => ({
    collection: mockCollection,
  })),
}));

describe('lib/mongo-queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToArray.mockResolvedValue([]);
    mockFind.mockReturnValue({
      sort: mockSort,
      project: mockProject,
    });
  });

  it('getBooks runs aggregation with published filter and pagination', async () => {
    const book = { title: 'Test', slug: 'test', avg_rating: 0, review_count: 0 };
    mockToArray.mockResolvedValue([book]);

    const result = await getBooks({ page: 1, limit: 10, sort: 'rating' });

    expect(mockCollection).toHaveBeenCalledWith('books');
    expect(mockAggregate).toHaveBeenCalled();
    const pipeline = mockAggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual(
      expect.objectContaining({
        $match: expect.objectContaining({ status: 'published', visibility: 'public' }),
      })
    );
    expect(pipeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ $skip: 10 }),
        expect.objectContaining({ $limit: 10 }),
      ])
    );
    expect(result).toEqual([book]);
  });

  it('getBookBySlug matches slug and returns first result', async () => {
    const book = { slug: 'my-book', title: 'My Book' };
    mockToArray.mockResolvedValue([book]);

    const result = await getBookBySlug('my-book');

    expect(mockAggregate).toHaveBeenCalled();
    const pipeline = mockAggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({
      $match: { slug: 'my-book', status: 'published', visibility: 'public' },
    });
    expect(result).toEqual(book);
  });

  it('getBookBySlug returns null when no match', async () => {
    mockToArray.mockResolvedValue([]);
    expect(await getBookBySlug('missing')).toBeNull();
  });

  it('getUserOrders returns empty array when profile missing', async () => {
    mockFindOne.mockResolvedValue(null);
    expect(await getUserOrders('auth-user-1')).toEqual([]);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('getUserOrders joins books for order items', async () => {
    const profileId = '507f1f77bcf86cd799439011';
    const bookId = '507f1f77bcf86cd799439012';
    mockFindOne.mockResolvedValue({ _id: profileId, auth_user_id: 'auth-user-1' });
    mockToArray
      .mockResolvedValueOnce([
        {
          user_id: profileId,
          order_items: [{ book_id: bookId, unit_price: 9.99 }],
          total_amount: 9.99,
          currency: 'usd',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          _id: bookId,
          title: 'Joined Book',
          slug: 'joined-book',
          cover_url: 'https://example.com/cover.jpg',
          author_id: '507f1f77bcf86cd799439013',
        },
      ]);

    const orders = await getUserOrders('auth-user-1');

    expect(mockFind).toHaveBeenCalledWith({ user_id: { $in: expect.any(Array) } });
    expect(orders).toHaveLength(1);
    expect(orders[0]?.books?.[0]?.title).toBe('Joined Book');
  });

  it('searchBooks returns empty for blank query', async () => {
    expect(await searchBooks('   ')).toEqual([]);
    expect(mockAggregate).not.toHaveBeenCalled();
  });

  it('searchBooks uses $text match and score sort', async () => {
    mockToArray.mockResolvedValue([{ title: 'Found', score: 1.5 }]);

    await searchBooks('dragon', 5);

    const pipeline = mockAggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual(
      expect.objectContaining({
        $match: expect.objectContaining({
          $text: { $search: 'dragon' },
          status: 'published',
        }),
      })
    );
    expect(pipeline).toEqual(expect.arrayContaining([{ $sort: { score: -1 } }]));
    expect(pipeline).toEqual(expect.arrayContaining([{ $limit: 5 }]));
  });
});
