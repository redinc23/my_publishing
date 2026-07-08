'use server';

import { createClient } from '@/lib/supabase/server';
import { passwordResetRateLimit } from '@/lib/utils/auth-rate-limit';

type AuthActionResult = { error: string } | null;

export async function resetPassword(formData: FormData): Promise<AuthActionResult> {
  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Email is required' };
  }

  if (process.env.USE_MOCKS === 'true') {
    return null;
  }

  if (!passwordResetRateLimit(email)) {
    return { error: 'Too many password reset requests. Please try again in an hour.' };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const redirectTo = `${siteUrl}/reset-password/confirm`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { error: error.message };
  }

  return null;
}
