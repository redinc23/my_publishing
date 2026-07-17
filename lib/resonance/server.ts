// PERF-PHASE2-7
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ResonanceRecommendation } from '@/types';

// PERF-PHASE2-7 — Cached recommendations (1h TTL, tag: resonance)
export const getRecommendations = cache(
  async (userId?: string, limit: number = 10): Promise<ResonanceRecommendation[]> => {
    return unstable_cache(
      async () => {
        const supabase = await createClient();

        const query = supabase
          .from('books')
          .select('*')
          .eq('status', 'published')
          .order('total_reads', { ascending: false })
          .limit(limit);

        const { data: books } = await query;

        return (books || []).map<ResonanceRecommendation>((book, index) => ({
          book_id: book.id,
          score: 1 - index * 0.1,
          algorithm: userId ? 'vector_similarity' : 'trending',
          metadata: {},
        }));
      },
      ['resonance-recs', userId ?? 'anon', String(limit)],
      { tags: ['resonance'], revalidate: 3600 }
    )();
  }
);
