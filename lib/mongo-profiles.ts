/**
 * Mongo profile updates (Phoenix 2c.1.3).
 */

import '@/lib/server-only-guard';

import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongo';
import type { Profile } from '@/types/mongo';

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

export type UpdateMongoProfileInput = {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
};

export async function updateMongoProfileByAuthUserId(
  authUserId: string,
  updates: UpdateMongoProfileInput,
  db?: Db
): Promise<Profile | null> {
  const database = await resolveDb(db);
  const $set: Record<string, unknown> = { updated_at: new Date() };
  if (updates.display_name !== undefined) $set.display_name = updates.display_name;
  if (updates.bio !== undefined) $set.bio = updates.bio;
  if (updates.avatar_url !== undefined) $set.avatar_url = updates.avatar_url;

  const result = await database.collection('profiles').findOneAndUpdate(
    { auth_user_id: authUserId },
    { $set },
    { returnDocument: 'after' }
  );

  return (result as Profile | null) ?? null;
}
