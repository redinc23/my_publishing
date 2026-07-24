/**
 * Authenticated multi-role crawl with role-gating checks.
 *
 * Usage:   npx tsx scripts/role-crawl.ts
 * Options: --help | --dry-run   (parse/config check only, no network calls)
 *          BASE_URL env var overrides the default http://localhost:3001
 *
 * Auth strategy: signs in directly against Supabase REST
 * (POST {SUPABASE_URL}/auth/v1/token?grant_type=password) to avoid the
 * app's server-action login rate limit, then replays each session to the
 * Next.js dev server as the cookie @supabase/ssr v0.12 would have written:
 *   name  = sb-<projectRef>-auth-token
 *   value = "base64-" + base64url(JSON.stringify(session))   (no padding)
 *   chunked into <name>.0, <name>.1, ... when value exceeds 3180 chars
 * Both middleware.ts (via lib/supabase/edge-auth.ts) and server components
 * (via createServerClient in lib/supabase/server.ts) read this format.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
const PASSWORD = 'TestPassword123!';
const FETCH_TIMEOUT_MS = 120_000; // dev-server first compiles are slow
const MAX_CHUNK_SIZE = 3180; // matches @supabase/ssr cookie chunker

const FAILURE_MARKERS = [
  '__next_error__',
  'Internal Server Error',
  'Application error',
  'This page could not be found',
  'Unknown Author',
];

const ACCOUNTS = {
  reader: 'test-user-1@mangu.test',
  author: 'test-author@mangu.test',
  partner: 'test-partner@mangu.test',
  admin: 'test-admin@mangu.test',
} as const;

type Role = keyof typeof ACCOUNTS;

// ─── CLI guard (also serves as a parse-check dry run) ────────────────────────

if (process.argv.includes('--help') || process.argv.includes('--dry-run')) {
  console.log('role-crawl: authenticated multi-role crawl for mangu-publishers');
  console.log('  Usage: npx tsx scripts/role-crawl.ts   (BASE_URL env overrides target)');
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Roles:  ${Object.keys(ACCOUNTS).join(', ')}`);
  process.exit(0);
}

// ─── .env.local parsing (no secrets hardcoded here) ──────────────────────────

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = readFileSync(path, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line
      .slice(0, eq)
      .replace(/^export\s+/, '')
      .trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = parseEnvFile(join(REPO_ROOT, '.env.local'));
const SUPABASE_URL = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error(
    'FATAL: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local'
  );
  process.exit(2);
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

// ─── Supabase auth + cookie emulation ────────────────────────────────────────

interface Session {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  refresh_token: string;
  user: { id: string; [k: string]: unknown };
  [k: string]: unknown;
}

async function signIn(email: string): Promise<Session> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: PASSWORD }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Sign-in failed for ${email}: HTTP ${res.status} ${body.slice(0, 300)}`);
  }
  const session = JSON.parse(body) as Session;
  if (!session.access_token || !session.user?.id) {
    throw new Error(`Sign-in response for ${email} missing access_token/user.id`);
  }
  // GoTrue usually includes expires_at, but @supabase/ssr expects it present.
  if (!session.expires_at && session.expires_in) {
    session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in;
  }
  return session;
}

function base64UrlEncode(text: string): string {
  return Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Build the Cookie header @supabase/ssr v0.12 would have written. */
function buildCookieHeader(session: Session): string {
  const value = `base64-${base64UrlEncode(JSON.stringify(session))}`;
  if (value.length <= MAX_CHUNK_SIZE) {
    return `${COOKIE_NAME}=${value}`;
  }
  const pairs: string[] = [];
  for (let i = 0; i * MAX_CHUNK_SIZE < value.length; i++) {
    pairs.push(`${COOKIE_NAME}.${i}=${value.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE)}`);
  }
  return pairs.join('; ');
}

// ─── Route fetching ──────────────────────────────────────────────────────────

interface FetchResult {
  status: number;
  location: string;
  markers: string[];
}

async function fetchPage(path: string, cookieHeader: string | null): Promise<FetchResult> {
  const headers: Record<string, string> = { Accept: 'text/html' };
  if (cookieHeader) headers.Cookie = cookieHeader;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    redirect: 'manual',
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const location = res.headers.get('location') || '';
  const markers: string[] = [];
  if (res.status === 200) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const body = await res.text();
      for (const marker of FAILURE_MARKERS) {
        if (body.includes(marker)) markers.push(marker);
      }
    }
  }
  return { status: res.status, location, markers };
}

function redirectPathname(location: string): string {
  if (!location) return '';
  try {
    return new URL(location, BASE_URL).pathname;
  } catch {
    return location;
  }
}

// ─── Check definitions ───────────────────────────────────────────────────────

/**
 * OK               expect 200 with no failure markers
 * REDIRECT_HOME    expect 3xx redirect to "/" (middleware role gate)
 * REDIRECT_LOGIN   expect 3xx redirect to "/login" (unauthenticated)
 * ENTITLEMENT_OK   200 = PASS; redirect to book page/library = ENTITLEMENT_REDIRECT (pass)
 * INFO             recorded but never fails the run (author-scoped analytics etc.)
 */
