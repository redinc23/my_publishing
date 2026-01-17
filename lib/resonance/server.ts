import { createClient } from '@/lib/supabase/server';
import type { ResonanceRecommendation } from '@/types';

/**
 * Get recommendations for a user
 */
export async function getRecommendations(
  userId?: string,
  limit: number = 10
): Promise<ResonanceRecommendation[]> {
  const supabase = await createClient();

  let query = supabase
    .from('books')
    .select('*')
    .eq('status', 'published')
    .order('total_reads', { ascending: false })
    .limit(limit);

  const { data: books } = await query;

  return (books || []).map((book, index) => ({
    book_id: book.id,
    score: 1 - index * 0.1,
    algorithm: userId ? 'vector_similarity' : 'trending',
    metadata: {},
  }));
}
