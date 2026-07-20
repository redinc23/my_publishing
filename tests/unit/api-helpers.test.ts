/**
 * Unit tests for dual-run API helpers (no Better Auth import).
 */

import { canMutateCatalog } from '@/lib/auth/roles';
import { serializeMongo, slugifyTitle } from '@/lib/api/serialize-mongo';

describe('canMutateCatalog', () => {
  it('allows author and admin to mutate catalog', () => {
    expect(canMutateCatalog('author')).toBe(true);
    expect(canMutateCatalog('admin')).toBe(true);
    expect(canMutateCatalog('reader')).toBe(false);
    expect(canMutateCatalog('partner')).toBe(false);
  });
});

describe('lib/api/serialize-mongo', () => {
  it('slugifies titles', () => {
    expect(slugifyTitle('Hello World!')).toBe('hello-world');
  });

  it('serializes nested ObjectId-like and Date values', () => {
    const oid = { _bsontype: 'ObjectId', toString: () => 'abc123' };
    const out = serializeMongo({
      _id: oid,
      created_at: new Date('2026-01-02T00:00:00.000Z'),
      nested: { ids: [oid] },
    }) as Record<string, unknown>;

    expect(out._id).toBe('abc123');
    expect(out.created_at).toBe('2026-01-02T00:00:00.000Z');
    expect((out.nested as { ids: string[] }).ids[0]).toBe('abc123');
  });
});
