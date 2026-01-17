'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function registerUser(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;

  if (!email || !password || !fullName) {
    return { error: 'All fields are required' };
  }

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: 'Failed to create user' };
  }

  // Create profile
  const { error: profileError } = await supabase.from('profiles').insert({
    user_id: authData.user.id,
    email,
    full_name: fullName,
    role: 'reader',
    subscription_tier: 'free',
  });

  if (profileError) {
    return { error: 'Failed to create profile' };
  }

  revalidatePath('/', 'layout');
  return null;
}
