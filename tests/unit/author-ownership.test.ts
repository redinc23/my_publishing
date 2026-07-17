/** @jest-environment node */

import { requireAuthorOwnedBook } from '@/lib/supabase/author-ownership';
import { getAuthorForUser } from '@/lib/supabase/portal-queries';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

jest.mock('@/lib/supabase/portal-queries', () => ({
  getAuthorForUser: jest.fn(),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

const mockedGetAuthorForUser = getAuthorForUser as jest.MockedFunction<typeof getAuthorForUser>;
const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

describe('requireAuthorOwnedBook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts when books.author_id matches the resolved authors.id', async () => {
    mockedGetAuthorForUser.mockResolvedValue({ id: 'author-1' } as never);
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'book-1', author_id: 'author-1' },
        error: null,
      }),
    };
    mockedCreateAdminClient.mockReturnValue({ from: jest.fn(() => chain) } as never);

    await expect(requireAuthorOwnedBook('auth-user-1', 'book-1')).resolves.toEqual({
      author: { id: 'author-1' },
      book: { id: 'book-1', author_id: 'author-1' },
    });

    expect(mockedGetAuthorForUser).toHaveBeenCalledWith('auth-user-1');
    expect(chain.eq).toHaveBeenCalledWith('id', 'book-1');
  });

  it('rejects when auth.users.id is compared incorrectly via mismatched author row', async () => {
    mockedGetAuthorForUser.mockResolvedValue({ id: 'author-1' } as never);
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'book-1', author_id: 'auth-user-1' },
        error: null,
      }),
    };
    mockedCreateAdminClient.mockReturnValue({ from: jest.fn(() => chain) } as never);

    await expect(requireAuthorOwnedBook('auth-user-1', 'book-1')).rejects.toThrow('Unauthorized');
  });

  it('rejects when the caller has no author profile', async () => {
    mockedGetAuthorForUser.mockResolvedValue(null);
    mockedCreateAdminClient.mockReturnValue({ from: jest.fn() } as never);

    await expect(requireAuthorOwnedBook('reader-1', 'book-1')).rejects.toThrow('Unauthorized');
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });
});
