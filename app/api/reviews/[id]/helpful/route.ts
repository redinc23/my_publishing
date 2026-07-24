/**
 * POST /api/reviews/[id]/helpful
 *
 * Toggle the authenticated user's helpful vote on a review.
 * Body: { helpful: boolean | null }
 *   - true/false casts (or switches) the vote
 *   - null removes the vote
 * One vote per user per review (UNIQUE(review_id, user_id)).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { validateSafe, getFirstError } from '@/lib/validations/schemas';
import { HelpfulVoteSchema } from '@/lib/validations/reviews';

export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid({ message: 'Invalid review ID' }) });

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const rateLimitResult = await enforceRateLimit('api', getClientIdentifier(request));
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
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

  const parsedParams = validateSafe(ParamsSchema, params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { success: false, error: getFirstError(parsedParams.error) },
      { status: 400 }
    );
  }
  const reviewId = parsedParams.data.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsedBody = validateSafe(HelpfulVoteSchema, body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { success: false, error: getFirstError(parsedBody.error) },
      { status: 400 }
    );
  }
  const { helpful } = parsedBody.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'You must be signed in to vote.' },
      { status: 401 }
    );
  }

  try {
    const admin = createAdminClient();

    const { data: review } = await admin
      .from('reviews')
      .select('id')
      .eq('id', reviewId)
      .maybeSingle();
    if (!review) {
      return NextResponse.json({ success: false, error: 'Review not found.' }, { status: 404 });
    }

    const { error } =
      helpful === null
        ? await admin.from('review_votes').delete().eq('review_id', reviewId).eq('user_id', user.id)
        : await admin.from('review_votes').upsert(
            {
              review_id: reviewId,
              user_id: user.id,
              is_helpful: helpful,
            },
            { onConflict: 'review_id,user_id' }
          );

    if (error) throw error;

    // Recount (idempotent alongside the sync_review_helpful_count trigger —
    // keeps counts correct even where the trigger migration is not applied).
    const { count } = await admin
      .from('review_votes')
      .select('id', { count: 'exact', head: true })
      .eq('review_id', reviewId)
      .eq('is_helpful', true);

    const helpfulCount = count ?? 0;
    await admin.from('reviews').update({ helpful_count: helpfulCount }).eq('id', reviewId);

    return NextResponse.json({
      success: true,
      data: { helpful_count: helpfulCount, user_vote: helpful },
    });
  } catch (err) {
    console.error('[api/reviews/[id]/helpful] POST failed:', err);
    return NextResponse.json(
      { success: false, error: 'Could not record your vote right now.' },
      { status: 500 }
    );
  }
}
