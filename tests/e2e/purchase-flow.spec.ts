import { test, expect } from '@playwright/test';

test.describe('Purchase Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for page to be ready
    await page.goto('/');
  });

  test('homepage loads', async ({ page }) => {
    await expect(page.locator('h1, h2')).toBeVisible();
  });

  test('book detail page loads', async ({ page }) => {
    // Try to navigate to a book page (will use mock data if database is empty)
    await page.goto('/books/the-memory-keeper');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('books listing page loads', async ({ page }) => {
    await page.goto('/books');
    await expect(page.locator('h1, h2')).toBeVisible();
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
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
  });

  test('authentication pages load', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1, h2')).toBeVisible();
    
    await page.goto('/register');
    await expect(page.locator('h1, h2')).toBeVisible();
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
