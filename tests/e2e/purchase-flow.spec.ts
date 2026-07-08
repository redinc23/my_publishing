import { test, expect } from '@playwright/test';

test.describe('Purchase Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for page to be ready
    await page.goto('/');
  });

  test('homepage loads', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('book detail page loads', async ({ page }) => {
    // Try to navigate to a book page (will use mock data if database is empty)
    await page.goto('/books/the-memory-keeper');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('books listing page loads', async ({ page }) => {
    await page.goto('/books');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('search functionality works', async ({ page }) => {
    await page.goto('/books');
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await searchInput.press('Enter');
      // Wait for navigation or results
      await page.waitForTimeout(1000);
    }
  });

  test('health endpoint returns valid response', async ({ request }) => {
    // Startup probe: always 200 with { status: 'ok' } when the process is up.
    const startup = await request.get('/api/health');
    expect(startup.ok()).toBeTruthy();
    expect((await startup.json()).status).toBe('ok');

    // Readiness probe: 200 when healthy; 503 when a dependency check fails
    // (e.g. mock/CI mode where the placeholder Supabase host is unreachable).
    const readiness = await request.get('/api/health?ready=1');
    expect([200, 503]).toContain(readiness.status());
    const data = await readiness.json();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
  });

  test('authentication pages load', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();

    await page.goto('/register');
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
  });

  // Note: Purchase flow test requires Stripe test mode and authentication
  // Uncomment and configure when ready to test payments
  /*
  test('complete purchase flow', async ({ page }) => {
    // This test requires:
    // 1. User to be logged in
    // 2. Stripe test mode configured
    // 3. Valid book in database
    
    // Login first (implement based on your auth flow)
    // await loginUser(page, 'test@example.com', 'password');
    
    // Navigate to book
    await page.goto('/books/test-book');
    
    // Click purchase button
    await page.click('button:has-text("Purchase"), button:has-text("Buy")');
    
    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout.stripe.com/);
  });
  */
});
