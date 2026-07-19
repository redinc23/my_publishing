import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_EMAIL_PREFERENCES,
  isMissingTableError,
} from '@/lib/email/preferences';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const PreferencesSchema = z
  .object({
    marketing: z.boolean(),
    receipts: z.boolean(),
    author_alerts: z.boolean(),
  })
  .partial();

function unavailableResponse() {
  return NextResponse.json(
    {
      error: 'email-preferences-unavailable',
      message: 'Email preferences are not available yet.',
    },
    { status: 503 }
  );
}

/**
 * GET /api/email/preferences — the signed-in user's email preferences.
 * Resolves to defaults (with persisted: false) when no row exists or the
 * email_preferences table hasn't been migrated yet.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('email_preferences')
    .select('marketing, receipts, author_alerts')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ preferences: DEFAULT_EMAIL_PREFERENCES, persisted: false });
    }
    console.error('[email-preferences] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }

  return NextResponse.json({
    preferences: data ?? DEFAULT_EMAIL_PREFERENCES,
    persisted: Boolean(data),
  });
}

/**
 * PUT /api/email/preferences — upsert the signed-in user's preferences.
 * The user id is always taken from the session, never from the client.
 */
export async function PUT(request: NextRequest) {
  let clientId = 'unknown';
  try {
    clientId = getClientIdentifier(request);
  } catch {
    // Non-standard request object — treat as a single bucket.
  }
  const rateLimitResult = await enforceRateLimit('api', clientId);
  if (!rateLimitResult.success && rateLimitResult.reason === 'limited') {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again in a minute.' },
      { status: 429, headers: rateLimitResult.headers }
    );
  }

  let input: z.infer<typeof PreferencesSchema>;
  try {
    const parsed = PreferencesSchema.safeParse(await request.json());
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'Invalid preferences payload' }, { status: 400 });
    }
    input = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('email_preferences')
    .upsert(
      { user_id: user.id, ...input },
      { onConflict: 'user_id' }
    )
    .select('marketing, receipts, author_alerts')
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      return unavailableResponse();
    }
    console.error('[email-preferences] PUT failed:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }

  return NextResponse.json({ preferences: data, persisted: true });
}
