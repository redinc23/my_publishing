import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export interface AuthorContext {
  profileId: string | null;
  role: string | null;
  authorId: string | null;
}

export async function getAuthorContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AuthorContext> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    return { profileId: null, role: null, authorId: null };
  }

  const { data: author, error: authorError } = await supabase
    .from('authors')
    .select('id')
    .eq('profile_id', profile.id)
    .single();

  if (authorError || !author) {
    return { profileId: profile.id, role: profile.role, authorId: null };
  }

  return { profileId: profile.id, role: profile.role, authorId: author.id };
}