type Expectation = 'OK' | 'REDIRECT_HOME' | 'REDIRECT_LOGIN' | 'ENTITLEMENT_OK' | 'INFO';

interface Check {
  role: string;
  path: string;
  expect: Expectation;
}

interface Verdict {
  role: string;
  path: string;
  status: string;
  location: string;
  markers: string;
  verdict: 'PASS' | 'FAIL' | 'ENTITLEMENT_REDIRECT' | 'INFO' | 'SKIP';
  note: string;
}

function judge(check: Check, result: FetchResult): Verdict {
  const redirPath = redirectPathname(result.location);
  const isRedirect = [301, 302, 303, 307, 308].includes(result.status);
  const base: Omit<Verdict, 'verdict' | 'note'> = {
    role: check.role,
    path: check.path,
    status: String(result.status),
    location: redirPath || '-',
    markers: result.markers.length ? result.markers.join(',') : '-',
  };

  switch (check.expect) {
    case 'OK':
      if (result.status === 200 && result.markers.length === 0) {
        return { ...base, verdict: 'PASS', note: '' };
      }
      return {
        ...base,
        verdict: 'FAIL',
        note:
          result.status !== 200
            ? `expected 200, got ${result.status}${redirPath ? ` -> ${redirPath}` : ''}`
            : `failure markers in body: ${result.markers.join(', ')}`,
      };

    case 'REDIRECT_HOME':
      if (isRedirect && redirPath === '/') return { ...base, verdict: 'PASS', note: '' };
      return {
        ...base,
        verdict: 'FAIL',
        note: `expected redirect to /, got ${result.status}${redirPath ? ` -> ${redirPath}` : ''}`,
      };

    case 'REDIRECT_LOGIN':
      if (isRedirect && redirPath.startsWith('/login'))
        return { ...base, verdict: 'PASS', note: '' };
      return {
        ...base,
        verdict: 'FAIL',
        note: `expected redirect to /login, got ${result.status}${redirPath ? ` -> ${redirPath}` : ''}`,
      };

    case 'ENTITLEMENT_OK':
      if (result.status === 200 && result.markers.length === 0) {
        return { ...base, verdict: 'PASS', note: '' };
      }
      if (isRedirect && (redirPath.startsWith('/books') || redirPath.startsWith('/library'))) {
        return {
          ...base,
          verdict: 'ENTITLEMENT_REDIRECT',
          note: `no entitlement; redirected to ${redirPath} (treated as pass)`,
        };
      }
      return {
        ...base,
        verdict: 'FAIL',
        note: `expected 200 or entitlement redirect, got ${result.status}${redirPath ? ` -> ${redirPath}` : ''}`,
      };

    case 'INFO': {
      const summary =
        result.status === 200
          ? result.markers.length
            ? `200 with markers: ${result.markers.join(', ')}`
            : '200 OK'
          : `${result.status}${redirPath ? ` -> ${redirPath}` : ''}`;
      return {
        ...base,
        verdict: 'INFO',
        note: `recorded only (expected: author-scoped): ${summary}`,
      };
    }
  }
}

// ─── Discovery of real ids via Supabase REST ─────────────────────────────────

