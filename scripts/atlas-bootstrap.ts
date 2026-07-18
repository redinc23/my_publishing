#!/usr/bin/env tsx
/**
 * Idempotent MongoDB Atlas bootstrap via Admin API.
 *
 * Ensures: org → project → M0 cluster → DB user → 0.0.0.0/0 access → MONGODB_URI in .env.local
 *
 * One-time operator setup:
 *   Atlas → Organization → Access Manager → API Keys
 *   export ATLAS_PUBLIC_KEY=... ATLAS_PRIVATE_KEY=...
 *   # optional: ATLAS_ORG_ID, ATLAS_GROUP_ID, ATLAS_CLUSTER_NAME, ATLAS_DB_USER, ATLAS_DB_PASSWORD
 *
 * Usage:
 *   npx tsx scripts/atlas-bootstrap.ts
 *   npm run db:atlas:bootstrap
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  loadAtlasCredentials,
  listOrgs,
  listGroups,
  createGroup,
  listClusters,
  createFreeCluster,
  waitForClusterIdle,
  ensureAnywhereAccess,
  ensureDatabaseUser,
  getSrvConnectionString,
  buildMongoUri,
  generateDbPassword,
} from './lib/atlas-admin';
import { envFilePath, loadDotEnvLocal, upsertEnvVars, readEnvFile } from './lib/env-file';

async function main(): Promise<void> {
  loadDotEnvLocal();

  const creds = loadAtlasCredentials();
  const projectName = process.env.ATLAS_PROJECT_NAME || 'mangu-publishers';
  const clusterName = process.env.ATLAS_CLUSTER_NAME || 'Cluster0';
  const dbUser = process.env.ATLAS_DB_USER || 'mangu_app';
  const dbName = process.env.MONGODB_DB || 'mangu';
  const region = process.env.ATLAS_REGION || 'US_EAST_1';

  console.log('=== Atlas bootstrap (idempotent) ===');

  const orgs = await listOrgs(creds);
  if (orgs.length === 0) throw new Error('No Atlas organizations visible to this API key');

  let orgId = process.env.ATLAS_ORG_ID;
  if (!orgId) {
    orgId = orgs[0].id;
    console.log(`  Using org: ${orgs[0].name} (${orgId})`);
  } else {
    console.log(`  Using ATLAS_ORG_ID=${orgId}`);
  }

  let groupId = process.env.ATLAS_GROUP_ID;
  if (!groupId) {
    const groups = await listGroups(creds, orgId);
    const existing = groups.find((g) => g.name === projectName) || groups[0];
    if (existing) {
      groupId = existing.id;
      console.log(`  Using project: ${existing.name} (${groupId})`);
    } else {
      const created = await createGroup(creds, orgId, projectName);
      groupId = created.id;
      console.log(`  ✓ Created project: ${projectName} (${groupId})`);
    }
  } else {
    console.log(`  Using ATLAS_GROUP_ID=${groupId}`);
  }

  const clusters = await listClusters(creds, groupId);
  let cluster = clusters.find((c) => c.name === clusterName) || clusters[0];
  if (!cluster) {
    console.log(`  Creating free M0 cluster "${clusterName}" in ${region}…`);
    cluster = await createFreeCluster(creds, groupId, clusterName, region);
  } else {
    console.log(`  Using cluster: ${cluster.name} (state=${cluster.stateName || 'unknown'})`);
  }

  if (cluster.stateName !== 'IDLE') {
    cluster = await waitForClusterIdle(creds, groupId, cluster.name);
  }

  await ensureAnywhereAccess(creds, groupId);

  // Password: reuse from env / .env.local secret store file / generate once
  const secretDir = resolve(process.cwd(), '.local');
  const secretPath = resolve(secretDir, 'atlas-db-password');
  let password = process.env.ATLAS_DB_PASSWORD;
  if (!password && existsSync(secretPath)) {
    password = readFileSync(secretPath, 'utf8').trim();
  }
  if (!password) {
    const existingUri = readEnvFile(envFilePath()).get('MONGODB_URI');
    // Prefer generating + creating user; if user exists without password we can't recover it
    password = generateDbPassword();
    if (!existsSync(secretDir)) mkdirSync(secretDir, { recursive: true });
    writeFileSync(secretPath, password + '\n', { encoding: 'utf8', mode: 0o600 });
    console.log(`  ✓ Generated DB password → .local/atlas-db-password (gitignored)`);
    if (existingUri) {
      console.log(
        '  ⚠ MONGODB_URI already set; new password only applies if user is newly created'
      );
    }
  }

  await ensureDatabaseUser(creds, groupId, dbUser, password);

  const srv = await getSrvConnectionString(creds, groupId, cluster.name);
  const uri = buildMongoUri(srv, dbUser, password);

  upsertEnvVars(envFilePath(), {
    MONGODB_URI: uri,
    MONGODB_DB: dbName,
    ATLAS_ORG_ID: orgId,
    ATLAS_GROUP_ID: groupId,
    ATLAS_CLUSTER_NAME: cluster.name,
    ATLAS_DB_USER: dbUser,
    DATABASE_PROVIDER: process.env.DATABASE_PROVIDER || 'mongodb',
  });

  console.log('');
  console.log('✓ Wrote MONGODB_URI + Atlas ids to .env.local');
  console.log(`  cluster=${cluster.name} db=${dbName} user=${dbUser}`);
  console.log('  (URI redacted — open .env.local locally; never commit or paste into chat)');
  console.log('');
  console.log('Next: npm run db:mongo:ping && npm run db:mongo:sync-vercel');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
