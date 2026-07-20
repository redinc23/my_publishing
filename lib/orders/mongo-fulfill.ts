/**
 * Mongo order fulfillment for Stripe checkout.session.completed (Phoenix 2b.1.4).
 *
 * Idempotent: unique sparse index on `orders.stripe_payment_intent_id` plus
 * `$setOnInsert` upsert. Duplicate deliveries return success without a second order.
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db } from 'mongodb';
import { getDb } from '@/lib/mongo';
import type { Order, OrderItem } from '@/types/mongo';

export type FulfillCheckoutInput = {
  /** Stripe PaymentIntent id — preferred idempotency key. */
  paymentIntentId: string | null;
  sessionId: string;
  userId: string;
  bookId: string;
  bookTitle: string;
  amount: number;
  currency: string;
};

export type FulfillCheckoutResult = {
  orderId: string;
  created: boolean;
  duplicate: boolean;
};

function coerceBookId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

/**
 * Upsert a completed order keyed by `stripe_payment_intent_id` when present,
 * otherwise by `stripe_session_id` (rare PI-less sessions).
 */
export async function upsertOrderFromCheckout(
  input: FulfillCheckoutInput,
  db?: Db
): Promise<FulfillCheckoutResult> {
  const database = await resolveDb(db);
  const now = new Date();
  const currency = (input.currency || 'usd').toLowerCase();

  const item: OrderItem = {
    book_id: coerceBookId(input.bookId),
    title: input.bookTitle,
    quantity: 1,
    unit_amount: input.amount,
    currency,
  };

  const filter = input.paymentIntentId
    ? { stripe_payment_intent_id: input.paymentIntentId }
    : { stripe_session_id: input.sessionId };

  const setOnInsert: Omit<Order, '_id'> = {
    user_id: input.userId,
    status: 'completed',
    amount: input.amount,
    currency,
    order_items: [item],
    stripe_session_id: input.sessionId,
    stripe_payment_intent_id: input.paymentIntentId,
    created_at: now,
    updated_at: now,
  };

  const collection = database.collection('orders');

  try {
    const result = await collection.updateOne(
      filter,
      { $setOnInsert: setOnInsert },
      { upsert: true }
    );

    const created = Boolean(result.upsertedCount && result.upsertedCount > 0);
    let orderId =
      result.upsertedId != null ? String(result.upsertedId) : '';

    if (!orderId) {
      const existing = await collection.findOne(filter, { projection: { _id: 1 } });
      orderId = existing?._id != null ? String(existing._id) : 'unknown';
    }

    return {
      orderId,
      created,
      duplicate: !created,
    };
  } catch (error) {
    // Race on unique index: another worker inserted first — treat as duplicate success.
    const code =
      error && typeof error === 'object' && 'code' in error
        ? (error as { code?: number }).code
        : undefined;
    if (code === 11000) {
      const existing = await collection.findOne(filter, { projection: { _id: 1 } });
      return {
        orderId: existing?._id != null ? String(existing._id) : 'unknown',
        created: false,
        duplicate: true,
      };
    }
    throw error;
  }
}

/**
 * Mark an order refunded by payment intent (Mongo path).
 */
export async function markOrderRefundedByPaymentIntent(
  paymentIntentId: string,
  db?: Db
): Promise<{ found: boolean }> {
  const database = await resolveDb(db);
  const result = await database.collection('orders').updateOne(
    { stripe_payment_intent_id: paymentIntentId },
    { $set: { status: 'refunded', updated_at: new Date() } }
  );
  return { found: result.matchedCount > 0 };
}
