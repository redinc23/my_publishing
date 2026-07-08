// PERF-PHASE2-10
import { test, expect } from '@playwright/test';

test.describe('Auth smoke tests (post-perf)', () => {
  test('login page loads after perf changes', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('register page loads after perf changes', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
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
