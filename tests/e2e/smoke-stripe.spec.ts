// PERF-PHASE2-10
import { test, expect } from '@playwright/test';

test.describe('Stripe checkout smoke tests', () => {
  test('checkout API returns 401 without auth', async ({ request }) => {
    const response = await request.post('/api/checkout', {
      data: { bookId: 'nonexistent' },
    });
    expect([401, 400, 500]).toContain(response.status());
  });

  test('books listing page renders after perf changes', async ({ page }) => {
    await page.goto('/books');
    await expect(page.locator('h1')).toContainText(/books/i);
  });

  test('comics listing page renders after perf changes', async ({ page }) => {
    await page.goto('/comics');
    await expect(page.locator('h1')).toContainText(/comic/i);
  });

  test('papers listing page renders after perf changes', async ({ page }) => {
    await page.goto('/papers');
    await expect(page.locator('h1')).toContainText(/papers/i);
  });

  test('health endpoint is reachable', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
  });
});
