#!/usr/bin/env tsx
/**
 * rotate-supabase-anon-key.ts  (O.2 — H0.1)
 *
 * Rotates NEXT_PUBLIC_SUPABASE_ANON_KEY in:
 *   1. .env.local
 *   2. Vercel Production + Preview  (project manguprojectz)
 *   3. GitHub Actions repository secret
 *
 * After running: redeploy Vercel Production, then disable the legacy
 * key in Supabase ? Settings ? API Keys.
 *
 * Usage:
 *   npx tsx scripts/rotate-supabase-anon-key.ts
 *
 * Required env vars (in .env.local or exported):
 *   VERCEL_TOKEN   — https://vercel.com/account/tokens
 *   GITHUB_TOKEN   — PAT with repo + secrets scope
 *                    https://github.com/settings/tokens
 *
 * Optional overrides:
 *   VERCEL_PROJECT_ID  (default: prj_6FYYVNpwHAwJCErSchMZksCiiPul)
 *   VERCEL_TEAM_ID     (default: team_hc9sovtwUu2WJdNuoU7JtWUP)
 *   GITHUB_REPO        (default: redinc23/my_publishing)
 *   SKIP_LOCAL=1       skip .env.local update
 *   SKIP_VERCEL=1      skip Vercel update
 *   SKIP_GITHUB=1      skip GitHub Actions update
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? 'prj_6FYYVNpwHAwJCErSchMZksCiiPul';
const VERCEL_TEAM_ID    = process.env.VERCEL_TEAM_ID    ?? 'team_hc9sovtwUu2WJdNuoU7JtWUP';
const GITHUB_REPO       = process.env.GITHUB_REPO       ?? 'redinc23/my_publishing';
const ENV_KEY           = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';
const ROOT              = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ENV_FILE          = path.join(ROOT, '.env.local');

function redact(v: string): string {
  return v.length <= 8 ? '[too short]' : `${v.slice(0, 6)}...${v.slice(-4)} (len=${v.length})`;
}

function validateAnonKey(key: string): void {
  if (!key || key.length < 20)       throw new Error('Key is too short — looks empty.');
  if (!key.startsWith('eyJ'))        throw new Error('Expected a JWT starting with eyJ...');
  if (key.split('.').length !== 3)   throw new Error('Expected a 3-part JWT (header.payload.sig).');
}

async function promptHidden(question: string): Promise<string> {
  // On Windows raw mode may not work; fall back to visible prompt gracefully
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

// -- 1. .env.local ---------------------------------------------------------
function updateEnvLocal(newKey: string): void {
  if (!fs.existsSync(ENV_FILE)) {
    console.log('  ?  .env.local not found — skipping local update.');
    return;
  }
  const backup = `${ENV_FILE}.bak`;
  fs.copyFileSync(ENV_FILE, backup);
  let content = fs.readFileSync(ENV_FILE, 'utf-8');
  const pattern = new RegExp(`^${ENV_KEY}=.*$`, 'm');
  content = pattern.test(content)
    ? content.replace(pattern, `${ENV_KEY}=${newKey}`)
    : `${content}\n${ENV_KEY}=${newKey}\n`;
  fs.writeFileSync(ENV_FILE, content, 'utf-8');
  console.log('  ?  .env.local updated (backup: .env.local.bak)');
}

// -- 2. Vercel --------------------------------------------------------------
async function upsertVercelEnv(token: string, value: string): Promise<void> {
  const base = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env`;
  const qs   = `?teamId=${VERCEL_TEAM_ID}`;

  const listRes = await fetch(`${base}${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) throw new Error(`Vercel list failed: ${listRes.status} ${await listRes.text()}`);
  const { envs } = await listRes.json() as { envs: Array<{ id: string; key: string; target: string[] }> };

  const targets: Array<'production' | 'preview'> = ['production', 'preview'];
  for (const target of targets) {
    const match = envs.find(e => e.key === ENV_KEY && e.target.includes(target));
    if (match) {
      const r = await fetch(`${base}/${match.id}${qs}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, target: [target], type: 'plain' }),
      });
      if (!r.ok) throw new Error(`Vercel PATCH ${target}: ${r.status} ${await r.text()}`);
      console.log(`  ?  Vercel ${target}: updated`);
    } else {
      const r = await fetch(`${base}${qs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: ENV_KEY, value, target: [target], type: 'plain' }),
      });
      if (!r.ok) throw new Error(`Vercel POST ${target}: ${r.status} ${await r.text()}`);
      console.log(`  ?  Vercel ${target}: created`);
    }
  }
}

// -- 3. GitHub Actions -----------------------------------------------------
async function updateGitHubSecret(token: string, secretValue: string): Promise<void> {
  const [owner, repo] = GITHUB_REPO.split('/');
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  // Get repo public key for secret encryption
  const pkRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
    { headers }
  );
  if (!pkRes.ok) throw new Error(`GitHub public-key: ${pkRes.status} ${await pkRes.text()}`);
  const { key_id, key: pubKeyB64 } = await pkRes.json() as { key_id: string; key: string };

  // GitHub requires libsodium sealed-box encryption.
  // Try to load tweetnacl-sealedbox-js; fall back to manual instructions if absent.
  let encryptedB64: string;
  try {
    const { default: sealedBox } = await import('tweetnacl-sealedbox-js');
    const pubKey   = Buffer.from(pubKeyB64, 'base64');
    const msgBytes = Buffer.from(secretValue, 'utf-8');
    encryptedB64 = Buffer.from(sealedBox.seal(msgBytes, pubKey)).toString('base64');
  } catch {
    console.log('  ?  tweetnacl-sealedbox-js not installed — cannot encrypt secret automatically.');
    console.log('     Update GitHub Actions secret manually:');
    console.log(`     ? https://github.com/${GITHUB_REPO}/settings/secrets/actions`);
    console.log(`     ? Update secret: ${ENV_KEY}`);
    return;
  }

  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${ENV_KEY}`,
    { method: 'PUT', headers, body: JSON.stringify({ encrypted_value: encryptedB64, key_id }) }
  );
  if (!putRes.ok && putRes.status !== 204) {
    throw new Error(`GitHub PUT secret: ${putRes.status} ${await putRes.text()}`);
  }
  console.log(`  ?  GitHub Actions secret ${ENV_KEY} updated`);
}

// -- main -------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('\n-----------------------------------------------------------');
  console.log(' MANGU — Rotate Supabase Anon Key  (O.2 / H0.1)');
  console.log('-----------------------------------------------------------\n');
  console.log(' Step 1: Open this URL and copy your new anon key:');
  console.log(' https://supabase.com/dashboard/project/tkzvikozrcynhwsqtkqp/settings/api\n');
  console.log(' Copy the "anon public" key (starts with eyJ...).\n');

  const newKey = await promptHidden(' Paste new Supabase anon key: ');

  try { validateAnonKey(newKey); }
  catch (e: unknown) {
    console.error(` ?  ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(` Key received: ${redact(newKey)}\n`);

  // load .env.local to pick up VERCEL_TOKEN and GITHUB_TOKEN if not in process.env
  if (fs.existsSync(ENV_FILE)) {
    const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }

  if (process.env.SKIP_LOCAL !== '1') {
    console.log('-- Step 1: .env.local ----------------------------------');
    updateEnvLocal(newKey);
  }

  if (process.env.SKIP_VERCEL !== '1') {
    console.log('\n-- Step 2: Vercel (Production + Preview) ---------------');
    const vercelToken = process.env.VERCEL_TOKEN;
    if (!vercelToken) {
      console.log('  ?  VERCEL_TOKEN not found in .env.local or environment.');
      console.log('     Add to .env.local:  VERCEL_TOKEN=<your-token>');
      console.log('     Get token at: https://vercel.com/account/tokens');
    } else {
      await upsertVercelEnv(vercelToken, newKey);
      console.log('\n  ?  NEXT_PUBLIC_* vars need a Vercel rebuild to take effect.');
      console.log('     Redeploy at: https://vercel.com/manguprojectz/deployments');
    }
  }

  if (process.env.SKIP_GITHUB !== '1') {
    console.log('\n-- Step 3: GitHub Actions secret -----------------------');
    const ghToken = process.env.GITHUB_TOKEN;
    if (!ghToken) {
      console.log('  ?  GITHUB_TOKEN not found in .env.local or environment.');
      console.log('     Add to .env.local:  GITHUB_TOKEN=<PAT with repo+secrets scope>');
      console.log('     Get token at: https://github.com/settings/tokens');
      console.log(`     Or update manually: https://github.com/${GITHUB_REPO}/settings/secrets/actions`);
    } else {
      await updateGitHubSecret(ghToken, newKey);
    }
  }

  console.log('\n-----------------------------------------------------------');
  console.log(' Final steps (2 clicks — cannot be automated):');
  console.log('');
  console.log(' A) Redeploy Vercel Production:');
  console.log('    https://vercel.com/manguprojectz/deployments ? Redeploy');
  console.log('');
  console.log(' B) Disable OLD legacy key in Supabase:');
  console.log('    https://supabase.com/dashboard/project/tkzvikozrcynhwsqtkqp/settings/api');
  console.log('    ? Settings ? API Keys ? Disable legacy API keys');
  console.log('');
  console.log(' C) Verify old key is rejected (401/403):');
  console.log('    curl -sS -o /dev/null -w "%{http_code}" \\');
  console.log('      -H "apikey: <OLD_KEY>" \\');
  console.log('      https://tkzvikozrcynhwsqtkqp.supabase.co/rest/v1/');
  console.log('-----------------------------------------------------------\n');
}

main().catch(e => {
  console.error('\n ? ', e instanceof Error ? e.message : e);
  process.exit(1);
});
