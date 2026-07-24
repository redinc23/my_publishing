/**
 * Email triggers — self-contained orchestrators that resolve recipients and
 * preference state, then dispatch the typed senders in lib/email/messages.ts.
 *
 * Every exported function NEVER throws and never blocks its caller's core
 * flow: call them fire-and-forget (or `await` them inside a try/catch) from
 * signup, the Stripe webhook, the reviews system, and the payouts system.
 */

import type Stripe from 'stripe';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured } from './send';
import {
  formatEmailCurrency,
  sendAuthorPayoutEmail,
  sendNewReviewAlertEmail,
  sendPurchaseReceiptEmail,
} from './messages';
import { shouldSendEmail } from './preferences';
import { getEmailUrl } from './urls';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Trim a review body to a short, email-safe excerpt. */
function toExcerpt(content: string | undefined, maxLength = 240): string | undefined {
  if (!content) return undefined;
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

// ── Purchase receipt (Stripe webhook) ────────────────────────────────────────

/**
 * Send the purchase receipt for a completed Stripe checkout session.
 *
 * Resolves the buyer via profiles (metadata.user_id is the AUTH user id),
 * falls back to the Stripe customer email, respects the 'receipts' email
 * preference, and formats line items from the books table.
 *
 * Call from the checkout.session.completed branch of the Stripe webhook.
 * Never throws; failures are logged and swallowed so fulfillment is never
 * blocked or retried because of email.
 */
export async function sendPurchaseReceiptForCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn('[email] RESEND_API_KEY not set — skipping purchase receipt for', session.id);
    return;
  }

  try {
    const metadata = session.metadata as { book_id?: string; user_id?: string } | null;
    if (!metadata?.book_id || !metadata.user_id) {
      console.warn('[email] Receipt skipped: checkout session missing metadata', session.id);
      return;
    }

    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', metadata.user_id)
      .maybeSingle();

    const recipient =
      profile?.email || session.customer_details?.email || session.customer_email || null;

    if (!recipient) {
      console.warn('[email] Receipt skipped: no recipient email for session', session.id);
      return;
    }

    if (!(await shouldSendEmail(metadata.user_id, 'receipts'))) {
      console.log('[email] Receipt skipped: user opted out of receipts', metadata.user_id);
      return;
    }

    const { data: book } = await supabase
      .from('books')
      .select('title')
      .eq('id', metadata.book_id)
      .maybeSingle();

    const totalAmount = session.amount_total ? session.amount_total / 100 : 0;
    const currency = (session.currency || 'usd').toUpperCase();
    const formattedTotal = formatEmailCurrency(totalAmount, currency);
    const orderNumber = `STRIPE-${session.id}`;

    const result = await sendPurchaseReceiptEmail({
      to: recipient,
      orderNumber,
      items: [{ title: book?.title || 'MANGU book', unitPrice: formattedTotal }],
      total: formattedTotal,
      readUrl: getEmailUrl('/reading'),
    });

    if (!result.success) {
      console.error('[email] Purchase receipt failed for session', session.id, result.error);
    }
  } catch (error) {
    // Email is best-effort: never let a receipt break webhook processing.
    console.error('[email] Purchase receipt trigger error (swallowed):', error);
  }
}

// ── New review alert (reviews system) ────────────────────────────────────────

export interface NotifyAuthorOfNewReviewInput {
  /** books.id of the reviewed book. */
  bookId: string;
  /** Star rating 1–5. */
  rating: number;
  reviewTitle?: string;
  /** Full review body — an excerpt is derived automatically. */
  reviewContent?: string;
  reviewerName?: string;
}

/**
 * Alert a book's author that a new public review was published.
 *
 * REVIEWS SYSTEM CALL SIGNATURE (call AFTER the review row is committed; do
 * not await on the request hot path — fire and forget or wrap in try/catch):
 *
 *   import { notifyAuthorOfNewReview } from '@/lib/email/triggers';
 *   void notifyAuthorOfNewReview({
 *     bookId: review.book_id,
 *     rating: review.rating,
 *     reviewTitle: review.title,
 *     reviewContent: review.content,
 *     reviewerName: profile.full_name,
 *   });
 *
 * Only call for newly-created public reviews (not edits) to avoid spamming
 * authors. Respects the author's 'author_alerts' email preference.
 * Never throws.
 */
