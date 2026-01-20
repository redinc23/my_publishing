'use server';

import { createClient } from '@/lib/supabase/server';
import { emailVerificationRateLimit } from '@/lib/utils/auth-rate-limit';

export async function resendVerificationEmail(email: string) {
  // Rate limiting
  if (!emailVerificationRateLimit(email)) {
    return { error: 'Too many verification email requests. Please try again in an hour.' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'You must be logged in to resend verification email.' };
    }

    if (user.email !== email) {
      return { error: 'Email mismatch.' };
    }

    if (user.email_confirmed_at) {
      return { error: 'Email is already verified.' };
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) {
      console.error('Error resending verification email:', error);
      return { error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error resending verification email:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}
