/** @jest-environment node */

import { updateBookAdmin } from '@/lib/actions/books';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { firstQueryError } from '@/app/admin/_lib/query-error';

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

jest.mock('@/lib/supabase/queries', () => ({
  revalidateBooks: jest.fn(),
}));

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select',
    'eq',
    'neq',
    'is',
    'update',
    'insert',
    'single',
    'maybeSingle',
  ];
  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  return chain;
}

describe('firstQueryError', () => {
  it('returns null when all queries succeed', () => {
    expect(firstQueryError([{ error: null }, { error: null }])).toBeNull();
  });

  it('surfaces the first query error message', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(
      firstQueryError([{ error: null }, { error: { message: 'timeout' } }])
    ).toBe('timeout');
    spy.mockRestore();
  });
});

describe('updateBookAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates books through the admin/service client after role check', async () => {
    const profileChain = makeChain({ data: { role: 'admin' }, error: null });
    const auditChain = makeChain({ data: null, error: null });
    auditChain.insert = jest.fn().mockResolvedValue({ data: null, error: null });

    const server = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-user' } }, error: null }),
      },
      from: jest.fn((table: string) => {
        if (table === 'profiles') return profileChain;
        if (table === 'audit_logs') return auditChain;
        return profileChain;
      }),
    };

    const booksChain = makeChain({ data: { id: 'book-1', deleted_at: null }, error: null });
    booksChain.single = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: 'book-1', deleted_at: null }, error: null })
      .mockResolvedValueOnce({
        data: { id: 'book-1', slug: 'updated-title', title: 'Updated' },
        error: null,
      });

    const admin = {
      from: jest.fn((table: string) => {
        if (table === 'books') return booksChain;
        return booksChain;
      }),
    };

    (createServerClient as jest.Mock).mockResolvedValue(server);
    (createAdminClient as jest.Mock).mockReturnValue(admin);

    const result = await updateBookAdmin('book-1', { title: 'Updated' });

    // The role gate must look up profiles by user_id (the auth uid), not by
    // profiles.id (a separate UUID). Filtering on the wrong column would match
    // no rows — or worse, an attacker-controlled row.
    expect(server.from).toHaveBeenCalledWith('profiles');
    expect(profileChain.select).toHaveBeenCalledWith('role');
    expect(profileChain.eq).toHaveBeenCalledWith('user_id', 'admin-user');
    expect(profileChain.eq).not.toHaveBeenCalledWith('id', expect.anything());

    expect(createAdminClient).toHaveBeenCalled();
    expect(admin.from).toHaveBeenCalledWith('books');
    expect(booksChain.update).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.code).toBe('BOOK_UPDATED');
  });

  it('rejects non-admin callers without using the admin client for updates', async () => {
    const profileChain = makeChain({ data: { role: 'reader' }, error: null });
    const server = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'reader-1' } }, error: null }),
      },
      from: jest.fn(() => profileChain),
    };
    (createServerClient as jest.Mock).mockResolvedValue(server);

    const result = await updateBookAdmin('book-1', { title: 'Nope' });

    expect(result).toEqual({
      success: false,
      error: 'Admin access required',
      code: 'FORBIDDEN',
    });
    expect(profileChain.eq).toHaveBeenCalledWith('user_id', 'reader-1');
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
