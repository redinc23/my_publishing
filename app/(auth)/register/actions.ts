'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { authRateLimit, getAuthIdentifier } from '@/lib/utils/auth-rate-limit';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_DUPLICATE_EMAIL = 'admin@example.com';

type AuthActionResult = { error: string } | null;

function getRegistrationError(message: string): string {
  if (message.includes('User already registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  if (message.includes('Password')) {
    return 'Password does not meet requirements. Please choose a stronger password.';
  }

  return message;
}

export async function registerUser(formData: FormData): Promise<AuthActionResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;

  if (!email || !password || !fullName) {
    return { error: 'All fields are required' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Please enter a valid email address' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters long' };
  }

  if (fullName.trim().length < 2) {
    return { error: 'Full name must be at least 2 characters long' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedFullName = fullName.trim();

  if (process.env.USE_MOCKS === 'true') {
    const duplicateEmail = (process.env.TEST_ADMIN_EMAIL ?? DEFAULT_DUPLICATE_EMAIL).toLowerCase();

    if (normalizedEmail === duplicateEmail) {
      return { error: 'An account with this email already exists. Please sign in instead.' };
    }

    return null;
  }

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;
  const identifier = getAuthIdentifier(ip, email);

  if (!authRateLimit(identifier)) {
    return { error: 'Too many registration attempts. Please try again in 15 minutes.' };
  }

  try {
    const supabase = await createClient();

    const { error: tableCheckError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (tableCheckError) {
      if (tableCheckError.message.includes('relation "profiles" does not exist')) {
        return {
          error:
            'Database not set up. Please run migrations first. See README.md for migration instructions.',
        };
      }

      console.error('Database error during registration:', tableCheckError);
      return {
        error: 'Database connection error. Please check your configuration and try again.',
      };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: normalizedFullName,
          name: normalizedFullName,
          role: 'reader',
        },
      },
    });

    if (authError) {
      return { error: getRegistrationError(authError.message) };
    }

    if (!authData.user) {
      return { error: 'Failed to create user account. Please try again.' };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    const { data: profile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', authData.user.id)
      .single();

    if (profileCheckError || !profile) {
      console.warn('Profile not created by trigger, attempting manual creation...');
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: authData.user.id,
        email: normalizedEmail,
        full_name: normalizedFullName,
        role: 'reader',
        subscription_tier: 'free',
      });

      if (profileError && !profileError.message.includes('duplicate key')) {
        console.error('Profile creation error:', profileError);
      }
    }
  } catch (error) {
    console.error('Unexpected error during registration:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}
