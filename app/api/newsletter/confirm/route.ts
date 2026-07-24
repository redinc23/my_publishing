import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmNewsletterSubscription } from '@/lib/email/newsletter';
import { getEmailBaseUrl } from '@/lib/email/urls';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const TokenSchema = z.string().trim().min(16).max(128);

function redirect(flag: string): NextResponse {
  return NextResponse.redirect(`${getEmailBaseUrl()}/?newsletter=${flag}`, 302);
}

/**
 * Double opt-in confirmation. Activates a pending subscription created by
 * POST /api/newsletter. Token-gated and idempotent; redirects back to the
 * site with a `?newsletter=<flag>` query the frontend can toast on.
 */
export async function GET(request: NextRequest) {
  // Fail-closed (CCR-007): when the limiter itself is unavailable the request
  // is rejected (503 + Retry-After) instead of proceeding unthrottled.
  // Confirm tokens live 7 days, so reopening the email link after a brief
  // outage still completes the double opt-in.
  let clientId = 'unknown';
  try {
    clientId = getClientIdentifier(request);
  } catch {
    // Non-standard request object — treat as a single bucket.
  }
  const rateLimitResult = await enforceRateLimit('api', clientId);
  if (!rateLimitResult.success) {
    const unavailable = rateLimitResult.reason === 'unavailable';
    return NextResponse.json(
      {
        status: 'error',
        message: unavailable
          ? 'Confirmation is temporarily unavailable. Please reopen the link in a moment.'
          : 'Too many attempts. Please try again in a minute.',
      },
      { status: unavailable ? 503 : 429, headers: rateLimitResult.headers }
    );
  }

  const parsed = TokenSchema.safeParse(request.nextUrl.searchParams.get('token') ?? '');
  if (!parsed.success) {
    return redirect('invalid');
  }

  const outcome = await confirmNewsletterSubscription(parsed.data);

  switch (outcome) {
    case 'confirmed':
    case 'already-confirmed':
      return redirect('confirmed');
    case 'expired':
      return redirect('expired');
    default:
      return redirect('invalid');
  }
}
