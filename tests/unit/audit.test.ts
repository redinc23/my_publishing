/**
 * @jest-environment node
 */

const mockInsertOne = jest.fn();
const mockIsMongoPrimary = jest.fn(() => true);

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: () => mockIsMongoPrimary(),
}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(async () => ({
    collection: () => ({ insertOne: mockInsertOne }),
  })),
}));
jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

import { recordAudit } from '@/lib/audit';

describe('lib/audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMongoPrimary.mockReturnValue(true);
    mockInsertOne.mockResolvedValue({ insertedId: 'a1' });
  });

  it('inserts audit_logs document on Mongo primary', async () => {
    const result = await recordAudit('actor-1', 'user.role_change', 'profile-9', {
      role: 'author',
    });
    expect(result).toEqual({ ok: true });
    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'actor-1',
        action: 'user.role_change',
        target: 'profile-9',
        metadata: { role: 'author' },
      })
    );
  });

  it('rejects empty action/target', async () => {
    await expect(recordAudit('a', '  ', 't')).resolves.toEqual({
      ok: false,
      error: 'actorId, action, and target are required',
    });
    expect(mockInsertOne).not.toHaveBeenCalled();
  });
});
