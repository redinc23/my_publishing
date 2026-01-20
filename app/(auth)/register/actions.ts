'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { authRateLimit, getAuthIdentifier } from '@/lib/utils/auth-rate-limit';
import { headers } from 'next/headers';

export async function registerUser(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;

  // Rate limiting
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;
  const identifier = getAuthIdentifier(ip, email);
  
  if (!authRateLimit(identifier)) {
    return { error: 'Too many registration attempts. Please try again in 15 minutes.' };
  }

  // Validate inputs
  if (!email || !password || !fullName) {
    return { error: 'All fields are required' };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: 'Please enter a valid email address' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters long' };
  }

  if (fullName.trim().length < 2) {
    return { error: 'Full name must be at least 2 characters long' };
  }

  try {
    const supabase = await createClient();

    // Check if profiles table exists by attempting a simple query
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
      // Other database errors
      console.error('Database error during registration:', tableCheckError);
      return {
        error: 'Database connection error. Please check your configuration and try again.',
      };
    }

    // Create auth user with metadata for profile creation trigger
    // The trigger will automatically create the profile
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          name: fullName.trim(), // Some OAuth providers use 'name'
          role: 'reader',
        },
      },
    });

    if (authError) {
      // Provide user-friendly error messages
      if (authError.message.includes('User already registered')) {
        return { error: 'An account with this email already exists. Please sign in instead.' };
      }
      if (authError.message.includes('Password')) {
        return { error: 'Password does not meet requirements. Please choose a stronger password.' };
      }
      return { error: authError.message };
    }

    if (!authData.user) {
      return { error: 'Failed to create user account. Please try again.' };
    }

    // Profile will be created automatically by the trigger
    // Verify it was created (with a small delay to allow trigger to run)
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const { data: profile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', authData.user.id)
      .single();

    if (profileCheckError || !profile) {
      console.warn('Profile not created by trigger, attempting manual creation...');
      // Fallback: manually create profile if trigger didn't work
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: authData.user.id,
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        role: 'reader',
        subscription_tier: 'free',
      });

      if (profileError && !profileError.message.includes('duplicate key')) {
        console.error('Profile creation error:', profileError);
        // Don't fail registration if profile creation fails - user can complete setup later
      }
    }

    // Revalidate paths
    revalidatePath('/', 'layout');

    // Redirect to home page after successful registration
    // Note: User may need to verify email depending on Supabase settings
    redirect('/');
  } catch (error) {
    console.error('Unexpected error during registration:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}
