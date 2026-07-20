/**
 * Mongo order upsert for Stripe webhook idempotency (Phoenix 2b.1.4).
 *
 * Unique sparse index on `orders.stripe_payment_intent_id` (see
 * scripts/mongo-ensure-indexes.ts). Duplicate delivery → upsert no-op → 200.
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db, type Document } from 'mongodb';
import type Stripe from 'stripe';
import { getDb } from '@/lib/mongo';
import type { Order, OrderItem } from '@/types/mongo';

function coerceId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

export type UpsertOrderResult = {
  /** True when a new order document was inserted. */
  inserted: boolean;
  /** True when an existing order matched (duplicate webhook). */
  duplicate: boolean;
  orderFilter: Document;
};

/**
 * Idempotent order write from `checkout.session.completed`.
 * Always safe to call twice for the same payment intent.
 */
export async function upsertOrderFromCheckoutSession(
  session: Stripe.Checkout.Session,
  db?: Db
): Promise<UpsertOrderResult | { error: string }> {
  const database = await resolveDb(db);
  const metadata = session.metadata ?? {};
  const bookId = metadata.book_id?.trim();
  const userId = metadata.user_id?.trim();

  if (!bookId || !userId) {
    return { error: 'Missing required metadata (book_id or user_id)' };
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null;

  if (!paymentIntentId) {
    return { error: 'Missing payment_intent on completed checkout session' };
  }

  const amount = session.amount_total != null ? session.amount_total / 100 : 0;
  const currency = (session.currency || 'usd').toUpperCase();
  const now = new Date();

  let bookTitle = metadata.book_slug || 'Book';
  try {
    const book = await database
      .collection('books')
      .findOne({ _id: coerceId(bookId) }, { projection: { title: 1 } });
    if (book && typeof (book as { title?: string }).title === 'string') {
      bookTitle = (book as { title: string }).title;
    }
  } catch {
    // Title lookup is best-effort; order still records.
  }

  const orderItem: OrderItem = {
    book_id: coerceId(bookId),
    title: bookTitle,
    quantity: 1,
    unit_amount: amount,
    currency,
  };

  const filter = { stripe_payment_intent_id: paymentIntentId };
  const setOnInsert: Omit<Order, '_id'> = {
    user_id: userId,
    status: 'completed',
    amount,
    currency,
    order_items: [orderItem],
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    refund_reason: null,
    created_at: now,
    updated_at: now,
  };

  const result = await database
    .collection('orders')
    .updateOne(filter, { $setOnInsert: setOnInsert }, { upsert: true });

  return {
    inserted: result.upsertedCount === 1,
    duplicate: result.upsertedCount === 0 && result.matchedCount >= 1,
    orderFilter: filter,
  };
}

/**
 * Mark an order refunded by Stripe payment intent id.
 */
export async function markOrderRefundedByPaymentIntent(
  paymentIntentId: string,
  reason?: string | null,
  db?: Db
): Promise<{ updated: boolean }> {
  const database = await resolveDb(db);
  const result = await database.collection('orders').updateOne(
    { stripe_payment_intent_id: paymentIntentId },
    {
      $set: {
        status: 'refunded',
        refund_reason: reason ?? null,
        updated_at: new Date(),
      },
    }
  );
  return { updated: result.matchedCount >= 1 };
}
