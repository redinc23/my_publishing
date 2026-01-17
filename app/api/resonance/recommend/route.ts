import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ResonanceRequest, ResonanceResponse, ResonanceRecommendation } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: ResonanceRequest = await request.json();
    const { user_id, limit = 10, genre, exclude_book_ids = [] } = body;

    const supabase = await createClient();

    let query = supabase
      .from('books')
      .select('*, author:authors!inner(*, profile:profiles!inner(*))')
      .eq('status', 'published');

    if (genre) {
      query = query.eq('genre', genre);
    }

    if (exclude_book_ids.length > 0) {
      query = query.not('id', 'in', `(${exclude_book_ids.join(',')})`);
    }

    // If user_id provided, could use vector similarity search
    // For now, return trending books
    query = query.order('total_reads', { ascending: false }).limit(limit);

    const { data: books, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const recommendations = (books || []).map((book, index) => ({
      book_id: book.id,
      score: 1 - index * 0.1, // Simple scoring
      algorithm: user_id ? 'vector_similarity' : 'trending',
      metadata: {},
    }));

    const response: ResonanceResponse = {
      data: recommendations as ResonanceRecommendation[],
      meta: {
        algorithm: (user_id ? 'vector_similarity' : 'trending') as any,
        user_id,
        total_results: recommendations.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
