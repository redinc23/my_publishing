import { unstable_cache } from 'next/cache';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

/**
 * Normalize a stored books.genre value to the slug used by genre tiles and
 * /genres/[genre] routes ('Sci-Fi' -> 'sci-fi', "Children's" -> 'childrens',
 * 'Non Fiction' -> 'non-fiction').
 */
export function slugifyGenre(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Real per-genre book counts for the homepage genre grid (Phase 10 — replaces
 * the fabricated marketing numbers previously hardcoded in GenreExplorer).
 * Counts only status='published' AND visibility='public' books, matching the
 * public catalog rule. Cached for 1h; tagged for invalidation with book lists.
 *
 * Returns null when the query fails so the UI can render its unavailable
 * state instead of misleading zeros (true-zero vs unavailable distinction).
 */
export const getGenreCounts = unstable_cache(
  async (): Promise<Record<string, number> | null> => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('books')
        .select('genre')
        .eq('status', 'published')
        .eq('visibility', 'public');

      if (error || !data) return null;

      const counts: Record<string, number> = {};
      for (const row of data as { genre: string | null }[]) {
        const slug = slugifyGenre(row.genre ?? '');
        if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
      }
      return counts;
    } catch {
      return null;
    }
  },
  ['genre-counts'],
  { tags: ['genre-counts', 'books-list'], revalidate: 3600 }
);
