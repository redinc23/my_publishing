import { test, expect } from '@playwright/test';

test.describe('Purchase Flow', () => {
  test('complete purchase flow', async ({ page }) => {
    // Navigate to book
    await page.goto('http://localhost:3000/books/test-book');

    // Click purchase button
    await page.click('button:has-text("Purchase")');

    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout.stripe.com/);
  });

  test('book detail page loads', async ({ page }) => {
    await page.goto('http://localhost:3000/books/test-book');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('search functionality works', async ({ page }) => {
    await page.goto('http://localhost:3000/books');
    await page.fill('input[type="search"]', 'test');
    await page.press('input[type="search"]', 'Enter');
    await expect(page).toHaveURL(/q=test/);
  });
});
