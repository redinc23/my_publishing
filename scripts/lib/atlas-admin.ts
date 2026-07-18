/**
 * MongoDB Atlas Administration API v2 client (HTTP Digest).
 * Used by bootstrap / ensure scripts — not the data-plane driver.
 */

import DigestFetch from 'digest-fetch';
import { createHash, randomBytes } from 'crypto';

const ATLAS_BASE = 'https://cloud.mongodb.com/api/atlas/v2';
const ATLAS_ACCEPT = 'application/vnd.atlas.2024-08-05+json';

export interface AtlasCredentials {
  publicKey: string;
  privateKey: string;
}

export function loadAtlasCredentials(): AtlasCredentials {
  const publicKey = process.env.ATLAS_PUBLIC_KEY || process.env.MONGODB_ATLAS_PUBLIC_KEY;
  const privateKey = process.env.ATLAS_PRIVATE_KEY || process.env.MONGODB_ATLAS_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error(
      'Missing ATLAS_PUBLIC_KEY / ATLAS_PRIVATE_KEY.\n' +
        'Create once: Atlas UI → Organization → Access Manager → API Keys\n' +
        'Roles: Organization Project Creator (or Project Owner on an existing project).\n' +
        'Then: export ATLAS_PUBLIC_KEY=... ATLAS_PRIVATE_KEY=...'
    );
  }
  return { publicKey, privateKey };
}

function client(creds: AtlasCredentials) {
  return new DigestFetch(creds.publicKey, creds.privateKey);
}

export async function atlasFetch<T>(
  creds: AtlasCredentials,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${ATLAS_BASE}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Accept', ATLAS_ACCEPT);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await client(creds).fetch(url, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const detail =
      typeof body === 'object' && body && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : text.slice(0, 500);
    throw new Error(`Atlas API ${res.status} ${init.method || 'GET'} ${path}: ${detail}`);
  }

  return body as T;
}

export interface AtlasOrg {
  id: string;
  name: string;
}

export interface AtlasGroup {
  id: string;
  name: string;
  orgId: string;
}

export interface AtlasCluster {
  name: string;
  stateName?: string;
  connectionStrings?: {
    standardSrv?: string;
    standard?: string;
  };
}

export async function listOrgs(creds: AtlasCredentials): Promise<AtlasOrg[]> {
  const data = await atlasFetch<{ results?: AtlasOrg[] }>(creds, '/orgs');
  return data.results || [];
}

export async function listGroups(creds: AtlasCredentials, orgId: string): Promise<AtlasGroup[]> {
  const data = await atlasFetch<{ results?: AtlasGroup[] }>(creds, `/orgs/${orgId}/groups`);
  return data.results || [];
}

export async function createGroup(
  creds: AtlasCredentials,
  orgId: string,
  name: string
): Promise<AtlasGroup> {
  return atlasFetch<AtlasGroup>(creds, `/groups`, {
    method: 'POST',
    body: JSON.stringify({ name, orgId }),
  });
}

export async function listClusters(
  creds: AtlasCredentials,
  groupId: string
): Promise<AtlasCluster[]> {
  const data = await atlasFetch<{ results?: AtlasCluster[] }>(creds, `/groups/${groupId}/clusters`);
  return data.results || [];
}

export async function getCluster(
  creds: AtlasCredentials,
  groupId: string,
  clusterName: string
): Promise<AtlasCluster> {
  return atlasFetch<AtlasCluster>(creds, `/groups/${groupId}/clusters/${clusterName}`);
}

/** Free-tier M0 cluster create (idempotent caller should check list first). */
export async function createFreeCluster(
  creds: AtlasCredentials,
  groupId: string,
  clusterName: string,
  regionName = 'US_EAST_1'
): Promise<AtlasCluster> {
  return atlasFetch<AtlasCluster>(creds, `/groups/${groupId}/clusters`, {
    method: 'POST',
    body: JSON.stringify({
      name: clusterName,
      clusterType: 'REPLICASET',
      replicationSpecs: [
        {
          numShards: 1,
          regionConfigs: [
            {
              providerName: 'TENANT',
              backingProviderName: 'AWS',
              regionName,
              priority: 7,
              electableSpecs: {
                instanceSize: 'M0',
                nodeCount: 1,
              },
            },
          ],
        },
      ],
    }),
  });
}

