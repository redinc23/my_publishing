/**
 * E2E tests for role-based access control (RBAC).
 *
 * Source of truth: middleware.ts + lib/supabase/edge-auth.ts.
 *
 * Matrix encoded here:
 *   - Unauthenticated → /login for /library, /reading/*, /author/*, /partner/*, /admin/*
 *   - reader  → 200 on /library; bounced to / from admin/author/partner portals
 *   - author  → 200 on /author/*; bounced to / from /admin/* and /partner/*
 *   - partner → 200 on /partner/*; bounced to / from /admin/* and /author/*
 *   - admin   → 200 on /admin/*, and (per middleware) also allowed into
 *               /author/* and /partner/*
 *   - Any logged-in user visiting /login is redirected to /
 *
 * Auth strategy: the middleware rate-limits auth POSTs to 5 per 15 minutes
 * per IP, so we MUST NOT log in per test. Instead, each role logs in through
 * the UI form at most once and the resulting storage state is cached as JSON
 * under the gitignored `.auth/` directory. The cache is shared across
 * Playwright projects, workers, and consecutive runs (while the access token
 * is still fresh). A directory-based lock makes the login step safe when
 * multiple workers race for the same role.
 */

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Environment gate
// ---------------------------------------------------------------------------

// These tests exercise a real auth backend; skip when running against the CI
// mock gate (USE_MOCKS=true or placeholder Supabase credentials). Note the
// middleware only enforces RBAC when Supabase env vars are present.
const hasRealSupabase = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.USE_MOCKS !== 'true' &&
  !/placeholder|test\.supabase/.test(process.env.NEXT_PUBLIC_SUPABASE_URL);

// ---------------------------------------------------------------------------
// Test accounts (overridable via env)
// ---------------------------------------------------------------------------

type Role = 'reader' | 'author' | 'partner' | 'admin';

const DEFAULT_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'TestPassword123!';

const ACCOUNTS: Record<Role, { email: string; password: string }> = {
  reader: {
    email: process.env.TEST_READER_EMAIL ?? 'test-user-1@mangu.test',
    password: process.env.TEST_READER_PASSWORD ?? DEFAULT_PASSWORD,
  },
  author: {
    email: process.env.TEST_AUTHOR_EMAIL ?? 'test-author@mangu.test',
    password: process.env.TEST_AUTHOR_PASSWORD ?? DEFAULT_PASSWORD,
  },
  partner: {
    email: process.env.TEST_PARTNER_EMAIL ?? 'test-partner@mangu.test',
    password: process.env.TEST_PARTNER_PASSWORD ?? DEFAULT_PASSWORD,
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL ?? 'test-admin@mangu.test',
    password: process.env.TEST_ADMIN_PASSWORD ?? DEFAULT_PASSWORD,
  },
};

// ---------------------------------------------------------------------------
// Access-control matrix (mirrors middleware.ts)
// ---------------------------------------------------------------------------

const MATRIX: Record<Role, { allowed: string[]; denied: string[] }> = {
  reader: {
    allowed: ['/library'],
    denied: ['/admin/dashboard', '/author/dashboard', '/partner/dashboard'],
  },
  author: {
    allowed: ['/author/dashboard', '/author/projects', '/author/submit', '/author/analytics'],
    denied: ['/admin/dashboard', '/partner/dashboard'],
  },
  partner: {
    allowed: [
      '/partner/dashboard',
      '/partner/orders',
      '/partner/catalogs',
      '/partner/arc-requests',
    ],
    denied: ['/admin/dashboard', '/author/dashboard'],
  },
  admin: {
    allowed: [
      '/admin/dashboard',
      '/admin/users',
      '/admin/books',
      '/admin/manuscripts',
      '/admin/orders',
      // Middleware explicitly lets admins into the author and partner portals.
      '/author/dashboard',
      '/partner/dashboard',
    ],
    denied: [],
  },
};

const UNAUTHENTICATED_PROTECTED_ROUTES = [
  '/library',
  '/reading/x',
  '/author/dashboard',
  '/partner/dashboard',
  '/admin/dashboard',
];

// ---------------------------------------------------------------------------
// Storage-state cache (one UI login per role, ever, per freshness window)
// ---------------------------------------------------------------------------

const AUTH_DIR = path.join(__dirname, '..', '..', '.auth');
// Supabase access tokens default to a 1h lifetime; middleware validates the
// raw access token, so refresh-token rotation does not help it. Re-login when
// the cached state is older than 45 minutes.
const STATE_MAX_AGE_MS = 45 * 60 * 1000;
const LOCK_STALE_MS = 3 * 60 * 1000;

