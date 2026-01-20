/**
 * Authentication Rate Limiting
 * Rate limiting specifically for authentication endpoints
 */

import { rateLimit } from './rate-limit';

/**
 * Rate limit for authentication actions (login, register, password reset)
 * Limits: 5 attempts per 15 minutes per IP/email
 */
export function authRateLimit(identifier: string): boolean {
  return rateLimit(`auth:${identifier}`, 5, 15 * 60 * 1000); // 5 attempts per 15 minutes
}

/**
 * Rate limit for password reset requests
 * Limits: 3 attempts per hour per email
 */
export function passwordResetRateLimit(email: string): boolean {
  return rateLimit(`password-reset:${email.toLowerCase()}`, 3, 60 * 60 * 1000); // 3 per hour
}

/**
 * Rate limit for email verification resend
 * Limits: 3 attempts per hour per email
 */
export function emailVerificationRateLimit(email: string): boolean {
  return rateLimit(`email-verify:${email.toLowerCase()}`, 3, 60 * 60 * 1000); // 3 per hour
}

/**
 * Get client identifier from request (IP address or email)
 */
export function getAuthIdentifier(ip: string | null, email?: string): string {
  // Use email if available, otherwise fall back to IP
  return email ? email.toLowerCase() : ip || 'unknown';
}