export async function notifyAuthorOfNewReview(input: NotifyAuthorOfNewReviewInput): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn('[email] RESEND_API_KEY not set — skipping new-review alert for', input.bookId);
    return;
  }

  try {
    const supabase = createAdminClient();

    const { data: book } = await supabase
      .from('books')
      .select('title, slug, author_id')
      .eq('id', input.bookId)
      .maybeSingle();

    if (!book?.author_id) {
      return;
    }

    const authorEmail = await resolveAuthorContact(supabase, book.author_id);
    if (!authorEmail) {
      console.warn('[email] Review alert skipped: author has no email for book', input.bookId);
      return;
    }

    if (!(await shouldSendEmail(authorEmail.authUserId, 'author_alerts'))) {
      console.log('[email] Review alert skipped: author opted out', authorEmail.authUserId);
      return;
    }

    const result = await sendNewReviewAlertEmail({
      to: authorEmail.email,
      authorName: authorEmail.name,
      bookTitle: book.title,
      rating: input.rating,
      reviewTitle: input.reviewTitle,
      reviewExcerpt: toExcerpt(input.reviewContent),
      reviewerName: input.reviewerName,
      reviewUrl: getEmailUrl(`/books/${book.slug}#reviews`),
    });

    if (!result.success) {
      console.error('[email] New-review alert failed for book', input.bookId, result.error);
    }
  } catch (error) {
    console.error('[email] New-review alert trigger error (swallowed):', error);
  }
}

// ── Author payout (payouts system) ───────────────────────────────────────────

export interface NotifyAuthorOfPayoutInput {
  /** auth.users.id of the author (NOT authors.id / profiles.id). */
  authorAuthUserId: string;
  /** Major-unit amount, e.g. 142.5. */
  amount: number;
  currency?: string;
  /** Human-readable period, e.g. "June 2026". */
  period?: string;
  /** Payout status label, defaults to "processed". */
  status?: string;
}

/**
 * Notify an author that a royalty payout was processed/scheduled. Exported
 * for the payouts system (lib/actions/payouts.ts) to call fire-and-forget.
 * Respects the author's 'author_alerts' preference. Never throws.
 */
export async function notifyAuthorOfPayout(input: NotifyAuthorOfPayoutInput): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn(
      '[email] RESEND_API_KEY not set — skipping payout notification for',
      input.authorAuthUserId
    );
    return;
  }

  try {
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', input.authorAuthUserId)
      .maybeSingle();

    if (!profile?.email) {
      console.warn('[email] Payout notification skipped: no profile email');
      return;
    }

    if (!(await shouldSendEmail(input.authorAuthUserId, 'author_alerts'))) {
      console.log('[email] Payout notification skipped: author opted out');
      return;
    }

    const result = await sendAuthorPayoutEmail({
      to: profile.email,
      authorName: profile.full_name || 'Author',
      amount: formatEmailCurrency(input.amount, (input.currency || 'usd').toUpperCase()),
      status: input.status,
      period: input.period,
      dashboardUrl: getEmailUrl('/author/earnings'),
    });

    if (!result.success) {
      console.error('[email] Payout notification failed:', result.error);
    }
  } catch (error) {
    console.error('[email] Payout notification trigger error (swallowed):', error);
  }
}

// ── Shared lookups ───────────────────────────────────────────────────────────

/** Resolve an authors.id to its owner's contact info + auth user id. */
async function resolveAuthorContact(
  supabase: AdminClient,
  authorId: string
): Promise<{ authUserId: string; email: string; name: string } | null> {
  const { data: author } = await supabase
    .from('authors')
    .select('profile_id, pen_name')
    .eq('id', authorId)
    .maybeSingle();

  if (!author?.profile_id) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, email, full_name')
    .eq('id', author.profile_id)
    .maybeSingle();

  if (!profile?.user_id || !profile.email) {
    return null;
  }

  return {
    authUserId: profile.user_id,
    email: profile.email,
    name: author.pen_name || profile.full_name || 'Author',
  };
}
