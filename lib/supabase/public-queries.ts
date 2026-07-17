import { createClient as createAdminClient } from '@/lib/supabase/admin';

/**
 * Public catalog data access.
 *
 * The `authors` table has RLS enabled with no SELECT policy and `profiles`
 * only allows self-view, so anonymous (and even authenticated) visitors can
 * never read author info through the cookie-based client. Public catalog
 * queries therefore use the admin client — the same pattern already used by
 * getFeaturedBooks/getBooksPage — with two safety rules:
 *
 * 1. Always filter books to status='published' AND visibility='public'.
 * 2. Only select the safe columns below. Never `profiles(*)` — profiles
 *    contains emails and preferences that must not reach the client.
 */
export function createPublicCatalogClient() {
  return createAdminClient();
}

/** Safe, public-facing profile columns (no email/preferences). */
export const PUBLIC_PROFILE_COLUMNS = 'full_name';

/** Safe, public-facing author columns (no royalty_rate). */
export const PUBLIC_AUTHOR_COLUMNS = `id, profile_id, pen_name, bio, is_verified, total_books, photo_url, created_at, profile:profiles(${PUBLIC_PROFILE_COLUMNS})`;

/** Book select with a left-joined public author. */
export const PUBLIC_BOOK_SELECT = `*, author:authors(${PUBLIC_AUTHOR_COLUMNS})`;

/** Book select including book_content (samples/toc; table is not RLS-protected). */
export const PUBLIC_BOOK_WITH_CONTENT_SELECT = `${PUBLIC_BOOK_SELECT}, content:book_content(*)`;
