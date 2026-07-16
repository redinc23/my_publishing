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

  test('unauthenticated user is redirected from protected routes', async ({ page }) => {
    await page.goto('/library');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('session API is reachable', async ({ request }) => {
    const response = await request.get('/api/session');
    expect([200, 401]).toContain(response.status());
  });
});
