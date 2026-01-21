
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'reader' | 'author' | 'partner' | 'admin';
  subscription_tier: 'free' | 'basic' | 'premium' | 'institution';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preferences: Record<string, any> | null;
}

/**
 * Get current user, redirect to login if not authenticated
 */
export async function requireAuth() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('Error fetching user:', error);
      redirect('/login');
    }

    if (!user) {
      redirect('/login');
    }

    return user;
  } catch (error) {
    console.error('Unexpected error in requireAuth:', error);
    redirect('/login');
  }
}

/**
 * Get current user, return null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Unexpected error in getCurrentUser:', error);
    return null;
  }
}

/**
 * Get current user's profile with role information
 * Returns null if user is not authenticated or profile doesn't exist
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return profile as UserProfile;
  } catch (error) {
    console.error('Unexpected error in getUserProfile:', error);
    return null;
  }
}

/**
 * Require admin role, redirect to home if not admin
 */
export async function requireAdmin() {
  const user = await requireAuth();
  const profile = await getUserProfile();

  if (!profile || profile.role !== 'admin') {
    redirect('/');
  }

  return { user, profile };
}

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const profile = await getUserProfile();
  return (profile?.role === 'admin') || false;
}

/**
 * Check if current user has a specific role
 */
export async function hasRole(role: UserProfile['role']): Promise<boolean> {
  const profile = await getUserProfile();
  return profile?.role === role || false;
}
