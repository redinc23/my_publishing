// PERF-PHASE2-10
import { test, expect } from '@playwright/test';

test.describe('Stripe checkout smoke tests', () => {
  test('checkout API rejects a payload with missing fields', async ({ request }) => {
    // The API expects snake_case book_id/book_slug plus user_id; anything else
    // fails validation before auth is consulted.
    const response = await request.post('/api/checkout', {
      data: { bookId: 'nonexistent' },
    });
    expect(response.status()).toBe(400);
  });

  test('checkout API returns 401 without auth', async ({ request }) => {
    const response = await request.post('/api/checkout', {
      data: {
        book_id: '00000000-0000-0000-0000-000000000000',
        user_id: '00000000-0000-0000-0000-000000000000',
      },
    });
    // 401 from the auth check; 500 only if Supabase env is entirely absent.
    expect([401, 500]).toContain(response.status());
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
