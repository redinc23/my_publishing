/**
 * Typed transactional-email send functions.
 *
 * One function per template in emails/. Built on the existing provider shim
 * (lib/email/send.ts). Contract for every function:
 *
 *  - RESEND_API_KEY absent      → no-op with a logged warning, resolves
 *                                 { success: true, skipped: true, reason: 'not-configured' }.
 *  - Provider / unexpected error → logged, resolves { success: false, ... }.
 *  - NEVER throws into callers. Email must never break signup, checkout
 *    fulfillment, webhooks, or any page render.
 */

import { isEmailConfigured, sendEmail } from './send';
import { WelcomeEmail } from '@/emails/welcome-email';
import { PurchaseReceiptEmail, type ReceiptItem } from '@/emails/purchase-receipt-email';
import { AuthorPayoutEmail } from '@/emails/author-payout-email';
import { NewReviewAlertEmail } from '@/emails/new-review-alert-email';
import { NewsletterConfirmEmail } from '@/emails/newsletter-confirm-email';

export type EmailSkipReason = 'not-configured' | 'opted-out';

export interface EmailSendResult {
  success: boolean;
  /** True when nothing was sent (provider missing or recipient opted out). */
  skipped?: boolean;
  reason?: EmailSkipReason;
  error?: unknown;
  data?: unknown;
}

function skippedResult(reason: EmailSkipReason): EmailSendResult {
  return { success: true, skipped: true, reason };
}

function notConfigured(template: string, to: string): EmailSendResult {
  console.warn(
    `[email] RESEND_API_KEY not set — skipping "${template}" email to ${to}. ` +
      'Set RESEND_API_KEY to enable transactional email.'
  );
  return skippedResult('not-configured');
}

async function safeSend(
  template: string,
  to: string,
  subject: string,
  react: React.ReactElement
): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return notConfigured(template, to);
  }

  try {
    const result = await sendEmail(to, subject, react);
    if (!result.success) {
      console.error(`[email] "${template}" to ${to} failed:`, result.error);
      return { success: false, error: result.error };
    }
    return { success: true, data: result.data };
  } catch (error) {
    // Defensive: sendEmail already swallows, but never let email bubble up.
    console.error(`[email] "${template}" to ${to} threw unexpectedly:`, error);
    return { success: false, error };
  }
}

/** Format a major-unit amount (e.g. 9.99) for display in templates. */
export function formatEmailCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

// ── Welcome ──────────────────────────────────────────────────────────────────

export interface SendWelcomeEmailInput {
  to: string;
  userName: string;
}

export async function sendWelcomeEmail(input: SendWelcomeEmailInput): Promise<EmailSendResult> {
  return safeSend(
    'welcome',
    input.to,
    'Welcome to MANGU',
    WelcomeEmail({ userName: input.userName })
  );
}

// ── Purchase receipt ─────────────────────────────────────────────────────────

export interface SendPurchaseReceiptEmailInput {
  to: string;
  orderNumber: string;
  items: ReceiptItem[];
  /** Pre-formatted total, e.g. "$9.99". */
  total: string;
  readUrl?: string;
}

export async function sendPurchaseReceiptEmail(
  input: SendPurchaseReceiptEmailInput
): Promise<EmailSendResult> {
  return safeSend(
    'purchase-receipt',
    input.to,
    `Your MANGU receipt — order ${input.orderNumber}`,
    PurchaseReceiptEmail({
      orderNumber: input.orderNumber,
      items: input.items,
      total: input.total,
      readUrl: input.readUrl,
    })
  );
}

// ── Author payout ────────────────────────────────────────────────────────────

export interface SendAuthorPayoutEmailInput {
  to: string;
  authorName: string;
  /** Pre-formatted amount, e.g. "$142.50". */
  amount: string;
  status?: string;
  period?: string;
  dashboardUrl?: string;
}

export async function sendAuthorPayoutEmail(
  input: SendAuthorPayoutEmailInput
): Promise<EmailSendResult> {
  const status = input.status ?? 'processed';
  return safeSend(
    'author-payout',
    input.to,
    `Your MANGU payout of ${input.amount} has been ${status}`,
    AuthorPayoutEmail({
      authorName: input.authorName,
      amount: input.amount,
      status,
      period: input.period,
      dashboardUrl: input.dashboardUrl,
    })
  );
}

// ── New review alert ─────────────────────────────────────────────────────────

export interface SendNewReviewAlertEmailInput {
  to: string;
  authorName: string;
  bookTitle: string;
  rating: number;
  reviewTitle?: string;
  reviewExcerpt?: string;
  reviewerName?: string;
  reviewUrl?: string;
}

export async function sendNewReviewAlertEmail(
  input: SendNewReviewAlertEmailInput
): Promise<EmailSendResult> {
  return safeSend(
    'new-review-alert',
    input.to,
    `New ${input.rating}-star review of ${input.bookTitle}`,
    NewReviewAlertEmail({
      authorName: input.authorName,
      bookTitle: input.bookTitle,
      rating: input.rating,
      reviewTitle: input.reviewTitle,
      reviewExcerpt: input.reviewExcerpt,
      reviewerName: input.reviewerName,
      reviewUrl: input.reviewUrl,
    })
  );
}

// ── Newsletter double opt-in ─────────────────────────────────────────────────

export interface SendNewsletterConfirmEmailInput {
  to: string;
  /** Absolute confirmation URL containing the one-time token. */
  confirmUrl: string;
}

export async function sendNewsletterConfirmEmail(
  input: SendNewsletterConfirmEmailInput
): Promise<EmailSendResult> {
  return safeSend(
    'newsletter-confirm',
    input.to,
    'Confirm your MANGU newsletter subscription',
    NewsletterConfirmEmail({ confirmUrl: input.confirmUrl, email: input.to })
  );
}
