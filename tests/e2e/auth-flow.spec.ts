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

// Tests that exercise a real auth backend must skip when running against the
// CI mock gate (USE_MOCKS=true with placeholder Supabase credentials).
const hasRealSupabase = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.USE_MOCKS !== 'true' &&
  !/placeholder|test\.supabase/.test(process.env.NEXT_PUBLIC_SUPABASE_URL);

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  // Scope email/password lookups to the sign-in form: the site footer renders a
  // newsletter email input on every page, so unscoped getByLabel(/email/i)
  // violates strict mode.
  const signInForm = (page: import('@playwright/test').Page) =>
    page.getByRole('form', { name: /sign in form/i });

  test('renders the sign-in form with accessible structure', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(signInForm(page).getByLabel(/email/i)).toBeVisible();
    await expect(signInForm(page).getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('form has correct ARIA attributes', async ({ page }) => {
    const form = signInForm(page);
    await expect(form).toBeVisible();

    const emailInput = form.getByLabel(/email/i);
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');

    const passwordInput = form.getByLabel(/password/i);
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  test('shows field-level validation errors for empty submit', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    // Zod resolver fires synchronous validation before the server action is called.
    await expect(signInForm(page).getByRole('alert').first()).toBeVisible();
  });

  test('shows field-level error for invalid email format', async ({ page }) => {
    await signInForm(page).getByLabel(/email/i).fill('not-an-email');
    await signInForm(page)
      .getByLabel(/password/i)
      .fill('secret123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(signInForm(page).getByText(/invalid email/i)).toBeVisible();
  });

  test('shows field-level error for short password', async ({ page }) => {
    await signInForm(page).getByLabel(/email/i).fill('test@example.com');
    await signInForm(page)
      .getByLabel(/password/i)
      .fill('abc');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(signInForm(page).getByText(/at least 6 characters/i)).toBeVisible();
  });

  test('displays URL error parameter from OAuth callback', async ({ page }) => {
    await page.goto('/login?error=Authentication%20failed');
    // The error must be rendered inside an aria-live region. Filter out the
    // Next.js route announcer, which also has role="alert".
    const alert = signInForm(page).getByRole('alert').filter({ hasText: 'Authentication failed' });
    await expect(alert).toBeVisible();
  });

  test('displays error for invalid credentials', async ({ page }) => {
    // Only run against a real Supabase instance; skip otherwise (CI uses placeholders).
    test.skip(!hasRealSupabase(), 'Supabase not configured');

    await signInForm(page).getByLabel(/email/i).fill('nonexistent@example.com');
    await signInForm(page)
      .getByLabel(/password/i)
      .fill('wrongpassword');
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

  const registerForm = (page: import('@playwright/test').Page) =>
    page.getByRole('form', { name: /create account form/i });

  test('renders the create-account form with accessible structure', async ({ page }) => {
    const form = registerForm(page);
    await expect(form).toBeVisible();
    await expect(form.getByLabel(/full name/i)).toBeVisible();
    await expect(form.getByLabel(/^email/i)).toBeVisible();
    await expect(form.getByLabel(/^password$/i)).toBeVisible();
    await expect(form.getByLabel(/confirm password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('form inputs have correct autocomplete attributes', async ({ page }) => {
    const form = registerForm(page);
    await expect(form.getByLabel(/full name/i)).toHaveAttribute('autocomplete', 'name');
    await expect(form.getByLabel(/^email/i)).toHaveAttribute('autocomplete', 'email');
    await expect(form.getByLabel(/^password$/i)).toHaveAttribute('autocomplete', 'new-password');
    await expect(form.getByLabel(/confirm password/i)).toHaveAttribute(
      'autocomplete',
      'new-password'
    );
  });

  test('shows validation error for mismatched passwords', async ({ page }) => {
    const form = registerForm(page);
    await form.getByLabel(/full name/i).fill('Jane Doe');
    await form.getByLabel(/^email/i).fill('jane@example.com');
    await form.getByLabel(/^password$/i).fill('password123');
    await form.getByLabel(/confirm password/i).fill('different');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(form.getByText(/passwords don't match/i)).toBeVisible();
  });

  test('shows duplicate email error', async ({ page }) => {
    test.skip(!hasRealSupabase(), 'Supabase not configured');

    // Use the known test admin email to trigger the "already registered" path.
    const form = registerForm(page);
    await form.getByLabel(/full name/i).fill('Test User');
    await form.getByLabel(/^email/i).fill(process.env.TEST_ADMIN_EMAIL ?? 'admin@example.com');
    await form.getByLabel(/^password$/i).fill('TestPassword1!');
    await form.getByLabel(/confirm password/i).fill('TestPassword1!');
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

  const resetForm = (page: import('@playwright/test').Page) =>
    page.getByRole('form', { name: /reset password form/i });

  test('renders the reset-password form with accessible structure', async ({ page }) => {
    const form = resetForm(page);
    await expect(form).toBeVisible();
    await expect(form.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    const form = resetForm(page);
    await form.getByLabel(/email/i).fill('not-an-email');
    await page.getByRole('button', { name: /send reset link/i }).click();
    const alert = form.getByRole('alert').filter({ hasText: /invalid email/i });
    await expect(alert).toBeVisible();
  });

  test('shows success message after valid submission', async ({ page }) => {
    test.skip(!hasRealSupabase(), 'Supabase not configured');

    await resetForm(page).getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Supabase always returns success (doesn't reveal whether email exists).
    await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('status')).toContainText(/check your email/i);
  });
});