export async function waitForClusterIdle(
  creds: AtlasCredentials,
  groupId: string,
  clusterName: string,
  timeoutMs = 15 * 60 * 1000
): Promise<AtlasCluster> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const cluster = await getCluster(creds, groupId, clusterName);
    if (cluster.stateName === 'IDLE') return cluster;
    console.log(`  … cluster ${clusterName} state=${cluster.stateName || 'unknown'}; waiting`);
    await new Promise((r) => setTimeout(r, 15000));
  }
  throw new Error(`Timed out waiting for cluster ${clusterName} to become IDLE`);
}

export async function ensureAnywhereAccess(
  creds: AtlasCredentials,
  groupId: string
): Promise<void> {
  const list = await atlasFetch<{ results?: Array<{ cidrBlock?: string; ipAddress?: string }> }>(
    creds,
    `/groups/${groupId}/accessList`
  );
  const hasOpen = (list.results || []).some(
    (e) => e.cidrBlock === '0.0.0.0/0' || e.ipAddress === '0.0.0.0'
  );
  if (hasOpen) {
    console.log('  ✓ Network Access already allows 0.0.0.0/0');
    return;
  }
  await atlasFetch(creds, `/groups/${groupId}/accessList`, {
    method: 'POST',
    body: JSON.stringify([
      {
        cidrBlock: '0.0.0.0/0',
        comment: 'Vercel + CI (mangu mongo-up automation)',
      },
    ]),
  });
  console.log('  ✓ Added Network Access 0.0.0.0/0');
}

export async function ensureDatabaseUser(
  creds: AtlasCredentials,
  groupId: string,
  username: string,
  password: string
): Promise<void> {
  const path = `/groups/${groupId}/databaseUsers/admin/${encodeURIComponent(username)}`;
  let exists = false;
  try {
    await atlasFetch(creds, path);
    exists = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('404')) throw err;
  }

  if (exists) {
    // Rotate to the password we control so MONGODB_URI always matches.
    await atlasFetch(creds, path, {
      method: 'PATCH',
      body: JSON.stringify({
        password,
        roles: [{ roleName: 'readWriteAnyDatabase', databaseName: 'admin' }],
      }),
    });
    console.log(`  ✓ Updated database user "${username}" password to match local secret`);
    return;
  }

  await atlasFetch(creds, `/groups/${groupId}/databaseUsers`, {
    method: 'POST',
    body: JSON.stringify({
      databaseName: 'admin',
      username,
      password,
      roles: [{ roleName: 'readWriteAnyDatabase', databaseName: 'admin' }],
    }),
  });
  console.log(`  ✓ Created database user "${username}"`);
}

export async function getSrvConnectionString(
  creds: AtlasCredentials,
  groupId: string,
  clusterName: string
): Promise<string> {
  const cluster = await getCluster(creds, groupId, clusterName);
  const srv = cluster.connectionStrings?.standardSrv;
  if (!srv) {
    throw new Error(
      `No standardSrv on cluster ${clusterName} yet (state=${cluster.stateName}). Wait and retry.`
    );
  }
  return srv;
}

/** Build mongodb+srv URI with credentials embedded. */
export function buildMongoUri(standardSrv: string, username: string, password: string): string {
  const encodedUser = encodeURIComponent(username);
  const encodedPass = encodeURIComponent(password);
  // standardSrv looks like: mongodb+srv://cluster0.xxxxx.mongodb.net
  if (!standardSrv.startsWith('mongodb+srv://') && !standardSrv.startsWith('mongodb://')) {
    throw new Error(`Unexpected connection string host: ${standardSrv}`);
  }
  const rest = standardSrv.replace(/^mongodb\+srv:\/\//, '').replace(/^mongodb:\/\//, '');
  const scheme = standardSrv.startsWith('mongodb+srv://') ? 'mongodb+srv' : 'mongodb';
  return `${scheme}://${encodedUser}:${encodedPass}@${rest}/?retryWrites=true&w=majority&appName=${encodeURIComponent(clusterNameFromHost(rest))}`;
}

function clusterNameFromHost(host: string): string {
  const first = host.split('.')[0] || 'Cluster0';
  return first;
}

export function generateDbPassword(): string {
  // URL-safe-ish password without characters that break poorly-encoded URIs
  return createHash('sha256').update(randomBytes(32)).digest('base64url').slice(0, 32);
}
