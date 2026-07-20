/**
 * Doc-path alias for Phoenix Task 2a.1 (`lib/mongo.ts`).
 *
 * Canonical implementation lives in `lib/mongodb.ts` (recon delta D2).
 * Prefer importing from `@/lib/mongodb` in new code; this file keeps the
 * Phoenix contract path resolving.
 */

export {
  getDb,
  getMongoClientPromise,
  pingMongo,
  isMongoConfigured,
  getMongoDbName,
  __resetMongoClientForTests,
  type MongoPingResult,
} from '@/lib/mongodb';