async function discoverBook(): Promise<{ id: string; slug: string } | null> {
  const url = `${SUPABASE_URL}/rest/v1/books?select=id,slug&status=eq.published&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    console.error(
      `WARN: book discovery failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`
    );
    return null;
  }
  const rows = (await res.json()) as Array<{ id: string; slug: string }>;
  return rows[0] ?? null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Base URL:     ${BASE_URL}`);
  console.log(`Supabase:     ${SUPABASE_URL} (ref ${PROJECT_REF})`);
  console.log(`Cookie name:  ${COOKIE_NAME}`);
  console.log('');

  const verdicts: Verdict[] = [];

  // Sign in all four roles up front so a bad credential fails fast.
  const sessions = {} as Record<Role, Session>;
  for (const role of Object.keys(ACCOUNTS) as Role[]) {
    process.stdout.write(`Signing in ${role} (${ACCOUNTS[role]})... `);
    sessions[role] = await signIn(ACCOUNTS[role]);
    console.log('ok');
  }
  console.log('');

  const book = await discoverBook();
  if (book) {
    console.log(`Discovered book: id=${book.id} slug=${book.slug}`);
  } else {
    console.log(
      'WARN: no published book discovered; book-dependent routes will be SKIPped (counted as failures).'
    );
  }
  const readerUserId = sessions.reader.user.id;
  console.log(`Reader user id: ${readerUserId}`);
  console.log('');

  // ── Build per-role check lists ──
  const roleChecks: Array<{ role: Role | 'anon'; cookie: string | null; checks: Check[] }> = [];

  const readerChecks: Check[] = [
    { role: 'reader', path: '/library', expect: 'OK' },
    ...(book
      ? ([
          { role: 'reader', path: `/books/${book.slug}`, expect: 'OK' },
          { role: 'reader', path: `/reading/${book.id}`, expect: 'ENTITLEMENT_OK' },
        ] as Check[])
      : []),
    { role: 'reader', path: '/dashboard/my-reviews', expect: 'OK' },
    ...(book
      ? ([
          { role: 'reader', path: `/dashboard/books/${book.id}/analytics`, expect: 'INFO' },
        ] as Check[])
      : []),
    { role: 'reader', path: `/users/${readerUserId}/reviews`, expect: 'OK' },
    // gating: reader must be bounced from role-scoped areas
    { role: 'reader', path: '/admin', expect: 'REDIRECT_HOME' },
    { role: 'reader', path: '/partner', expect: 'REDIRECT_HOME' },
    { role: 'reader', path: '/author', expect: 'REDIRECT_HOME' },
  ];

  const authorChecks: Check[] = [
    { role: 'author', path: '/author/dashboard', expect: 'OK' },
    { role: 'author', path: '/author/projects', expect: 'OK' },
    { role: 'author', path: '/author/submit', expect: 'OK' },
    { role: 'author', path: '/author/analytics', expect: 'OK' },
    { role: 'author', path: '/admin', expect: 'REDIRECT_HOME' },
    { role: 'author', path: '/partner', expect: 'REDIRECT_HOME' },
  ];

  const partnerChecks: Check[] = [
    { role: 'partner', path: '/partner/dashboard', expect: 'OK' },
    { role: 'partner', path: '/partner/orders', expect: 'OK' },
    { role: 'partner', path: '/partner/catalogs', expect: 'OK' },
    { role: 'partner', path: '/partner/arc-requests', expect: 'OK' },
    { role: 'partner', path: '/admin', expect: 'REDIRECT_HOME' },
    { role: 'partner', path: '/author', expect: 'REDIRECT_HOME' },
  ];

  const adminChecks: Check[] = [
    { role: 'admin', path: '/admin/dashboard', expect: 'OK' },
    { role: 'admin', path: '/admin/users', expect: 'OK' },
    { role: 'admin', path: '/admin/books', expect: 'OK' },
    { role: 'admin', path: '/admin/manuscripts', expect: 'OK' },
    { role: 'admin', path: '/admin/orders', expect: 'OK' },
    // per middleware, admin may also access author and partner portals
    { role: 'admin', path: '/author/dashboard', expect: 'OK' },
    { role: 'admin', path: '/partner/dashboard', expect: 'OK' },
  ];

  const anonChecks: Check[] = ['/library', '/admin', '/author', '/partner', '/reading/x'].map(
    (path) => ({ role: 'anon', path, expect: 'REDIRECT_LOGIN' as Expectation })
  );

  roleChecks.push(
    { role: 'anon', cookie: null, checks: anonChecks },
    { role: 'reader', cookie: buildCookieHeader(sessions.reader), checks: readerChecks },
    { role: 'author', cookie: buildCookieHeader(sessions.author), checks: authorChecks },
    { role: 'partner', cookie: buildCookieHeader(sessions.partner), checks: partnerChecks },
    { role: 'admin', cookie: buildCookieHeader(sessions.admin), checks: adminChecks }
  );

  // Record SKIPs for book-dependent reader routes we could not build.
  if (!book) {
    for (const path of [
      '/books/[slug]',
      '/reading/[bookId]',
      '/dashboard/books/[bookId]/analytics',
    ]) {
      verdicts.push({
        role: 'reader',
        path,
        status: '-',
        location: '-',
        markers: '-',
        verdict: 'SKIP',
        note: 'no published book found via Supabase REST',
      });
    }
  }

  // ── Run sequentially ──
  for (const { role, cookie, checks } of roleChecks) {
    console.log(`── Crawling as ${role} ──`);
    for (const check of checks) {
      let verdict: Verdict;
      try {
        const result = await fetchPage(check.path, cookie);
        verdict = judge(check, result);
      } catch (err) {
        verdict = {
          role: check.role,
          path: check.path,
          status: 'ERR',
          location: '-',
          markers: '-',
          verdict: 'FAIL',
          note: `fetch error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      verdicts.push(verdict);
      console.log(
        `  ${verdict.verdict.padEnd(21)} ${check.path}  (${verdict.status})${verdict.note ? `  ${verdict.note}` : ''}`
      );
    }
  }

  // ── Report ──
  console.log('');
  const header = ['ROLE', 'PATH', 'STATUS', 'REDIRECT', 'MARKERS', 'VERDICT'];
  const rows = verdicts.map((v) => [v.role, v.path, v.status, v.location, v.markers, v.verdict]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(fmt(header));
  console.log(fmt(widths.map((w) => '-'.repeat(w))));
  for (const row of rows) console.log(fmt(row));

  const failures = verdicts.filter((v) => v.verdict === 'FAIL' || v.verdict === 'SKIP');
  console.log('');
  if (failures.length === 0) {
    console.log(`ALL CHECKS PASSED (${verdicts.length} checks)`);
    process.exit(0);
  } else {
    console.log(`${failures.length} FAILING/SKIPPED CHECK(S):`);
    for (const f of failures) {
      console.log(`  [${f.role}] ${f.path}: ${f.note}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(2);
});
