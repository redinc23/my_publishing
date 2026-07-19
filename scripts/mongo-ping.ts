#!/usr/bin/env tsx
/**
 * Ping MongoDB Atlas (readiness helper).
 * Usage: npm run db:mongo:ping
 */

import { loadDotEnvLocal } from './lib/env-file';
import { pingMongo, isMongoConfigured } from '../lib/mongodb';

async function main(): Promise<void> {
  loadDotEnvLocal();

  if (!isMongoConfigured()) {
    console.error('MONGODB_URI not set. Run: npm run db:atlas:bootstrap');
    process.exit(1);
  }

  const result = await pingMongo();
  if (!result.ok) {
    console.error(`✗ Mongo ping failed (${result.latency_ms}ms): ${result.message || 'unknown'}`);
    process.exit(1);
  }
  console.log(`✓ Mongo ping ok (${result.latency_ms}ms)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
