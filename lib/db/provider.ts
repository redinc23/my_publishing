/**
 * Data-platform provider switch (ADR-002).
 *
 * DATABASE_PROVIDER=mongodb|supabase
 * Default remains supabase until mongo-up sets mongodb in .env.local.
 */

export type DatabaseProvider = 'mongodb' | 'supabase';

export function getDatabaseProvider(): DatabaseProvider {
  const raw = (process.env.DATABASE_PROVIDER || 'supabase').toLowerCase();
  if (raw === 'mongodb' || raw === 'mongo') return 'mongodb';
  return 'supabase';
}

export function isMongoPrimary(): boolean {
  return getDatabaseProvider() === 'mongodb';
}
