import { NextResponse } from 'next/server';
import { isEmailConfigured, subscribeToNewsletter } from '@/lib/email/send';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Newsletter subscription (P0-013, G6).
 *
 * Honest-scope contract:
 *   - Email provider not configured → 503 { status: 'disabled' }.
 *     The UI renders a "coming soon" state; we never fake a subscription.
 *   - Provider errors                → 502 { status: 'error' }.
 *   - Real success                   → 200 { status: 'success' }.
 */
export async function POST(request: Request) {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { status: 'disabled', message: 'Newsletter signups are not available yet.' },
      { status: 503 }
    );
  }

  let email = '';
  try {
    const body = await request.json();
    email = String(body?.email ?? '').trim();
  } catch {
    return NextResponse.json({ status: 'error', message: 'Invalid request.' }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { status: 'error', message: 'Enter a valid email address.' },
      { status: 400 }
    );
  }

  const result = await subscribeToNewsletter(email);
  if (!result.success) {
    return NextResponse.json(
      { status: 'error', message: 'Could not subscribe right now. Please try again later.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ status: 'success' }, { status: 200 });
}
