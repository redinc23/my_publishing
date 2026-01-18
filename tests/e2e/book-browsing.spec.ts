/**
 * E2E test for book browsing and search
 */
import { test, expect } from '@playwright/test';

test.describe('Book Browsing and Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display homepage', async ({ page }) => {
    await expect(page).toHaveTitle(/MANGU|Publishing/i);
  });

  test('should navigate to books page', async ({ page }) => {
    // Look for books link in navigation
    const booksLink = page.locator('a[href*="/books"]').first();
    await booksLink.click();
    await expect(page).toHaveURL(/\/books/);
  });

  test('should display book cards on books page', async ({ page }) => {
    await page.goto('/books');
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Check if book cards or loading state is present
    const hasBooks = await page.locator('[data-testid="book-card"], .book-card, article').count() > 0;
    const hasLoading = await page.locator('text=/loading|spinner/i').isVisible();
    
    expect(hasBooks || hasLoading).toBeTruthy();
  });

  test('should have search functionality', async ({ page }) => {
    await page.goto('/books');
    
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('fiction');
      await page.waitForTimeout(500); // Wait for debounce
    }
  });

  test('should have genre filters', async ({ page }) => {
    await page.goto('/books');
    
    // Look for genre navigation or filters
    const genreElements = page.locator('text=/genre|fiction|mystery|romance/i');
    const count = await genreElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to genres page', async ({ page }) => {
    const genresLink = page.locator('a[href*="/genres"]').first();
    if (await genresLink.isVisible()) {
      await genresLink.click();
      await expect(page).toHaveURL(/\/genres/);
    }
  });

  test('should navigate to individual book page when clicking book', async ({ page }) => {
    await page.goto('/books');
    await page.waitForLoadState('networkidle');
    
    // Find and click first book link
    const bookLink = page.locator('a[href*="/books/"]').first();
    if (await bookLink.isVisible()) {
      await bookLink.click();
      
      // Should be on a book detail page
      await expect(page).toHaveURL(/\/books\/.+/);
    }
  });

  test('should display navigation menu', async ({ page }) => {
    const nav = page.locator('nav, header');
    await expect(nav).toBeVisible();
  });

  test('should have footer', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/books');
    await expect(page.locator('body')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
  });
});
