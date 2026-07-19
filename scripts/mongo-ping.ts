#!/usr/bin/env tsx
/**
 * Ping MongoDB using MONGODB_URI from env / .env.local.
 * Usage: npm run db:mongo:ping
 */

import { loadDotEnvLocal } from './lib/env-file';
import { pingMongo, isMongoConfigured, getMongoDbName } from '../lib/mongodb';
import { __resetMongoClientForTests } from '../lib/mongodb';

async function main(): Promise<void> {
  loadDotEnvLocal();
  __resetMongoClientForTests();

  if (!isMongoConfigured()) {
    console.error('MONGODB_URI not set. Run: npm run db:atlas:bootstrap');
    process.exit(1);
  }

  console.log(`Pinging MongoDB (db=${getMongoDbName()})…`);
  const result = await pingMongo();
  if (!result.ok) {
    console.error(`FAIL (${result.latency_ms}ms): ${result.message}`);
    process.exit(1);
  }
  console.log(`OK ${result.latency_ms}ms${result.message ? ` — ${result.message}` : ''}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
