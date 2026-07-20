/**
 * @jest-environment node
 */

jest.mock('@/lib/server-only-guard', () => ({}));

const insertOne = jest.fn();
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(async () => ({
    collection: () => ({ insertOne }),
  })),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    from: () => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
    }),
  })),
}));

import { recordAudit } from '@/lib/audit';

describe('recordAudit', () => {
  const original = process.env.DATABASE_PROVIDER;

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_PROVIDER;
    else process.env.DATABASE_PROVIDER = original;
    insertOne.mockReset();
  });

  it('writes to Mongo audit_logs when DATABASE_PROVIDER=mongodb', async () => {
    process.env.DATABASE_PROVIDER = 'mongodb';
    insertOne.mockResolvedValue({ insertedId: 'x' });

    await recordAudit('actor-1', 'user.role_change', 'profile-9', { role: 'author' });

    expect(insertOne).toHaveBeenCalledTimes(1);
    const doc = insertOne.mock.calls[0][0];
    expect(doc.actor_id).toBe('actor-1');
    expect(doc.action).toBe('user.role_change');
    expect(doc.target).toBe('profile-9');
    expect(doc.metadata).toEqual({ role: 'author' });
    expect(doc.created_at).toBeInstanceOf(Date);
  });
});
