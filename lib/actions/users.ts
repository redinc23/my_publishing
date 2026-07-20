'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getRequestAuthUser } from '@/lib/auth/request-user';
import { isMongoPrimary } from '@/lib/db/provider';
import { updateMongoProfileByAuthUserId } from '@/lib/mongo-profiles';

export async function updateProfile(updates: {
  full_name?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
}) {
  if (isMongoPrimary()) {
    const user = await getRequestAuthUser();
    if (!user) {
      return { error: 'Not authenticated' };
    }

    const profile = await updateMongoProfileByAuthUserId(user.id, {
      display_name: updates.full_name,
      bio: updates.bio,
      avatar_url: updates.avatar_url,
    });

    if (!profile) {
      return { error: 'Profile not found' };
    }

    revalidatePath('/dashboard');
    revalidateTag('featured-books');
    return { data: profile };
  }

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
