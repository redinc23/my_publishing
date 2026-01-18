import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit';
import type { ResonanceRequest, ResonanceResponse, ResonanceRecommendation } from '@/types';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, 30, 60000);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  try {
    const body: ResonanceRequest = await request.json();
    const { user_id, limit = 10, genre, exclude_book_ids = [] } = body;

    // Validate and sanitize limit
    const validLimit = Math.min(Math.max(1, Number(limit) || 10), 100);

    // Validate exclude_book_ids - ensure all are valid UUIDs
    const validExcludeIds = Array.isArray(exclude_book_ids) 
      ? exclude_book_ids.filter(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      : [];

    const supabase = await createClient();

    let query = supabase
      .from('books')
      .select('*, author:authors!inner(*, profile:profiles!inner(*))')
      .eq('status', 'published');

    if (genre && typeof genre === 'string') {
      query = query.eq('genre', genre);
    }

    // Use proper Supabase method instead of string interpolation
    if (validExcludeIds.length > 0) {
      query = query.not('id', 'in', `(${validExcludeIds.join(',')})`);
    }

    // If user_id provided, could use vector similarity search
    // For now, return trending books
    query = query.order('total_reads', { ascending: false }).limit(validLimit);

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
