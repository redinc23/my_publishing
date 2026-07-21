/**
 * Mongo profile updates — Phoenix 2c.1.3.
 */

import '@/lib/server-only-guard';

import type { Db, Document } from 'mongodb';
import { getDb } from '@/lib/mongo';
import type { Profile } from '@/types/mongo';

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

export type UpdateProfileMongoInput = Partial<{
  display_name: string;
  bio: string;
  avatar_url: string;
  email: string;
}>;

export async function updateProfileMongo(
  authUserId: string,
  patch: UpdateProfileMongoInput,
  db?: Db
): Promise<{ profile: Profile } | { error: string; code: string }> {
  const database = await resolveDb(db);
  const $set: Document = { updated_at: new Date() };
  for (const key of ['display_name', 'bio', 'avatar_url', 'email'] as const) {
    if (patch[key] !== undefined) $set[key] = patch[key];
  }

  const result = await database
    .collection('profiles')
    .findOneAndUpdate({ auth_user_id: authUserId }, { $set }, { returnDocument: 'after' });

  const profile = result as Profile | null;
  if (!profile?._id) {
    return { error: 'Profile not found', code: 'NOT_FOUND' };
  }
  return { profile };
}
