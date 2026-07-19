import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isEmailConfigured } from '@/lib/email/send';
import { startNewsletterSubscription } from '@/lib/email/newsletter';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const SubscribeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(320, 'Enter a valid email address.')
    .email('Enter a valid email address.'),
});

/** Identifier for rate limiting that tolerates non-standard request objects. */
function clientIdentifier(request: NextRequest): string {
  try {
    return getClientIdentifier(request);
  } catch {
    return 'unknown';
  }
}

/**
 * Newsletter subscription with double opt-in (P0-013, G6).
 *
 * Flow: the address is stored as 'pending' and a one-time confirmation link
 * is emailed; the subscription only activates via /api/newsletter/confirm.
 * Re-subscribing is idempotent (200, no duplicate row, no state leak).
 *
 * Honest-scope contract (unchanged):
 *   - Email provider not configured → 503 { status: 'disabled' }.
 *   - Rate limited                  → 429 { status: 'error' }.
 *   - Provider/DB errors            → 502 { status: 'error' }.
 *   - Confirm email sent            → 200 { status: 'success' }.
 */
export async function POST(request: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { status: 'disabled', message: 'Newsletter signups are not available yet.' },
      { status: 503 }
    );
  }

  // Rate limit: this endpoint can trigger outbound email, so it is
  // fail-closed when the limiter is unreachable (email-bombing guard).
  const rateLimitResult = await enforceRateLimit('api', clientIdentifier(request));
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        status: rateLimitResult.reason === 'unavailable' ? 'disabled' : 'error',
        message:
          rateLimitResult.reason === 'unavailable'
            ? 'Newsletter signups are temporarily unavailable.'
            : 'Too many attempts. Please try again in a minute.',
      },
      { status: rateLimitResult.reason === 'unavailable' ? 503 : 429, headers: rateLimitResult.headers }
    );
  }

  let email: string;
  try {
    const parsed = SubscribeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { status: 'error', message: 'Enter a valid email address.' },
        { status: 400 }
      );
    }
    email = parsed.data.email;
  } catch {
    return NextResponse.json({ status: 'error', message: 'Invalid request.' }, { status: 400 });
  }

  const outcome = await startNewsletterSubscription(email);

  if (outcome.status === 'error') {
    return NextResponse.json(
      { status: 'error', message: 'Could not subscribe right now. Please try again later.' },
      { status: 502 }
    );
  }

  // 'sent', 'already-confirmed', and 'legacy' all resolve 200 — the response
  // never reveals whether an address was already subscribed.
  return NextResponse.json(
    { status: 'success', message: 'Check your inbox to confirm your subscription.' },
    { status: 200 }
  );
}
