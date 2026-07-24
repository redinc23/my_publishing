/**
 * Newsletter subscription management — double opt-in flow.
 *
 * Storage: newsletter_subscribers table (service-role only; see migration
 * 20260719042623_newsletter_subscribers_schema_reconciliation.sql). Flow:
 *
 *   1. POST /api/newsletter        → startNewsletterSubscription(email)
 *      creates/refreshes a 'pending' row and emails a one-time confirm link.
 *   2. GET /api/newsletter/confirm → confirmNewsletterSubscription(token)
 *      activates the subscription (idempotent).
 *   3. GET /api/newsletter/unsubscribe → unsubscribeByToken(token).
 *
 * Graceful degradation: when the table isn't migrated yet, subscribe falls
 * back to the legacy provider-only path (Resend audience / welcome email) so
 * the feature keeps working. Never throws.
 */

import { randomBytes } from 'node:crypto';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, subscribeToNewsletter } from './send';
import { sendNewsletterConfirmEmail } from './messages';
import { getEmailUrl } from './urls';

const TOKEN_TTL_HOURS = 24 * 7; // 7 days

type AdminClient = ReturnType<typeof createAdminClient>;

export type SubscribeOutcome =
  | { status: 'sent' }
  | { status: 'already-confirmed' }
  | { status: 'legacy' }
  | { status: 'error'; error?: unknown };

export type ConfirmOutcome = 'confirmed' | 'already-confirmed' | 'invalid' | 'expired';
export type UnsubscribeOutcome = 'unsubscribed' | 'invalid';

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    /does not exist|schema cache|could not find the table/i.test(error.message ?? '')
  );
}

function newToken(): string {
  return randomBytes(24).toString('hex');
}

function tokenExpiry(): string {
  return new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

/** True when the service-role Supabase client has the env it needs. */
function isSupabaseAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Legacy pre-migration / DB-unavailable behavior: Resend audience add when
 * RESEND_AUDIENCE_ID is set, otherwise a provider welcome email. Keeps the
 * route functional before the newsletter_subscribers migration has been
 * applied or when Supabase isn't configured.
 */
async function subscribeViaLegacyProvider(email: string): Promise<SubscribeOutcome> {
  console.warn(
    '[newsletter] DB-backed double opt-in unavailable — falling back to provider-only subscribe'
  );
  const result = await subscribeToNewsletter(email);
  return result.success ? { status: 'legacy' } : { status: 'error', error: result.error };
}

/**
 * Idempotent subscribe. Sends (or re-sends) the double opt-in confirmation
 * email. Returns 'already-confirmed' without emailing when the address is
 * active, so callers can answer 200 without leaking subscription state.
 */
export async function startNewsletterSubscription(rawEmail: string): Promise<SubscribeOutcome> {
  if (!isEmailConfigured()) {
    return { status: 'error', error: new Error('Email provider not configured') };
  }

  const email = rawEmail.trim().toLowerCase();

  // Graceful degradation: without Supabase admin credentials the double
  // opt-in table is unusable — degrade to the provider-only path rather
  // than failing the signup.
  if (!isSupabaseAdminConfigured()) {
    return subscribeViaLegacyProvider(email);
  }

  try {
    const supabase = createAdminClient();
    return await startWithTable(supabase, email);
  } catch (error) {
    if (isMissingTableError(error as { code?: string; message?: string })) {
      return subscribeViaLegacyProvider(email);
    }
    console.error('[newsletter] subscribe failed:', error);
    return { status: 'error', error };
  }
}

async function startWithTable(supabase: AdminClient, email: string): Promise<SubscribeOutcome> {
  const { data: existing, error: lookupError } = await supabase
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    if (isMissingTableError(lookupError)) {
      return subscribeViaLegacyProvider(email);
    }
    console.error('[newsletter] lookup failed:', lookupError);
    return { status: 'error', error: lookupError };
  }

  if (existing?.status === 'confirmed') {
    // Idempotent: active subscriber re-submitting the form is a no-op.
    return { status: 'already-confirmed' };
  }

  const token = newToken();
  const payload = {
    email,
    status: 'pending' as const,
    confirm_token: token,
    token_expires_at: tokenExpiry(),
    confirmed_at: null,
    unsubscribed_at: null,
  };

  // Covers both the new row and the pending/unsubscribed resubscribe paths.
  const { error: upsertError } = await supabase
    .from('newsletter_subscribers')
    .upsert(payload, { onConflict: 'email' });

  if (upsertError) {
    if (isMissingTableError(upsertError)) {
      return subscribeViaLegacyProvider(email);
    }
    console.error('[newsletter] upsert failed:', upsertError);
    return { status: 'error', error: upsertError };
  }

  const result = await sendNewsletterConfirmEmail({
    to: email,
    confirmUrl: getEmailUrl(`/api/newsletter/confirm?token=${token}`),
  });

  if (!result.success) {
    return { status: 'error', error: result.error };
  }

  // Provider not configured → skipped: the row stays pending and the route
  // reports success only when something was actually sent.
  return result.skipped ? { status: 'error', error: 'send-skipped' } : { status: 'sent' };
}

/** Activate a pending subscription from a double opt-in token. Idempotent. */
export async function confirmNewsletterSubscription(token: string): Promise<ConfirmOutcome> {
  try {
    const supabase = createAdminClient();
    const { data: subscriber, error } = await supabase
      .from('newsletter_subscribers')
      .select('id, status, token_expires_at')
      .eq('confirm_token', token)
      .maybeSingle();

    if (error) {
      console.error('[newsletter] confirm lookup failed:', error);
      return 'invalid';
    }
    if (!subscriber) {
      return 'invalid';
    }
    if (subscriber.status === 'confirmed') {
      return 'already-confirmed';
    }
    if (
      subscriber.token_expires_at &&
      new Date(subscriber.token_expires_at).getTime() < Date.now()
    ) {
      return 'expired';
    }

    const { error: updateError } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', subscriber.id);

    if (updateError) {
      console.error('[newsletter] confirm update failed:', updateError);
      return 'invalid';
    }

    return 'confirmed';
  } catch (error) {
    console.error('[newsletter] confirm failed:', error);
    return 'invalid';
  }
}

/** Unsubscribe via the token embedded in marketing emails. Idempotent. */
export async function unsubscribeByToken(token: string): Promise<UnsubscribeOutcome> {
  try {
    const supabase = createAdminClient();
    const { data: subscriber, error } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('confirm_token', token)
      .maybeSingle();

    if (error || !subscriber) {
      if (error) console.error('[newsletter] unsubscribe lookup failed:', error);
      return 'invalid';
    }

    if (subscriber.status !== 'unsubscribed') {
      const { error: updateError } = await supabase
        .from('newsletter_subscribers')
        .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
        .eq('id', subscriber.id);

      if (updateError) {
        console.error('[newsletter] unsubscribe update failed:', updateError);
        return 'invalid';
      }
    }

    return 'unsubscribed';
  } catch (error) {
    console.error('[newsletter] unsubscribe failed:', error);
    return 'invalid';
  }
}
