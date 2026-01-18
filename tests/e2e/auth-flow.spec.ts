/**
 * E2E test for user registration and authentication flow
 */
import { test, expect } from '@playwright/test';

test.describe('User Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to registration page', async ({ page }) => {
    await page.click('text=Sign Up');
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('h1, h2').filter({ hasText: /register|sign up/i })).toBeVisible();
  });

  test('should show validation errors for invalid registration', async ({ page }) => {
    await page.goto('/register');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should see validation errors
    await expect(page.locator('text=/email.*required/i')).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.click('text=Login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1, h2').filter({ hasText: /login|sign in/i })).toBeVisible();
  });

  test('should show validation errors for invalid login', async ({ page }) => {
    await page.goto('/login');
    
    // Enter invalid credentials
    await page.fill('input[type="email"]', 'invalid@email');
    await page.fill('input[type="password"]', '123');
    await page.click('button[type="submit"]');
    
    // Should see error message
    await expect(page.locator('text=/invalid|error/i')).toBeVisible({ timeout: 5000 });
  });

  test('should have password reset link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('a[href*="reset"]')).toBeVisible();
  });

  test('should navigate to password reset page', async ({ page }) => {
    await page.goto('/login');
    await page.click('a[href*="reset"]');
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test('registration form should have all required fields', async ({ page }) => {
    await page.goto('/register');
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login form should have all required fields', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should toggle between login and registration', async ({ page }) => {
    await page.goto('/login');
    
    // Find link to registration
    const registerLink = page.locator('a[href*="register"]');
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/\/register/);
      
      // Find link back to login
      const loginLink = page.locator('a[href*="login"]');
      if (await loginLink.isVisible()) {
        await loginLink.click();
        await expect(page).toHaveURL(/\/login/);
      }
    }
  });
});
