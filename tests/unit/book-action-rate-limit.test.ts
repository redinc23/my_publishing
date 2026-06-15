import { createBook } from '@/lib/actions/books';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

function createTableMock() {
  const insertResult = {
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'book-1',
          title: 'Launch Book',
          slug: 'launch-book',
        },
        error: null,
      }),
    }),
  };

  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockReturnValue(insertResult),
  };
}

describe('book action rate limiting', () => {
  const mockGetUser = jest.fn();
  const mockFrom = jest.fn();
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'author-rate-limit-test',
          email: 'author@example.com',
          user_metadata: { full_name: 'Test Author' },
        },
      },
      error: null,
    });

    mockFrom.mockImplementation(() => createTableMock());

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  it('rejects the eleventh create request in the one-minute window', async () => {
    for (let i = 0; i < 10; i += 1) {
      const result = await createBook({ title: `Launch Book ${i}` });
      expect(result.success).toBe(true);
    }

    const blocked = await createBook({ title: 'Launch Book 11' });

    expect(blocked).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        code: 'UNKNOWN_ERROR',
      })
    );
  });
});
