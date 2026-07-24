import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { getResonanceSimilarBooks } from '@/lib/resonance/recommendations';
import type { BookWithAuthor } from '@/types';

// Reads cookies transitively via the admin client factory; never cache per-user.
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SimilarItemPayload {
  book: BookWithAuthor;
  reason: string;
  score: number;
  algorithm: string;
}

/**
 * "Readers also enjoyed" — vector similarity with fallback discipline:
 * pgvector cosine → same-genre popularity → global popularity.
 *
 * GET /api/resonance/similar?bookId=<uuid>&limit=6
 * (book_id is accepted as a legacy alias)
 *
 * Works without OPENAI_API_KEY: with no embeddings the vector stage returns
 * nothing and the SQL fallbacks answer instead.
 */
export async function GET(request: NextRequest) {
  // Rate limiting (fail-closed, Fix C8)
  const rateLimitResult = await enforceRateLimit('api', getClientIdentifier(request));
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error:
          rateLimitResult.reason === 'unavailable'
            ? 'Rate limiter unavailable. Please try again shortly.'
            : 'Rate limit exceeded. Please try again later.',
      },
      {
        status: rateLimitResult.reason === 'unavailable' ? 503 : 429,
        headers: rateLimitResult.headers,
      }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get('bookId') ?? searchParams.get('book_id');
    const limit = parseInt(searchParams.get('limit') || '6');

    if (!bookId) {
      return NextResponse.json(
        { error: 'bookId is required' },
        { status: 400, headers: rateLimitResult.headers }
      );
    }

    if (!UUID_PATTERN.test(bookId)) {
      return NextResponse.json(
        { error: 'Invalid bookId' },
        { status: 400, headers: rateLimitResult.headers }
      );
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'limit must be an integer between 1 and 50' },
        { status: 400, headers: rateLimitResult.headers }
      );
    }

    const { items, algorithm } = await getResonanceSimilarBooks(bookId, limit);

    const payload: SimilarItemPayload[] = items.map((item) => ({
      book: item.book,
      reason: item.reason,
      score: item.score,
      algorithm: item.algorithm,
    }));

    return NextResponse.json(
      {
        // Back-compat: `data` stays a bare book array.
        data: items.map((item) => item.book),
        items: payload,
        algorithm,
      },
      {
        headers: {
          ...rateLimitResult.headers,
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('[Resonance Similar] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to load similar books' },
      { status: 500, headers: rateLimitResult.headers }
    );
  }
}
