import { createClient } from '@/lib/supabase/server';
import { getUserLibrary } from '@/lib/actions/books';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('getUserLibrary', () => {
  it('returns unauthorized if no user', async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const result = await getUserLibrary();
    expect(result.success).toBe(false);
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('fetches user library successfully', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooks = [
        { id: 'book-1', title: 'Book 1' }
    ];
    const mockOrders = [
        {
            id: 'order-1',
            order_items: [
                {
                    books: mockBooks[0]
                }
            ]
        }
    ];

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: mockOrders, error: null }),
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const result = await getUserLibrary();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].title).toBe('Book 1');
  });
});
