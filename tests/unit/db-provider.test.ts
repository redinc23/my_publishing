import { getDatabaseProvider, isMongoPrimary } from '@/lib/db/provider';

describe('lib/db/provider', () => {
  const original = process.env.DATABASE_PROVIDER;

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_PROVIDER;
    else process.env.DATABASE_PROVIDER = original;
  });

  it('defaults to supabase', () => {
    delete process.env.DATABASE_PROVIDER;
    expect(getDatabaseProvider()).toBe('supabase');
    expect(isMongoPrimary()).toBe(false);
  });

  it('honors mongodb', () => {
    process.env.DATABASE_PROVIDER = 'mongodb';
    expect(getDatabaseProvider()).toBe('mongodb');
    expect(isMongoPrimary()).toBe(true);
  });

  it('accepts mongo alias', () => {
    process.env.DATABASE_PROVIDER = 'mongo';
    expect(getDatabaseProvider()).toBe('mongodb');
  });
});
