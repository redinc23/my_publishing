import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { unsubscribeByToken } from '@/lib/email/newsletter';
import { getEmailBaseUrl } from '@/lib/email/urls';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const TokenSchema = z.string().trim().min(16).max(128);

function redirect(flag: string): NextResponse {
  return NextResponse.redirect(`${getEmailBaseUrl()}/?newsletter=${flag}`, 302);
}

/**
 * One-click unsubscribe via the token embedded in marketing emails.
 * Idempotent: unsubscribing twice still lands on the success state.
 */
export async function GET(request: NextRequest) {
  let clientId = 'unknown';
  try {
    clientId = getClientIdentifier(request);
  } catch {
    // Non-standard request object — treat as a single bucket.
  }
  const rateLimitResult = await enforceRateLimit('api', clientId);
  if (!rateLimitResult.success && rateLimitResult.reason === 'limited') {
    return NextResponse.json(
      { status: 'error', message: 'Too many attempts. Please try again in a minute.' },
      { status: 429, headers: rateLimitResult.headers }
    );
  }

  const parsed = TokenSchema.safeParse(request.nextUrl.searchParams.get('token') ?? '');
  if (!parsed.success) {
    return redirect('invalid');
  }

  const outcome = await unsubscribeByToken(parsed.data);
  return redirect(outcome === 'unsubscribed' ? 'unsubscribed' : 'invalid');
}
