'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function followUser(targetUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('You must be logged in to follow users');
  }
  
  if (user.id === targetUserId) {
    throw new Error('You cannot follow yourself');
  }

  const { error } = await supabase
    .from('user_follows')
    .insert({
      follower_id: user.id,
      following_id: targetUserId
    });
    
  if (error) {
    if (error.code === '23505') {
      throw new Error('You are already following this user');
    }
    throw new Error('Failed to follow user');
  }
  
  // Log activity
  await supabase
    .from('user_activities')
    .insert({
      user_id: user.id,
      activity_type: 'follow',
      target_type: 'user',
      target_id: targetUserId,
      metadata: { action: 'followed' }
    });
  
  revalidatePath(`/users/${targetUserId}`);
  revalidatePath('/dashboard/following');
  
  return { success: true };
}

export async function unfollowUser(targetUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('You must be logged in to unfollow users');
  }

  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', targetUserId);
    
  if (error) {
    throw new Error('Failed to unfollow user');
  }
  
  revalidatePath(`/users/${targetUserId}`);
  revalidatePath('/dashboard/following');
  
  return { success: true };
}

export async function checkIfFollowing(targetUserId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    return false;
  }

  const { data, error } = await supabase
    .from('user_follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', targetUserId)
    .single();
    
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error checking follow status:', error);
    return false;
  }
  
  return !!data;
}

export async function getUserFollowers(userId: string, page = 1, limit = 20) {
  const supabase = await createClient();
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  
  const { data, error, count } = await supabase
    .from('user_follows')
    .select(`
      id,
      created_at,
      follower:users!user_follows_follower_id_fkey (
        id,
        username,
        full_name,
        avatar_url,
        bio
      )
    `, { count: 'exact' })
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
    
  if (error) throw error;
  
  return {
    followers: data?.map(item => item.follower) || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function getUserFollowing(userId: string, page = 1, limit = 20) {
  const supabase = await createClient();
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  
  const { data, error, count } = await supabase
    .from('user_follows')
    .select(`
      id,
      created_at,
      following:users!user_follows_following_id_fkey (
        id,
        username,
        full_name,
        avatar_url,
        bio
      )
    `, { count: 'exact' })
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
    
  if (error) throw error;
  
  return {
    following: data?.map(item => item.following) || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit)
  };
}
