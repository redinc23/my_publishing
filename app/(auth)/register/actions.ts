'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { authRateLimit, getAuthIdentifier } from '@/lib/utils/auth-rate-limit';
import { headers } from 'next/headers';

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

export function toFriendlyRegisterError(message: string) {
  if (message.includes('User already registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  if (message.includes('Password')) {
    return 'Password does not meet requirements. Please choose a stronger password.';
  }

  if (/email.*(invalid|validate)|invalid.*email/i.test(message)) {
    return 'Please use a valid email address that can receive email.';
  }

  if (
    /email rate limit exceeded|over_email_send_rate_limit|email.*quota|quota.*email|email.*temporarily unavailable|smtp|error sending/i.test(
      message
    )
  ) {
    return 'Verification email delivery is temporarily unavailable because the email provider is throttling messages. Please try again later.';
  }

  if (/too many requests|rate limit|security purposes/i.test(message)) {
    return 'Too many registration attempts. Please wait a minute and try again.';
  }

  return message;
}

export async function registerUser(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;

  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  // Rate limiting
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;
  const identifier = getAuthIdentifier(ip, normalizedEmail);

  if (!(await authRateLimit(identifier))) {
    return { error: 'Too many registration attempts. Please try again in 15 minutes.' };
  }

  // Validate inputs
  if (!email || !password || !fullName) {
    return { error: 'All fields are required' };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
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
    const { error: tableCheckError } = await supabase.from('profiles').select('id').limit(1);

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
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${await resolveAuthOrigin()}/callback`,
        data: {
          full_name: fullName.trim(),
          name: fullName.trim(), // Some OAuth providers use 'name'
          role: 'reader',
        },
      },
    });

    if (authError) {
      return { error: toFriendlyRegisterError(authError.message) };
    }

    if (!authData.user) {
      return { error: 'Failed to create user account. Please try again.' };
    }

    // When Supabase requires email confirmation there is no session yet, so
    // the browser gets no auth cookies — surface that to the client.
    const needsVerification = !authData.session;

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
      // Fallback: use admin client to bypass RLS (session client has no auth when
      // email confirmation is required and authData.session is null).
      const admin = createAdminClient();
      const { error: profileError } = await admin.from('profiles').insert({
        user_id: authData.user.id,
        email: normalizedEmail,
        full_name: fullName.trim(),
        role: 'reader',
        subscription_tier: 'free',
      });

      if (profileError && !profileError.message.includes('duplicate key')) {
        console.error('Profile creation error:', profileError);
        // Don't fail registration if profile creation fails - user can complete setup later
      }
    }

    revalidatePath('/', 'layout');

    return {
      success: true,
      needsVerification,
      verificationEmail: needsVerification ? normalizedEmail : undefined,
    };
  } catch (error) {
    console.error('Unexpected error during registration:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}
