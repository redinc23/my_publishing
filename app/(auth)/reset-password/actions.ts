'use server';

import { createClient } from '@/lib/supabase/server';
import { passwordResetRateLimit } from '@/lib/utils/auth-rate-limit';

export async function resetPassword(formData: FormData) {
  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Email is required' };
  }

  // Rate limiting for password reset
  if (!passwordResetRateLimit(email)) {
    return { error: 'Too many password reset requests. Please try again in an hour.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password/confirm`,
  });

  if (error) {
    return { error: error.message };
  }

  return null;
}
