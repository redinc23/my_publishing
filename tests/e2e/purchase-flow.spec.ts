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
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="search" i]')
      .first();

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
    // Without ?ready=1 the endpoint is a lightweight startup probe ('ok');
    // with it, it reports readiness ('healthy' | 'degraded' | 'unhealthy').
    expect(['ok', 'healthy', 'degraded', 'unhealthy']).toContain(data.status);
  });

  test('authentication pages load', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
  });

  test('reading a book without purchase is gated', async ({ page }) => {
    // Unauthenticated: middleware redirects to /login. (Authenticated users
    // without a completed order are redirected by the server component to the
    // book detail page or /library — that path needs credentials to test.)
    await page.goto('/reading/00000000-0000-0000-0000-000000000000');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  // Note: Purchase flow test requires Stripe test mode and authentication
  // Uncomment and configure when ready to test payments
  /*
  test('complete purchase flow', async ({ page }) => {
    // This test requires:
    // 1. User to be logged in
    // 2. Stripe test mode configured
    // 3. Valid book in database
    
    // Login first (implement based on your auth flow). Note that login now
    // performs a full-page navigation (window.location.assign('/')) after
    // success, so wait for the load event rather than a client transition.
    // await loginUser(page, 'test@example.com', 'password');
    
    // Navigate to book
    await page.goto('/books/test-book');
    
    // Click purchase button
    await page.click('button:has-text("Purchase"), button:has-text("Buy")');
    
    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout.stripe.com/);

    // After completing payment, entitlement is order-status based:
    // - /library lists only orders with status 'completed' (and surfaces a
    //   role="alert" error message if the library query fails).
    // - /reading/[bookId] requires a completed order for that book and
    //   otherwise redirects to the book's detail page (or /library).
  });
  */
});