const authFile = (role: Role) => path.join(AUTH_DIR, `${role}.json`);

function isFresh(file: string): boolean {
  try {
    return Date.now() - fs.statSync(file).mtimeMs < STATE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Acquire a cross-process lock via atomic mkdir. Prevents parallel workers
 * (or projects) from logging in the same role twice, which would burn through
 * the 5-per-15-min auth rate limit.
 */
async function withLock<T>(lockDir: string, fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      fs.mkdirSync(lockDir, { recursive: false });
      break;
    } catch {
      // Lock held by another worker. Clear it if the holder died, else wait.
      try {
        if (Date.now() - fs.statSync(lockDir).mtimeMs > LOCK_STALE_MS) {
          fs.rmdirSync(lockDir);
          continue;
        }
      } catch {
        continue; // Lock released between our check and stat; retry mkdir.
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for auth lock: ${lockDir}`);
      }
      await sleep(500);
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.rmdirSync(lockDir);
    } catch {
      // Best effort; a stale lock is reclaimed by the staleness check above.
    }
  }
}

/** Log in through the UI form, matching the selectors used in auth-flow.spec.ts. */
async function loginViaUi(page: Page, role: Role): Promise<void> {
  const { email, password } = ACCOUNTS[role];
  await page.goto('/login');

  // Scope to the sign-in form: the footer newsletter input also matches /email/i.
  const form = page.getByRole('form', { name: /sign in form/i });
  await form.getByLabel(/email/i).fill(email);
  await form.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // On success the client calls window.location.assign('/').
  try {
    await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 });
  } catch (error) {
    const alert = await page
      .getByRole('alert')
      .first()
      .textContent()
      .catch(() => null);
    throw new Error(
      `Login failed for role "${role}" (${email}).` +
        (alert ? ` Form error: ${alert.trim()}` : ' No redirect to / observed.'),
      { cause: error }
    );
  }
}

/** Return the storage-state file for a role, logging in via the UI only when needed. */
async function ensureStorageState(browser: Browser, role: Role): Promise<string> {
  const file = authFile(role);
  if (isFresh(file)) return file;

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  return withLock(`${file}.lock`, async () => {
    // Another worker may have logged in while we waited for the lock.
    if (isFresh(file)) return file;

    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await loginViaUi(page, role);
      await context.storageState({ path: file });
    } finally {
      await context.close();
    }
    return file;
  });
}

const pathnameOf = (page: Page) => new URL(page.url()).pathname;

// ---------------------------------------------------------------------------
// Unauthenticated access
// ---------------------------------------------------------------------------

test.describe('RBAC: unauthenticated', () => {
  test.skip(!hasRealSupabase(), 'Supabase not configured (middleware skips RBAC without it)');

  for (const route of UNAUTHENTICATED_PROTECTED_ROUTES) {
    test(`redirects ${route} to /login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL((url) => url.pathname.startsWith('/login'));
      expect(pathnameOf(page)).toContain('/login');
    });
  }
});

// ---------------------------------------------------------------------------
// Per-role access matrix
// ---------------------------------------------------------------------------

for (const role of Object.keys(MATRIX) as Role[]) {
  test.describe(`RBAC: ${role}`, () => {
    test.skip(!hasRealSupabase(), 'Supabase not configured (middleware skips RBAC without it)');

    let context: BrowserContext;
    let page: Page;

    test.beforeEach(async ({ browser }) => {
      const state = await ensureStorageState(browser, role);
      context = await browser.newContext({ storageState: state });
      page = await context.newPage();
    });

    test.afterEach(async () => {
      await context?.close();
    });

    for (const route of MATRIX[role].allowed) {
      test(`can access ${route}`, async () => {
        const response = await page.goto(route);
        expect(response, `expected a navigation response for ${route}`).not.toBeNull();
        expect(response!.status(), `expected 200 for ${role} on ${route}`).toBe(200);
        expect(pathnameOf(page), `expected to stay on ${route}`).toBe(route);
      });
    }

    for (const route of MATRIX[role].denied) {
      test(`is redirected to / from ${route}`, async () => {
        await page.goto(route);
        await page.waitForURL((url) => url.pathname === '/');
        expect(pathnameOf(page), `expected ${role} to be bounced from ${route}`).toBe('/');
      });
    }

    test('is redirected to / from /login', async () => {
      await page.goto('/login');
      await page.waitForURL((url) => url.pathname === '/');
      expect(pathnameOf(page)).toBe('/');
    });
  });
}
