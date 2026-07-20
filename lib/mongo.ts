/**
 * Phoenix WS2a alias — canonical path per PROJECT_PHOENIX.md §2a.1.
 * Implementation lives in `lib/mongodb.ts` (scaffold from migration branch).
 */
export {
  getDb,
  getMongoClientPromise,
  pingMongo,
  isMongoConfigured,
  getMongoDbName,
  __resetMongoClientForTests,
} from '@/lib/mongodb';
export type { MongoPingResult } from '@/lib/mongodb';
