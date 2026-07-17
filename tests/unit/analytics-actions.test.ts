/** @jest-environment node */

import { getBookAnalytics, getLiveReaders } from '@/lib/actions/analytics';
import { getBookRevenue } from '@/lib/actions/revenue';
import { createClient } from '@/lib/supabase/server';
import { requireAuthorOwnedBook } from '@/lib/supabase/author-ownership';
import { getCache, setCache } from '@/lib/services/cache-service';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/supabase/author-ownership', () => ({
  requireAuthorOwnedBook: jest.fn(),
}));

jest.mock('@/lib/services/cache-service', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
}));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedRequireAuthorOwnedBook = requireAuthorOwnedBook as jest.MockedFunction<
  typeof requireAuthorOwnedBook
>;
const mockedGetCache = getCache as jest.MockedFunction<typeof getCache>;

function mockAuthedClient(fromImpl?: (table: string) => unknown) {
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'auth-user-1' } } }),
    },
    from: jest.fn((table: string) => fromImpl?.(table)),
  } as never);
}

describe('analytics and revenue ownership actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCache.mockResolvedValue(null);
  });

  it('getBookAnalytics resolves ownership via requireAuthorOwnedBook', async () => {
    mockedRequireAuthorOwnedBook.mockResolvedValue({
      author: { id: 'author-1' },
      book: { id: 'book-1', author_id: 'author-1' },
    } as never);

    const statsChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [{ book_id: 'book-1', views: 3 }], error: null }),
    };
    mockAuthedClient((table) => (table === 'book_stats_daily' ? statsChain : null));

    const result = await getBookAnalytics('book-1', {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });

    expect(mockedRequireAuthorOwnedBook).toHaveBeenCalledWith('auth-user-1', 'book-1');
    expect(result).toEqual([{ book_id: 'book-1', views: 3 }]);
    expect(setCache).toHaveBeenCalled();
  });

  it('getBookRevenue uses author ownership before querying sales', async () => {
    mockedRequireAuthorOwnedBook.mockResolvedValue({
      author: { id: 'author-1' },
      book: { id: 'book-1', author_id: 'author-1' },
    } as never);

    const salesChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [{ author_earnings: 250 }],
        error: null,
      }),
    };
    mockAuthedClient((table) => (table === 'book_sales' ? salesChain : null));

    const result = await getBookRevenue('book-1', {});

    expect(mockedRequireAuthorOwnedBook).toHaveBeenCalledWith('auth-user-1', 'book-1');
    expect(result.total).toBe(2.5);
  });

  it('getLiveReaders joins public_profiles instead of users and checks ownership', async () => {
    mockedRequireAuthorOwnedBook.mockResolvedValue({
      author: { id: 'author-1' },
      book: { id: 'book-1', author_id: 'author-1' },
    } as never);

    const sessions = [
      {
        session_id: 'sess-1',
        user_id: 'auth-reader-1',
        book_id: 'book-1',
        is_active: true,
        max_progress: 42,
        last_activity_at: new Date().toISOString(),
      },
    ];

    const sessionsChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: sessions, error: null }),
    };
    const profilesChain = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [{ user_id: 'auth-reader-1', name: 'Reader One' }],
        error: null,
      }),
    };

    mockAuthedClient((table) => {
      if (table === 'analytics_sessions') return sessionsChain;
      if (table === 'public_profiles') return profilesChain;
      return null;
    });

    const result = await getLiveReaders('book-1');

    expect(mockedRequireAuthorOwnedBook).toHaveBeenCalledWith('auth-user-1', 'book-1');
    expect(sessionsChain.select).toHaveBeenCalledWith('*');
    expect(profilesChain.select).toHaveBeenCalledWith('user_id, name');
    expect(result.total).toBe(1);
    expect(result.readers[0]?.user).toEqual({ name: 'Reader One' });
    expect(result.readers[0]?.reading_progress).toBe(42);
  });

  it('getLiveReaders returns empty when ownership fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedRequireAuthorOwnedBook.mockRejectedValue(new Error('Unauthorized'));
    mockAuthedClient();

    await expect(getLiveReaders('book-1')).resolves.toEqual({ readers: [], total: 0 });
    errorSpy.mockRestore();
  });
});
