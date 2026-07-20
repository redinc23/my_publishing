/**
 * Phoenix doc path for the Mongo connection singleton (Task 2a.1).
 *
 * Implementation lives in `lib/mongodb.ts` (scaffold / recon delta D2).
 * Import either path — both export `getDb()`.
 *
 * Server-only — do not import from Client Components.
 */

import '@/lib/server-only-guard';

export {
  getDb,
  getMongoClientPromise,
  pingMongo,
  getMongoDbName,
  isMongoConfigured,
  __resetMongoClientForTests,
  type MongoPingResult,
} from '@/lib/mongodb';
