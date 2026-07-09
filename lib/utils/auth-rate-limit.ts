/**
 * Authentication Rate Limiting
 * Thin async wrappers over the unified Upstash-backed limiter (Fix C8).
 * Fail-closed: when the limiter is unavailable in production, requests are denied.
 */

import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * Rate limit for authentication actions (login, register)
 * Limits: 5 attempts per 15 minutes per IP/email
 */
export async function authRateLimit(identifier: string): Promise<boolean> {
  const result = await enforceRateLimit('authAction', `auth:${identifier}`);
  return result.success;
}

/**
 * Rate limit for password reset requests
 * Limits: 3 attempts per hour per email
 */
export async function passwordResetRateLimit(email: string): Promise<boolean> {
  const result = await enforceRateLimit('passwordReset', `password-reset:${email.toLowerCase()}`);
  return result.success;
}

/**
 * Rate limit for email verification resend
 * Limits: 3 attempts per hour per email
 */
export async function emailVerificationRateLimit(email: string): Promise<boolean> {
  const result = await enforceRateLimit('emailVerification', `email-verify:${email.toLowerCase()}`);
  return result.success;
}

/**
 * Get client identifier from request (IP address or email)
 */
export function getAuthIdentifier(ip: string | null, email?: string): string {
  // Use email if available, otherwise fall back to IP
  return email ? email.toLowerCase() : ip || 'unknown';
}
