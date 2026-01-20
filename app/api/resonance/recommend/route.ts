/**
 * Resonance Recommendation API
 * AI-powered book recommendations with validation and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  apiRateLimit, 
  getClientIdentifier,
  createRateLimitHeaders 
} from '@/lib/utils/rate-limit';
import { RecommendRequestSchema, validateSafe, getFirstError } from '@/lib/validations/schemas';
import type { BookWithStats, ApiResponse } from '@/types';

interface RecommendationResult {
  books: BookWithStats[];
  total: number;
  algorithm: string;
}

/**
 * Get personalized book recommendations
 * POST /api/resonance/recommend
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimitResult = apiRateLimit.checkWithInfo(30, clientId);
  const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
      } satisfies ApiResponse,
      { 
        status: 429,
        headers: rateLimitHeaders,
      }
    );
  }

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
        } satisfies ApiResponse,
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // Validate input
    const validation = validateSafe(RecommendRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: getFirstError(validation.error),
        } satisfies ApiResponse,
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const { user_id, limit: limitValue, genre, exclude_book_ids } = validation.data;
    const limit = limitValue || 10;

    // Initialize Supabase client
    const supabase = await createClient();

    // Get current user if not specified
    let targetUserId = user_id;
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }

    // Build recommendation query
    let query = supabase
      .from('books')
      .select(`
        *,
        author:profiles!books_author_id_fkey(
          id,
          full_name,
          avatar_url
        ),
        stats:book_stats_summary(
          total_views,
          total_purchases,
          total_revenue
        )
      `)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by genre if specified
    if (genre) {
      query = query.eq('genre', genre);
    }

    // Exclude specified books
    if (exclude_book_ids && exclude_book_ids.length > 0) {
      query = query.not('id', 'in', `(${exclude_book_ids.join(',')})`);
    }

    // If user is authenticated, exclude their own books and purchased books
    if (targetUserId) {
      // Exclude user's own books
      query = query.neq('author_id', targetUserId);

      // Get user's purchased books
      const { data: purchasedBooks } = await supabase
        .from('orders')
        .select('book_id')
        .eq('user_id', targetUserId)
        .eq('status', 'completed');

      if (purchasedBooks && purchasedBooks.length > 0) {
        const purchasedIds = purchasedBooks.map(p => p.book_id);
        query = query.not('id', 'in', `(${purchasedIds.join(',')})`);
      }
    }

    // Execute query
    const { data: books, error: queryError } = await query;

    if (queryError) {
      console.error('[Recommend] Query error:', queryError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch recommendations',
        } satisfies ApiResponse,
        { status: 500, headers: rateLimitHeaders }
      );
    }

    // Transform results
    const transformedBooks: BookWithStats[] = (books || []).map((book) => ({
      ...book,
      stats: {
        views: book.stats?.total_views || 0,
        purchases: book.stats?.total_purchases || 0,
        revenue: book.stats?.total_revenue || 0,
      },
    }));

    // Apply scoring algorithm (basic implementation)
    const scoredBooks = transformedBooks.map((book) => {
      // Simple scoring: views + (purchases * 10) + recency bonus
      const recencyDays = Math.floor(
        (Date.now() - new Date(book.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const recencyBonus = Math.max(0, 30 - recencyDays) * 5;
      
      const score = 
        (book.stats?.views || 0) + 
        ((book.stats?.purchases || 0) * 10) + 
        recencyBonus;

      return { ...book, _score: score };
    });

    // Sort by score
    scoredBooks.sort((a, b) => (b._score || 0) - (a._score || 0));

    // Remove internal score from response
    const finalBooks = scoredBooks.map(({ _score, ...book }) => book);

    const duration = Date.now() - startTime;
    console.log(`[Recommend] Returned ${finalBooks.length} recommendations in ${duration}ms`);

    const result: RecommendationResult = {
      books: finalBooks,
      total: finalBooks.length,
      algorithm: 'popularity_recency_v1',
    };

    return NextResponse.json(
      {
        success: true,
        data: result,
      } satisfies ApiResponse<RecommendationResult>,
      { 
        status: 200,
        headers: rateLimitHeaders,
      }
    );
  } catch (error) {
    console.error('[Recommend] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } satisfies ApiResponse,
      { status: 500, headers: rateLimitHeaders }
    );
  }
}

/**
 * Get recommendations via GET (simpler usage)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  
  const body = {
    limit: parseInt(searchParams.get('limit') || '10'),
    genre: searchParams.get('genre') || undefined,
    exclude_book_ids: searchParams.get('exclude')?.split(',').filter(Boolean) || [],
  };

  // Convert to POST request internally
  const postRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(body),
  });

  return POST(postRequest);
}

/**
 * Handle OPTIONS for CORS preflight
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}