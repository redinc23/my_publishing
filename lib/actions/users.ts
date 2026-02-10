'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function updateProfile(updates: {
  full_name?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard');
  revalidateTag('featured-books');
  return { data: profile };
}
