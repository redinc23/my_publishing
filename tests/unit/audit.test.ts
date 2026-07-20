/**
 * @jest-environment node
 *
 * Phoenix 2c.2 — audit writer dual-run.
 */

jest.mock('@/lib/server-only-guard', () => ({}));

const insertOne = jest.fn().mockResolvedValue({ insertedId: 'a1' });
const getDb = jest.fn().mockResolvedValue({
  collection: jest.fn().mockReturnValue({ insertOne }),
});

jest.mock('@/lib/mongo', () => ({
  getDb: (...args: unknown[]) => getDb(...args),
}));

jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: jest.fn(),
}));

const supabaseInsert = jest.fn().mockResolvedValue({ error: null });
jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({ insert: supabaseInsert })),
  })),
}));

import { recordAudit } from '@/lib/audit';
import { isMongoPrimary } from '@/lib/db/provider';

const mockedIsMongo = isMongoPrimary as jest.MockedFunction<typeof isMongoPrimary>;

describe('lib/audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes to Mongo audit_logs when mongo primary', async () => {
    mockedIsMongo.mockReturnValue(true);
    const ok = await recordAudit('actor-1', 'ROLE_CHANGE', 'profile-9', { role: 'author' });
    expect(ok).toBe(true);
    expect(getDb).toHaveBeenCalled();
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'actor-1',
        action: 'ROLE_CHANGE',
        target: 'profile-9',
        metadata: { role: 'author' },
      })
    );
    expect(supabaseInsert).not.toHaveBeenCalled();
  });

  it('writes to Supabase audit_logs when supabase primary', async () => {
    mockedIsMongo.mockReturnValue(false);
    const ok = await recordAudit('actor-1', 'CONTENT_APPROVE', 'ms-1', {
      resource_type: 'manuscript',
    });
    expect(ok).toBe(true);
    expect(supabaseInsert).toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });
});
