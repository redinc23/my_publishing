/**
 * Mongo order upsert from Stripe checkout.session.completed (Phoenix 2b.1.4).
 *
 * Idempotent: unique sparse index on `stripe_payment_intent_id` + `$setOnInsert`.
 * Duplicate delivery → treated as success (caller returns HTTP 200).
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import type Stripe from 'stripe';
import { getDb } from '@/lib/mongo';
import type { Order, OrderItem, OrderStatus } from '@/types/mongo';
import type { CheckoutMetadata } from '@/types/webhook';

export type MongoStripeOrderResult = {
  success: boolean;
  created: boolean;
  orderId?: string;
  error?: string;
  should_retry?: boolean;
  action_taken?: string;
};

function coerceBookId(bookId: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(bookId) ? new ObjectId(bookId) : bookId;
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.payment_intent === 'string') return session.payment_intent;
  if (session.payment_intent && typeof session.payment_intent === 'object') {
    return session.payment_intent.id ?? null;
  }
  return null;
}

/**
 * Upsert a completed order keyed by Stripe payment intent (preferred) or
 * session id when PI is absent. Always safe to call twice.
 */
export async function upsertOrderFromCheckoutSession(
  session: Stripe.Checkout.Session,
  db?: Db
): Promise<MongoStripeOrderResult> {
  const database = db ?? (await getDb());
  const metadata = session.metadata as CheckoutMetadata | null;
  const bookId = metadata?.book_id;
  const userId = metadata?.user_id;

  if (!bookId || !userId) {
    return {
      success: false,
      created: false,
      error: 'Missing required metadata (book_id or user_id)',
    };
  }

  const pi = paymentIntentId(session);
  const amount = session.amount_total != null ? session.amount_total / 100 : 0;
  const currency = (session.currency || 'usd').toUpperCase();
  const now = new Date();

  let bookTitle = 'Purchase';
  try {
    const book = await database
      .collection('books')
      .findOne({ _id: coerceBookId(bookId) } as Filter<Document>, { projection: { title: 1 } });
    if (book && typeof (book as unknown as { title?: unknown }).title === 'string') {
      bookTitle = (book as unknown as { title: string }).title;
    }
  } catch {
    // Title is best-effort for the line item; do not fail fulfillment.
  }

  const orderItem: OrderItem = {
    book_id: coerceBookId(bookId),
    title: bookTitle,
    quantity: 1,
    unit_amount: amount,
    currency,
  };

  const filter = pi ? { stripe_payment_intent_id: pi } : { stripe_session_id: session.id };

  const setOnInsert: Omit<Order, '_id'> = {
    user_id: userId,
    status: 'completed' satisfies OrderStatus,
    amount,
    currency,
    order_items: [orderItem],
    stripe_session_id: session.id,
    stripe_payment_intent_id: pi,
    refund_reason: null,
    created_at: now,
    updated_at: now,
  };

  try {
    const result = await database
      .collection('orders')
      .updateOne(filter, { $setOnInsert: setOnInsert }, { upsert: true });

    const created = result.upsertedCount === 1;
    const orderId =
      result.upsertedId != null
        ? String(result.upsertedId)
        : (
            await database.collection('orders').findOne(filter, { projection: { _id: 1 } })
          )?._id?.toString();

    return {
      success: true,
      created,
      orderId,
      action_taken: created
        ? 'Order created via Mongo upsert'
        : 'Order already exists (idempotent)',
    };
  } catch (error) {
    // Duplicate key on concurrent upserts → still success (one order exists).
    const code = (error as { code?: number })?.code;
    if (code === 11000) {
      const existing = await database
        .collection('orders')
        .findOne(filter, { projection: { _id: 1 } });
      return {
        success: true,
        created: false,
        orderId: existing?._id?.toString(),
        action_taken: 'Duplicate key — treated as idempotent success',
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      created: false,
      error: message,
      should_retry: true,
    };
  }
}

/**
 * Mark an order refunded by payment intent (Mongo path).
 */
export async function markOrderRefundedByPaymentIntent(
  paymentIntentId: string,
  db?: Db
): Promise<MongoStripeOrderResult> {
  const database = db ?? (await getDb());
  const now = new Date();
  const result = await database
    .collection('orders')
    .updateOne(
      { stripe_payment_intent_id: paymentIntentId },
      { $set: { status: 'refunded' satisfies OrderStatus, updated_at: now } }
    );

  if (result.matchedCount === 0) {
    return {
      success: true,
      created: false,
      action_taken: 'Order not found, logged for review',
    };
  }

  return {
    success: true,
    created: false,
    action_taken: 'Order marked as refunded',
  };
}
