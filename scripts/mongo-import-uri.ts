#!/usr/bin/env tsx
/**
 * Import an existing mongodb+srv URI (from Atlas Drivers UI) into .env.local,
 * then ping + indexes + optional Vercel sync.
 *
 * Usage:
 *   echo 'mongodb+srv://...' | npm run db:mongo:import-uri
 *   npm run db:mongo:import-uri -- "mongodb+srv://..."
 *
 * Prefer `npm run db:mongo:up` (API keys) when possible — no password paste needed twice.
 */

import { createInterface } from 'readline';
import { assertMongoUri } from '../lib/mongodb-config';
import { envFilePath, loadDotEnvLocal, upsertEnvVars } from './lib/env-file';
import { spawnSync } from 'child_process';

async function readUri(): Promise<string> {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('-'));
  if (arg) return arg.trim();

  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8').trim();
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const uri = await new Promise<string>((resolve) => {
    rl.question('Paste MONGODB_URI (not echoed to git): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
  return uri;
}

function run(script: string): void {
  const result = spawnSync('npx', ['tsx', script], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function main(): Promise<void> {
  loadDotEnvLocal();
  const uri = assertMongoUri(await readUri());
  const dbName = process.env.MONGODB_DB || 'mangu';

  upsertEnvVars(envFilePath(), {
    MONGODB_URI: uri,
    MONGODB_DB: dbName,
    DATABASE_PROVIDER: 'mongodb',
  });
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB = dbName;
  process.env.DATABASE_PROVIDER = 'mongodb';

  console.log('✓ Wrote MONGODB_URI to .env.local (redacted)');
  run('scripts/mongo-ping.ts');
  run('scripts/mongo-ensure-indexes.ts');

  if (process.env.VERCEL_TOKEN) {
    run('scripts/sync-mongodb-to-vercel.ts');
  } else {
    console.warn('⚠ VERCEL_TOKEN not set — skipped Vercel sync');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
