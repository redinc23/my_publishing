import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const MAX_EVENT_VALUE_BYTES = 8 * 1024;
const MAX_BATCH_EVENTS = 50;

const engagementEventSchema = z
  .object({
    user_id: z.string().uuid('user_id must be a valid UUID').nullable().optional(),
    book_id: z.string().uuid('book_id must be a valid UUID'),
    event_type: z.enum([
      'view',
      'purchase',
      'read',
      'rating',
      'share',
      'wishlist',
      'impression',
      'click',
    ]),
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

const trackRequestSchema = z.union([
  engagementEventSchema,
  z.array(engagementEventSchema).min(1).max(MAX_BATCH_EVENTS),
]);

type EngagementEventInput = z.infer<typeof engagementEventSchema>;

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

    const validation = trackRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid engagement event' },
        { status: 400, headers: rateLimitResult.headers }
      );
    }

    const events: EngagementEventInput[] = Array.isArray(validation.data)
      ? validation.data
      : [validation.data];

    const supabase = await createClient();

    // engagement_events.user_id references profiles.id, not auth.users.id.
    // When a client asserts a user_id, verify the session and translate the
    // auth user id to the profile id before inserting.
    const claimedUserIds = new Set(
      events.map((event) => event.user_id).filter((id): id is string => Boolean(id))
    );

    let sessionUserId: string | null = null;
    let sessionProfileId: string | null = null;
    if (claimedUserIds.size > 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401, headers: rateLimitResult.headers }
        );
      }

      sessionUserId = user.id;
      for (const claimed of claimedUserIds) {
        if (claimed !== user.id) {
          return NextResponse.json(
            { error: 'Forbidden' },
            { status: 403, headers: rateLimitResult.headers }
          );
        }
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      sessionProfileId = profile?.id ?? null;
    }

    const adminSupabase = createAdminClient();
    const rows = events.map((event) => ({
      // Claimed user → resolved profile id; anonymous events stay null.
      // A claimed user with no profile row degrades to anonymous rather than
      // violating the FK.
      user_id: event.user_id && event.user_id === sessionUserId ? sessionProfileId : null,
      book_id: event.book_id,
      event_type: event.event_type,
      event_value: event.event_value ?? null,
    }));

    const { error } = await adminSupabase.from('engagement_events').insert(rows);

    if (error) {
      console.error('[Resonance Track] Failed to insert engagement event:', error);
      return NextResponse.json(
        { error: 'Failed to track event' },
        { status: 500, headers: rateLimitResult.headers }
      );
    }

    return NextResponse.json(
      { success: true, tracked: rows.length },
      { headers: rateLimitResult.headers }
    );
  } catch (error) {
    console.error('[Resonance Track] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: rateLimitResult.headers }
    );
  }
}
