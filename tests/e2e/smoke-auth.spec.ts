// PERF-PHASE2-10
import { test, expect } from '@playwright/test';

test.describe('Auth smoke tests (post-perf)', () => {
  test('login page loads after perf changes', async ({ page }) => {
    await page.goto('/login');
    // Scope to the sign-in form: the footer newsletter input also matches /email/i.
    const form = page.getByRole('form', { name: /sign in form/i });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(form.getByLabel(/email/i)).toBeVisible();
    await expect(form.getByLabel(/password/i)).toBeVisible();
  });

  test('register page loads after perf changes', async ({ page }) => {
    await page.goto('/register');
    const form = page.getByRole('form', { name: /create account form/i });
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
    await expect(form.getByLabel(/^email/i)).toBeVisible();
  });

  test('unauthenticated user is redirected from the library', async ({ page }) => {
    await page.goto('/library');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated user is redirected from the reading route', async ({ page }) => {
    // /reading/[bookId] requires auth (middleware) and, once authenticated, a
    // completed-order entitlement (server component redirects to the book page
    // or /library otherwise). Unauthenticated access must land on /login.
    await page.goto('/reading/00000000-0000-0000-0000-000000000000');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('verify-email page renders without a session when email is supplied', async ({ page }) => {
    // Resend verification no longer requires a session; registration passes
    // the address via /verify-email?email=.
    await page.goto('/verify-email?email=smoke%40example.com');
    await expect(page.getByRole('heading', { name: /verify your email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /resend verification email/i })).toBeVisible();
  });

  test('partner and admin portals are auth-gated', async ({ page }) => {
    // Portal pages (including the ARC list, whose status filter now uses the
    // DB value 'rejected') render explicit error states for signed-in users on
    // query failure; anonymous visitors are redirected by middleware.
    await page.goto('/partner/arc-requests?status=rejected');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');

    await page.goto('/admin/dashboard');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('session API is reachable', async ({ request }) => {
    const response = await request.get('/api/session');
    expect([200, 401]).toContain(response.status());
  });
});
