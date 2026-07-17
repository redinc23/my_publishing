/** @jest-environment node */

import {
  clampPage,
  getPartnerPortalData,
  getPartnerOrder,
  normalizeArcStatusFilter,
  PartnerDataUnavailableError,
} from '@/app/(portals)/partner/_lib/partner-data';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getPartnerForUser } from '@/lib/supabase/portal-queries';

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/supabase/portal-queries', () => ({
  getPartnerForUser: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

function makeListChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: undefined as unknown,
  };
  // Make the chain thenable so await works on the final builder
  Object.assign(chain, {
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  });
  return chain;
}

function makeSingleChain(result: { data: unknown; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
}

describe('partner portal helpers', () => {
  it('normalizes denied ARC filter alias to rejected', () => {
    expect(normalizeArcStatusFilter('denied')).toBe('rejected');
    expect(normalizeArcStatusFilter('rejected')).toBe('rejected');
    expect(normalizeArcStatusFilter('all')).toBe('all');
    expect(normalizeArcStatusFilter(undefined)).toBe('all');
  });

  it('clamps page before slicing bounds', () => {
    expect(clampPage(1, 3)).toBe(1);
    expect(clampPage(3, 3)).toBe(3);
    expect(clampPage(99, 3)).toBe(3);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(NaN, 3)).toBe(1);
    expect(clampPage(2, 0)).toBe(1);

    const items = ['a', 'b', 'c', 'd', 'e'];
    const pageSize = 2;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const page = clampPage(99, totalPages);
    expect(items.slice((page - 1) * pageSize, page * pageSize)).toEqual(['e']);
  });
});

describe('getPartnerPortalData error honesty', () => {
  const partner = {
    id: 'partner-1',
    profile_id: 'profile-1',
    institution_name: 'Library',
    subscription_plan: 'basic',
    created_at: null,
    updated_at: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const server = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'auth-1' } } }),
      },
      from: jest.fn(() =>
        makeSingleChain({ data: { role: 'partner' }, error: null })
      ),
    };
    (createServerClient as jest.Mock).mockResolvedValue(server);
    (getPartnerForUser as jest.Mock).mockResolvedValue(partner);
  });

  it('throws PartnerDataUnavailableError when a portal query fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const ok = makeListChain({ data: [], error: null });
    const fail = makeListChain({ data: null, error: { message: 'db down' } });
    const admin = {
      from: jest.fn((table: string) => {
        if (table === 'books') return ok;
        if (table === 'arc_requests') return fail;
        return ok;
      }),
    };
    (createAdminClient as jest.Mock).mockReturnValue(admin);

    await expect(getPartnerPortalData()).rejects.toBeInstanceOf(PartnerDataUnavailableError);
    spy.mockRestore();
  });

  it('returns data when all portal queries succeed', async () => {
    const books = makeListChain({
      data: [{ id: 'b1', title: 'Book', slug: 'book', genre: 'Fiction' }],
      error: null,
    });
    const arcs = makeListChain({ data: [], error: null });
    const orders = makeListChain({ data: [], error: null });
    const admin = {
      from: jest.fn((table: string) => {
        if (table === 'books') return books;
        if (table === 'arc_requests') return arcs;
        return orders;
      }),
    };
    (createAdminClient as jest.Mock).mockReturnValue(admin);

    await expect(getPartnerPortalData()).resolves.toMatchObject({
      partner,
      catalogBooks: [{ id: 'b1' }],
      arcRequests: [],
      orders: [],
    });
  });

  it('tenant-scopes every service-role portal query', async () => {
    const books = makeListChain({ data: [], error: null });
    const arcs = makeListChain({ data: [], error: null });
    const orders = makeListChain({ data: [], error: null });
    const admin = {
      from: jest.fn((table: string) => {
        if (table === 'books') return books;
        if (table === 'arc_requests') return arcs;
        return orders;
      }),
    };
    (createAdminClient as jest.Mock).mockReturnValue(admin);

    await getPartnerPortalData();

    // The service-role client bypasses RLS, so these filters ARE the tenant
    // isolation. ARC requests must be scoped to the partner row id, and
    // orders to the partner's profile id.
    expect(arcs.eq).toHaveBeenCalledWith('partner_id', partner.id);
    expect(orders.eq).toHaveBeenCalledWith('user_id', partner.profile_id);

    // No unscoped variants slipped in (e.g. filtering by the wrong tenant key).
    expect(arcs.eq.mock.calls).toEqual([['partner_id', partner.id]]);
    expect(orders.eq.mock.calls).toEqual([['user_id', partner.profile_id]]);

    // Catalog is intentionally global but must stay limited to public books.
    expect(books.eq).toHaveBeenCalledWith('status', 'published');
    expect(books.eq).toHaveBeenCalledWith('visibility', 'public');
  });
});

describe('getPartnerOrder error honesty', () => {
  const partner = {
    id: 'partner-1',
    profile_id: 'profile-1',
    institution_name: 'Library',
    subscription_plan: 'basic',
    created_at: null,
    updated_at: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const server = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'auth-1' } } }),
      },
      from: jest.fn(() =>
        makeSingleChain({ data: { role: 'partner' }, error: null })
      ),
    };
    (createServerClient as jest.Mock).mockResolvedValue(server);
    (getPartnerForUser as jest.Mock).mockResolvedValue(partner);
  });

  it('returns null order for missing row without treating it as unavailable', async () => {
    const admin = {
      from: jest.fn(() =>
        makeSingleChain({ data: null, error: { code: 'PGRST116', message: 'not found' } })
      ),
    };
    (createAdminClient as jest.Mock).mockReturnValue(admin);

    await expect(getPartnerOrder('missing')).resolves.toEqual({ partner, order: null });
  });

  it('scopes the service-role order lookup to the partner profile', async () => {
    const chain = makeSingleChain({
      data: { id: 'order-1', items: [] },
      error: null,
    });
    const admin = { from: jest.fn(() => chain) };
    (createAdminClient as jest.Mock).mockReturnValue(admin);

    await getPartnerOrder('order-1');

    // Service-role query: without the user_id filter, any partner could read
    // any order by guessing its id.
    expect(admin.from).toHaveBeenCalledWith('orders');
    expect(chain.eq.mock.calls).toEqual([
      ['id', 'order-1'],
      ['user_id', partner.profile_id],
    ]);
  });

  it('throws when order detail query fails for non-404 reasons', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const admin = {
      from: jest.fn(() =>
        makeSingleChain({ data: null, error: { code: '500', message: 'db down' } })
      ),
    };
    (createAdminClient as jest.Mock).mockReturnValue(admin);

    await expect(getPartnerOrder('order-1')).rejects.toBeInstanceOf(PartnerDataUnavailableError);
    spy.mockRestore();
  });
});
