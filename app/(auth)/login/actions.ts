'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { authRateLimit, getAuthIdentifier } from '@/lib/utils/auth-rate-limit';
import { headers } from 'next/headers';

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  // Rate limiting
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;
  const identifier = getAuthIdentifier(ip, email);
  
  if (!authRateLimit(identifier)) {
    return { error: 'Too many login attempts. Please try again in 15 minutes.' };
  }

  // Validate inputs
  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: 'Please enter a valid email address' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters long' };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      // Provide user-friendly error messages
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'Invalid email or password. Please try again.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { error: 'Please verify your email address before signing in.' };
      }
      if (error.message.includes('Too many requests')) {
        return { error: 'Too many login attempts. Please try again later.' };
      }
      return { error: error.message };
    }

    if (!data.user) {
      return { error: 'Failed to sign in. Please try again.' };
    }

    // Revalidate paths and redirect
    revalidatePath('/', 'layout');
    redirect('/');
  } catch (error) {
    console.error('Unexpected error during sign in:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}
