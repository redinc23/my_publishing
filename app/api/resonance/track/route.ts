import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const MAX_EVENT_VALUE_BYTES = 8 * 1024;
const engagementEventSchema = z
  .object({
    user_id: z.string().uuid('user_id must be a valid UUID').nullable().optional(),
    book_id: z.string().uuid('book_id must be a valid UUID'),
    event_type: z.enum(['view', 'purchase', 'read', 'rating', 'share', 'wishlist']),
    event_value: z
      .record(z.unknown())
      .nullable()
      .optional()
      .refine(
        (value) =>
          value == null ||
          Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_EVENT_VALUE_BYTES,
        'event_value must be no larger than 8KB'
      ),
  })
  .strict();

export async function POST(request: NextRequest) {
  const rateLimitResult = await enforceRateLimit('api', getClientIdentifier(request));
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error:
          rateLimitResult.reason === 'unavailable'
            ? 'Rate limiter unavailable. Please try again shortly.'
            : 'Rate limit exceeded. Please slow down.',
      },
      {
        status: rateLimitResult.reason === 'unavailable' ? 503 : 429,
        headers: rateLimitResult.headers,
      }
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: rateLimitResult.headers }
      );
    }

    const validation = engagementEventSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid engagement event' },
        { status: 400, headers: rateLimitResult.headers }
      );
    }

    const { user_id, book_id, event_type, event_value } = validation.data;
    const supabase = await createClient();

    if (user_id) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (user.id !== user_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase.from('engagement_events').insert({
      user_id: user_id || null,
      book_id,
      event_type,
      event_value: event_value ?? null,
    });

    if (error) {
      console.error('[Resonance Track] Failed to insert engagement event:', error);
      return NextResponse.json(
        { error: 'Failed to track event' },
        { status: 500, headers: rateLimitResult.headers }
      );
    }

    return NextResponse.json({ success: true }, { headers: rateLimitResult.headers });
  } catch (error) {
    console.error('[Resonance Track] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: rateLimitResult.headers }
    );
  }
}
