/**
 * Mongo order mutations (Phoenix WS2b Task 2b.1.4).
 *
 * Idempotent upsert by `stripe_payment_intent_id` (unique sparse index).
 * Duplicate deliveries must not create a second order.
 */

import '@/lib/server-only-guard';

import type { Db, Document } from 'mongodb';
import { getDb } from '@/lib/mongo';
import type { Order, OrderItem, OrderStatus } from '@/types/mongo';

export type UpsertCompletedOrderInput = {
  user_id: string;
  amount: number;
  currency: string;
  order_items: OrderItem[];
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
};

export type UpsertCompletedOrderResult = {
  order: Order;
  /** true when $setOnInsert wrote a new doc; false when unique key already existed */
  created: boolean;
};

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

/**
 * Upsert a completed order by payment intent (preferred) or session id.
 * Uses `$setOnInsert` so replays are no-ops on the unique key.
 */
export async function upsertCompletedOrder(
  input: UpsertCompletedOrderInput,
  db?: Db
): Promise<UpsertCompletedOrderResult> {
  const database = await resolveDb(db);
  const now = new Date();

  const filter: Document = input.stripe_payment_intent_id
    ? { stripe_payment_intent_id: input.stripe_payment_intent_id }
    : { stripe_session_id: input.stripe_session_id };

  const setOnInsert: Document = {
    user_id: input.user_id,
    status: 'completed' satisfies OrderStatus,
    amount: input.amount,
    currency: input.currency,
    order_items: input.order_items,
    stripe_session_id: input.stripe_session_id,
    stripe_payment_intent_id: input.stripe_payment_intent_id,
    created_at: now,
    updated_at: now,
  };

  const result = await database.collection('orders').updateOne(
    filter,
    { $setOnInsert: setOnInsert },
    {
      upsert: true,
    }
  );

  const order = (await database.collection('orders').findOne(filter)) as Order | null;
  if (!order) {
    throw new Error('Order upsert succeeded but document was not readable');
  }

  return {
    order,
    created: result.upsertedCount === 1,
  };
}

/**
 * Mark an order refunded by Stripe payment intent id.
 * Returns null when no matching order exists (caller should still 200).
 */
export async function markOrderRefunded(
  stripePaymentIntentId: string,
  db?: Db
): Promise<Order | null> {
  const database = await resolveDb(db);
  const result = await database
    .collection('orders')
    .findOneAndUpdate(
      { stripe_payment_intent_id: stripePaymentIntentId },
      { $set: { status: 'refunded' satisfies OrderStatus, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
  return (result as Order | null) ?? null;
}

/** Pure helper for tests — builds the $setOnInsert payload without I/O. */
export function buildCompletedOrderInsert(
  input: UpsertCompletedOrderInput,
  now = new Date()
): Document {
  return {
    user_id: input.user_id,
    status: 'completed',
    amount: input.amount,
    currency: input.currency,
    order_items: input.order_items,
    stripe_session_id: input.stripe_session_id,
    stripe_payment_intent_id: input.stripe_payment_intent_id,
    created_at: now,
    updated_at: now,
  };
}
