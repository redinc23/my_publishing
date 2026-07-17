'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { emailVerificationRateLimit } from '@/lib/utils/auth-rate-limit';

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

function toFriendlyResendError(message: string) {
  if (/too many requests|rate limit|security purposes/i.test(message)) {
    return 'We recently sent a verification email. Please wait a minute before trying again.';
  }

  if (
    /email.*quota|quota.*email|email.*temporarily unavailable|smtp|error sending/i.test(message)
  ) {
    return 'Verification email delivery is temporarily unavailable. Please try again later.';
  }

  return message;
}

export async function resendVerificationEmail(email: string) {
  const normalizedEmail = email?.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
    return { error: 'Please provide a valid email address.' };
  }

  // Rate limiting
  if (!(await emailVerificationRateLimit(normalizedEmail))) {
    return { error: 'Too many verification email requests. Please try again in an hour.' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email?.trim().toLowerCase() === normalizedEmail && user.email_confirmed_at) {
      return { error: 'Your email is already verified. You can continue to the app.' };
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${await resolveAuthOrigin()}/callback`,
      },
    });

    if (error) {
      console.error('Error resending verification email:', error);
      return { error: toFriendlyResendError(error.message) };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error resending verification email:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}
