
import { getFeaturedBooks } from '../../lib/supabase/queries';
import { createClient } from '../../lib/supabase/admin';
import { unstable_cache } from 'next/cache';

// Mock dependencies
jest.mock('../../lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  unstable_cache: jest.fn((callback) => callback),
  revalidateTag: jest.fn(),
}));

describe('getFeaturedBooks Optimization', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((callback) => {
        // Mock resolved value
        return Promise.resolve({ data: [{ id: 1, title: 'Test Book' }], error: null }).then(callback);
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('should use unstable_cache for caching', async () => {
    // Before implementation, this test might fail or pass depending on how I mock unstable_cache vs original function.
    // However, the goal is to verify that AFTER implementation, it calls unstable_cache.

    // Call the function
    await getFeaturedBooks();

    // Verify unstable_cache was called
    expect(unstable_cache).toHaveBeenCalled();

    // Verify the cache key and tags
    const cacheCall = (unstable_cache as jest.Mock).mock.calls[0];
    expect(cacheCall[1]).toContain('featured-books');
    expect(cacheCall[2]).toEqual(expect.objectContaining({
      tags: ['featured-books'],
    }));
  });

  it('should create admin client inside the cached function', async () => {
    // We need to execute the callback passed to unstable_cache to verify logic
    // Since we mocked unstable_cache to return callback, calling getFeaturedBooks executes it.

    await getFeaturedBooks();

    expect(createClient).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('books');
    expect(mockSupabase.select).toHaveBeenCalled();
    expect(mockSupabase.eq).toHaveBeenCalledWith('is_featured', true);
  });
});
