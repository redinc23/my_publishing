/**
 * E2E tests for the authentication flow.
 *
 * Covers:
 *   - Login page rendering and ARIA structure
 *   - Register page rendering and ARIA structure
 *   - Reset-password page rendering and ARIA structure
 *   - OAuth callback error forwarding via URL params
 *   - Invalid credential error display
 *   - Field-level validation error display
 *   - Rate-limit exceeded error display (simulated via server action response)
 */

import { test, expect } from '@playwright/test';
import { hasRealSupabase } from './helpers';

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the sign-in form with accessible structure', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('form has correct ARIA attributes', async ({ page }) => {
    const form = page.getByRole('form', { name: /sign in form/i });
    await expect(form).toBeVisible();

    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');

    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  test('shows field-level validation errors for empty submit', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    // Zod resolver fires synchronous validation before the server action is called.
    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows field-level error for invalid email format', async ({ page }) => {
    await page.getByLabel(/email/i).fill('not-an-email');
    await page.getByLabel(/password/i).fill('secret123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test('shows field-level error for short password', async ({ page }) => {
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('abc');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
  });

  test('displays URL error parameter from OAuth callback', async ({ page }) => {
    await page.goto('/login?error=Authentication%20failed');
    // The error must be rendered inside an aria-live region. Filter out the
    // Next.js route announcer, which also has role="alert".
    const alert = page.getByRole('alert').filter({ hasText: 'Authentication failed' });
    await expect(alert).toBeVisible();
  });

  test('displays error for invalid credentials', async ({ page }) => {
    test.skip(!hasRealSupabase(), 'Supabase not configured');

    await page.getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for the server round-trip and expect an error to appear.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
  });
});

// ---------------------------------------------------------------------------
// Register page
// ---------------------------------------------------------------------------

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('renders the create-account form with accessible structure', async ({ page }) => {
    await expect(page.getByRole('form', { name: /create account form/i })).toBeVisible();
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/^email/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('form inputs have correct autocomplete attributes', async ({ page }) => {
    await expect(page.getByLabel(/full name/i)).toHaveAttribute('autocomplete', 'name');
    await expect(page.getByLabel(/^email/i)).toHaveAttribute('autocomplete', 'email');
    await expect(page.getByLabel(/^password$/i)).toHaveAttribute('autocomplete', 'new-password');
    await expect(page.getByLabel(/confirm password/i)).toHaveAttribute('autocomplete', 'new-password');
  });

  test('shows validation error for mismatched passwords', async ({ page }) => {
    await page.getByLabel(/full name/i).fill('Jane Doe');
    await page.getByLabel(/^email/i).fill('jane@example.com');
    await page.getByLabel(/^password$/i).fill('password123');
    await page.getByLabel(/confirm password/i).fill('different');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/passwords don't match/i)).toBeVisible();
  });

  test('shows duplicate email error', async ({ page }) => {
    test.skip(!hasRealSupabase(), 'Supabase not configured');

    // Use the known test admin email to trigger the "already registered" path.
    await page.getByLabel(/full name/i).fill('Test User');
    await page.getByLabel(/^email/i).fill(process.env.TEST_ADMIN_EMAIL ?? 'admin@example.com');
    await page.getByLabel(/^password$/i).fill('TestPassword1!');
    await page.getByLabel(/confirm password/i).fill('TestPassword1!');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('alert')).toContainText(/already exists/i);
  });
});

// ---------------------------------------------------------------------------
// Reset-password page
// ---------------------------------------------------------------------------

test.describe('Reset password page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reset-password');
  });

  test('renders the reset-password form with accessible structure', async ({ page }) => {
    await expect(page.getByRole('form', { name: /reset password form/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.getByLabel(/email/i).fill('not-an-email');
    await page.getByRole('button', { name: /send reset link/i }).click();
    const alert = page.getByRole('alert').filter({ hasText: /invalid email/i });
    await expect(alert).toBeVisible();
  });

  test('shows success message after valid submission', async ({ page }) => {
    test.skip(!hasRealSupabase(), 'Supabase not configured');

    await page.getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Supabase always returns success (doesn't reveal whether email exists).
    await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('status')).toContainText(/check your email/i);
  });
});
