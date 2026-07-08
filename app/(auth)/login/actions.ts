'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { authRateLimit, getAuthIdentifier } from '@/lib/utils/auth-rate-limit';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthActionResult = { error: string } | null;

function getSignInError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.';
  }

  if (message.includes('Email not confirmed')) {
    return 'Please verify your email address before signing in.';
  }

  if (message.includes('Too many requests')) {
    return 'Too many login attempts. Please try again later.';
  }

  return message;
}

export async function signIn(formData: FormData): Promise<AuthActionResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Please enter a valid email address' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters long' };
  }

  if (process.env.USE_MOCKS === 'true') {
    return { error: 'Invalid email or password. Please try again.' };
  }

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;
  const identifier = getAuthIdentifier(ip, email);

  if (!authRateLimit(identifier)) {
    return { error: 'Too many login attempts. Please try again in 15 minutes.' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return { error: getSignInError(error.message) };
    }

    if (!data.user) {
      return { error: 'Failed to sign in. Please try again.' };
    }
  } catch (error) {
    console.error('Unexpected error during sign in:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}
