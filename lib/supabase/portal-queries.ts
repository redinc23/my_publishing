import { createClient as createAdminClient } from '@/lib/supabase/admin';

/**
 * Portal (authenticated) data access helpers.
 *
 * The `authors` table has RLS enabled with no SELECT policy, so even a
 * signed-in author cannot read their own `authors` row through the
 * cookie-based client. RLS policies on `manuscripts`/`books` still work
 * (their subqueries against `authors` run with table-owner privileges),
 * but the author id itself must be resolved with the admin client.
 *
 * Chain: auth user id -> profiles.user_id -> profiles.id -> authors.profile_id
 */
export async function getAuthorForUser(userId: string) {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!profile) return null;

  const { data: author } = await admin
    .from('authors')
    .select('id, profile_id, pen_name, bio, is_verified, total_books, photo_url, created_at')
    .eq('profile_id', profile.id)
    .single();

  return author;
}

/**
 * Chain: auth user id -> profiles.user_id -> profiles.id -> partners.profile_id
 */
export async function getPartnerForUser(userId: string) {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!profile) return null;

  const { data: partner } = await admin
    .from('partners')
    .select('id, profile_id, institution_name, subscription_plan, created_at, updated_at')
    .eq('profile_id', profile.id)
    .single();

  return partner;
}
