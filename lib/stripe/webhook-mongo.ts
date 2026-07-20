/**
 * Mongo fulfillment path for Stripe webhooks (Phoenix WS2b Task 2b.1.4).
 *
 * Idempotent: unique sparse index on orders.stripe_payment_intent_id +
 * $setOnInsert upsert. Duplicate deliveries return success (HTTP 200 upstream).
 */

import type Stripe from 'stripe';
import { getBookById } from '@/lib/mongo-queries';
import { markOrderRefunded, upsertCompletedOrder } from '@/lib/mongo-orders';
import type { CheckoutMetadata } from '@/types/webhook';
import type { WebhookProcessingResult } from '@/types/webhook';

export async function handleMongoCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<WebhookProcessingResult> {
  const metadata = session.metadata as CheckoutMetadata | null;
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null;

  if (!metadata?.book_id || !metadata?.user_id) {
    console.error('[Webhook:mongo] Missing required metadata:', session.id);
    return {
      success: false,
      error: 'Missing required metadata (book_id or user_id)',
      event_id: session.id,
      event_type: 'checkout.session.completed',
    };
  }

  if (!paymentIntentId) {
    // Still fulfill via session id key so we never drop a paid session.
    console.warn('[Webhook:mongo] No payment_intent on session; using session id key:', session.id);
  }

  const book = await getBookById(metadata.book_id);
  const totalAmount = session.amount_total ? session.amount_total / 100 : (book?.price ?? 0);
  const currency = (session.currency || book?.currency || 'usd').toUpperCase();

  const { created } = await upsertCompletedOrder({
    user_id: metadata.user_id,
    amount: totalAmount,
    currency,
    order_items: [
      {
        book_id: metadata.book_id,
        title: book?.title ?? 'Book',
        quantity: 1,
        unit_amount: totalAmount,
        currency,
      },
    ],
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
  });

  return {
    success: true,
    event_id: session.id,
    event_type: 'checkout.session.completed',
    action_taken: created
      ? 'Order created successfully (mongo)'
      : 'Order already exists (mongo idempotent upsert)',
  };
}

export async function handleMongoChargeRefunded(
  charge: Stripe.Charge
): Promise<WebhookProcessingResult> {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;

  if (!paymentIntentId) {
    return {
      success: true,
      event_id: charge.id,
      event_type: 'charge.refunded',
      action_taken: 'No payment_intent on charge; logged for review',
    };
  }

  const order = await markOrderRefunded(paymentIntentId);
  return {
    success: true,
    event_id: charge.id,
    event_type: 'charge.refunded',
    action_taken: order
      ? 'Order marked as refunded (mongo)'
      : 'Order not found (mongo); logged for review',
  };
}
