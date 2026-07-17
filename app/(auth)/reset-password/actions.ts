'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { passwordResetRateLimit } from '@/lib/utils/auth-rate-limit';

function normalizeOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.trim().replace(/\/+$/, '');
}

async function resolveAuthOrigin() {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'http';
  const requestOrigin = host ? `${proto}://${host.split(',')[0].trim()}` : null;
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const vercelUrl = normalizeOrigin(process.env.VERCEL_URL);

  if (requestOrigin) {
    return normalizeOrigin(requestOrigin)!;
  }

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, '')}`;
  }

  return 'http://localhost:3001';
}

function toFriendlyResetError(message: string) {
  if (/too many requests|rate limit|security purposes/i.test(message)) {
    return 'We recently sent a reset email. Please wait a minute before trying again.';
  }

  if (
    /email.*quota|quota.*email|email.*temporarily unavailable|smtp|error sending/i.test(message)
  ) {
    return 'Password reset email delivery is temporarily unavailable. Please try again later.';
  }

  return message;
}

export async function resetPassword(formData: FormData) {
  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Email is required' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { error: 'Please enter a valid email address' };
  }

  // Rate limiting for password reset
  if (!(await passwordResetRateLimit(normalizedEmail))) {
    return { error: 'Too many password reset requests. Please try again in an hour.' };
  }

  try {
    const supabase = await createClient();
    const baseUrl = await resolveAuthOrigin();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${baseUrl}/reset-password/confirm`,
    });

    if (error) {
      return { error: toFriendlyResetError(error.message) };
    }
  } catch (error) {
    console.error('Unexpected error requesting password reset:', error);
    return { error: 'We could not start the password reset request. Please try again.' };
  }

  return { success: true };
}
