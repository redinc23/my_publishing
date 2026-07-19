#!/usr/bin/env tsx
/**
 * One-shot Mongo automation:
 *   1) Atlas bootstrap (cluster/user/IP/URI → .env.local)
 *   2) Ping
 *   3) Ensure indexes
 *   4) Sync to Vercel (if VERCEL_TOKEN set)
 *
 * Usage:
 *   export ATLAS_PUBLIC_KEY=... ATLAS_PRIVATE_KEY=...
 *   export VERCEL_TOKEN=...          # optional but recommended
 *   npm run db:mongo:up
 */

import { spawnSync } from 'child_process';
import { loadDotEnvLocal } from './lib/env-file';

function run(label: string, args: string[], optional = false): void {
  console.log(`\n── ${label} ──`);
  const result = spawnSync('npx', ['tsx', ...args], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    if (optional) {
      console.warn(`(optional step failed — continuing)`);
      return;
    }
    process.exit(result.status ?? 1);
  }
}

async function main(): Promise<void> {
  loadDotEnvLocal();

  if (!process.env.ATLAS_PUBLIC_KEY && !process.env.MONGODB_ATLAS_PUBLIC_KEY) {
    console.error(`
Mongo automation needs Atlas API keys (one-time, ~60s in Atlas UI):

  1. https://cloud.mongodb.com → Organization → Access Manager → API Keys
  2. Create API Key with Organization Project Creator (or Project Owner)
  3. Copy public + private key
  4. cd into the repo (must see package.json), THEN set env + run

  Git Bash / MINGW64 / WSL (use this on your machine):
    cd /c/Users/chris/path/to/my_publishing
    export ATLAS_PUBLIC_KEY='paste_public_key'
    export ATLAS_PRIVATE_KEY='paste_private_key'
    export VERCEL_TOKEN='paste_vercel_token'
    npm run db:mongo:up

  PowerShell ONLY (do not paste $env: lines into Git Bash):
    cd C:\\Users\\chris\\path\\to\\my_publishing
    $env:ATLAS_PUBLIC_KEY="paste_public_key"
    $env:ATLAS_PRIVATE_KEY="paste_private_key"
    $env:VERCEL_TOKEN="paste_vercel_token"
    npm run db:mongo:up

  Already have a Drivers URI? Skip Atlas API keys:
    export VERCEL_TOKEN='...'
    npm run db:mongo:import-uri -- 'mongodb+srv://USER:PASS@cluster...'
`);
    process.exit(1);
  }

  run('Atlas bootstrap', ['scripts/atlas-bootstrap.ts']);
  // Reload env after bootstrap wrote .env.local
  loadDotEnvLocal();
  run('Ping', ['scripts/mongo-ping.ts']);
  run('Indexes', ['scripts/mongo-ensure-indexes.ts']);

  if (process.env.VERCEL_TOKEN) {
    run('Sync → Vercel', ['scripts/sync-mongodb-to-vercel.ts']);
  } else {
    console.warn('\n⚠ VERCEL_TOKEN not set — skipped Vercel env sync.');
    console.warn('  export VERCEL_TOKEN=... && npm run db:mongo:sync-vercel');
  }

  console.log(`
════════════════════════════════════════
 Mongo stack is up (local).
 Next agent cutover: rewrite queries off Supabase;
 pick auth (Clerk / Better Auth / Auth.js).
════════════════════════════════════════
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
