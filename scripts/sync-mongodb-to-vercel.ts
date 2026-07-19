#!/usr/bin/env tsx
/**
 * Push MONGODB_URI (+ MONGODB_DB, DATABASE_PROVIDER) to Vercel project env.
 *
 * Requires once:
 *   VERCEL_TOKEN          — https://vercel.com/account/tokens
 *   VERCEL_PROJECT_ID     — default: manguprojectz prj_6FYYVNpwHAwJCErSchMZksCiiPul
 *   VERCEL_TEAM_ID        — default: redinc23s-projects team_hc9sovtwUu2WJdNuoU7JtWUP
 *
 * Usage: npm run db:mongo:sync-vercel
 */

import { loadDotEnvLocal } from './lib/env-file';

const DEFAULT_PROJECT_ID = 'prj_6FYYVNpwHAwJCErSchMZksCiiPul';
const DEFAULT_TEAM_ID = 'team_hc9sovtwUu2WJdNuoU7JtWUP';

async function upsertEnv(
  token: string,
  teamId: string,
  projectId: string,
  key: string,
  value: string,
  targets: Array<'production' | 'preview' | 'development'>
): Promise<void> {
  const listUrl = new URL(`https://api.vercel.com/v9/projects/${projectId}/env`);
  listUrl.searchParams.set('teamId', teamId);

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) {
    throw new Error(`List env failed: ${listRes.status} ${await listRes.text()}`);
  }
  const listJson = (await listRes.json()) as {
    envs?: Array<{ id: string; key: string; target?: string[] }>;
  };
  const existing = (listJson.envs || []).filter((e) => e.key === key);

  for (const env of existing) {
    const del = new URL(`https://api.vercel.com/v9/projects/${projectId}/env/${env.id}`);
    del.searchParams.set('teamId', teamId);
    const delRes = await fetch(del, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!delRes.ok) {
      throw new Error(`Delete env ${key} failed: ${delRes.status} ${await delRes.text()}`);
    }
  }

  const createUrl = new URL(`https://api.vercel.com/v10/projects/${projectId}/env`);
  createUrl.searchParams.set('teamId', teamId);
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type: 'encrypted',
      target: targets,
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Create env ${key} failed: ${createRes.status} ${await createRes.text()}`);
  }
  console.log(`  ✓ ${key} → ${targets.join(',')}`);
}

async function main(): Promise<void> {
  loadDotEnvLocal();

  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.error(
      'Missing VERCEL_TOKEN.\n' +
        'Create: https://vercel.com/account/tokens\n' +
        'Then: export VERCEL_TOKEN=... && npm run db:mongo:sync-vercel'
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing. Run npm run db:atlas:bootstrap first.');
    process.exit(1);
  }

  const projectId = process.env.VERCEL_PROJECT_ID || DEFAULT_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID || DEFAULT_TEAM_ID;
  const dbName = process.env.MONGODB_DB || 'mangu';
  const provider = process.env.DATABASE_PROVIDER || 'mongodb';
  const targets = (process.env.VERCEL_ENV_TARGETS || 'production,preview,development')
    .split(',')
    .map((t) => t.trim()) as Array<'production' | 'preview' | 'development'>;

  console.log(`=== Sync Mongo env → Vercel project ${projectId} ===`);
  await upsertEnv(token, teamId, projectId, 'MONGODB_URI', uri, targets);
  await upsertEnv(token, teamId, projectId, 'MONGODB_DB', dbName, targets);
  await upsertEnv(token, teamId, projectId, 'DATABASE_PROVIDER', provider, targets);

  console.log('');
  console.log('✓ Vercel env updated. Redeploy Production to pick up secrets.');
  console.log('  Tip: npx vercel --prod   (or dashboard Redeploy)');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
