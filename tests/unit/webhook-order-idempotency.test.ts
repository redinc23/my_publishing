/** @jest-environment node */

/**
 * WS2b.1.4 — Mongo order upsert idempotency (deliver twice → one logical insert).
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('inject Db in tests');
  }),
}));

import { upsertOrderByPaymentIntent } from '@/lib/mongo-queries';

describe('webhook mongo order idempotency', () => {
  it('second upsert with same PI does not insert again', async () => {
    const stored: Record<string, unknown>[] = [];
    const updateOne = jest.fn(
      async (
        filter: { stripe_payment_intent_id: string },
        update: {
          $setOnInsert: Record<string, unknown>;
        }
      ) => {
        const existing = stored.find(
          (o) => o.stripe_payment_intent_id === filter.stripe_payment_intent_id
        );
        if (existing) {
          return { upsertedCount: 0, matchedCount: 1, modifiedCount: 0 };
        }
        const doc = { _id: `ord-${stored.length + 1}`, ...update.$setOnInsert };
        stored.push(doc);
        return { upsertedCount: 1, matchedCount: 0, modifiedCount: 0 };
      }
    );
    const findOne = jest.fn(async (filter: { stripe_payment_intent_id: string }) => {
      return (
        stored.find((o) => o.stripe_payment_intent_id === filter.stripe_payment_intent_id) ?? null
      );
    });

    const db = {
      collection: () => ({ updateOne, findOne }),
    } as unknown as import('mongodb').Db;

    const payload = {
      user_id: 'user-1',
      stripe_payment_intent_id: 'pi_dup',
      stripe_session_id: 'cs_1',
      amount: 12,
      currency: 'usd',
      order_items: [
        {
          book_id: 'book-1',
          title: 'Book',
          quantity: 1,
          unit_amount: 12,
          currency: 'usd',
        },
      ],
    };

    const a = await upsertOrderByPaymentIntent(payload, db);
    const b = await upsertOrderByPaymentIntent(payload, db);

    expect(a.inserted).toBe(true);
    expect(b.inserted).toBe(false);
    expect(stored).toHaveLength(1);
    expect(a.orderId).toBe(b.orderId);
  });
});
