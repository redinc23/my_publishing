/**
 * @jest-environment node
 *
 * Phoenix 2b.1.4 — Mongo Stripe order upsert idempotency.
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('getDb should not be called when Db is injected');
  }),
}));

import { ObjectId } from 'mongodb';
import type Stripe from 'stripe';
import { upsertOrderFromCheckoutSession } from '@/lib/orders/mongo-stripe-order';

function mockSession(
  overrides: Partial<Stripe.Checkout.Session> & {
    metadata: { book_id: string; user_id: string };
  }
): Stripe.Checkout.Session {
  return {
    id: 'cs_test_1',
    object: 'checkout.session',
    amount_total: 1299,
    currency: 'usd',
    payment_intent: 'pi_test_1',
    ...overrides,
  } as Stripe.Checkout.Session;
}

function mockDb(updateResults: Array<{ upsertedCount: number; upsertedId?: ObjectId }>) {
  const updateOne = jest.fn();
  for (const r of updateResults) {
    updateOne.mockResolvedValueOnce({
      acknowledged: true,
      matchedCount: r.upsertedCount === 0 ? 1 : 0,
      modifiedCount: 0,
      upsertedCount: r.upsertedCount,
      upsertedId: r.upsertedId ?? null,
    });
  }

  const findOne = jest.fn().mockResolvedValue({
    _id: new ObjectId(),
    title: 'Demo Book',
  });

  const collection = jest.fn().mockImplementation((name: string) => {
    if (name === 'orders') {
      return {
        updateOne,
        findOne: jest.fn().mockResolvedValue({ _id: new ObjectId('507f1f77bcf86cd799439011') }),
      };
    }
    return { findOne };
  });

  return {
    db: { collection } as unknown as import('mongodb').Db,
    updateOne,
    collection,
  };
}

describe('upsertOrderFromCheckoutSession', () => {
  it('creates an order on first delivery', async () => {
    const upsertedId = new ObjectId();
    const { db, updateOne } = mockDb([{ upsertedCount: 1, upsertedId }]);
    const session = mockSession({
      metadata: { book_id: '507f1f77bcf86cd799439012', user_id: 'user_1' },
    });

    const result = await upsertOrderFromCheckoutSession(session, db);

    expect(result.success).toBe(true);
    expect(result.created).toBe(true);
    expect(result.orderId).toBe(String(upsertedId));
    expect(updateOne).toHaveBeenCalledTimes(1);
    const [filter, update, options] = updateOne.mock.calls[0];
    expect(filter).toEqual({ stripe_payment_intent_id: 'pi_test_1' });
    expect(update.$setOnInsert.user_id).toBe('user_1');
    expect(update.$setOnInsert.status).toBe('completed');
    expect(options).toEqual({ upsert: true });
  });

  it('treats second delivery as idempotent success (no duplicate)', async () => {
    const { db, updateOne } = mockDb([
      { upsertedCount: 1, upsertedId: new ObjectId() },
      { upsertedCount: 0 },
    ]);
    const session = mockSession({
      metadata: { book_id: '507f1f77bcf86cd799439012', user_id: 'user_1' },
    });

    const first = await upsertOrderFromCheckoutSession(session, db);
    const second = await upsertOrderFromCheckoutSession(session, db);

    expect(first.created).toBe(true);
    expect(second.success).toBe(true);
    expect(second.created).toBe(false);
    expect(second.action_taken).toMatch(/already exists/i);
    expect(updateOne).toHaveBeenCalledTimes(2);
  });

  it('returns failure without retry when metadata is missing', async () => {
    const { db, updateOne } = mockDb([]);
    const session = mockSession({
      metadata: { book_id: '', user_id: '' },
    });
    // Override to empty metadata
    (session as { metadata: Record<string, string> }).metadata = {};

    const result = await upsertOrderFromCheckoutSession(session, db);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/metadata/i);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('falls back to stripe_session_id when payment_intent is null', async () => {
    const { db, updateOne } = mockDb([{ upsertedCount: 1, upsertedId: new ObjectId() }]);
    const session = mockSession({
      payment_intent: null,
      metadata: { book_id: 'book_slug_or_id', user_id: 'user_1' },
    });

    const result = await upsertOrderFromCheckoutSession(session, db);

    expect(result.success).toBe(true);
    expect(updateOne.mock.calls[0][0]).toEqual({ stripe_session_id: 'cs_test_1' });
  });

  it('treats duplicate-key race as success', async () => {
    const updateOne = jest.fn().mockRejectedValue({ code: 11000 });
    const findOne = jest
      .fn()
      .mockResolvedValueOnce({ _id: new ObjectId(), title: 'Demo' })
      .mockResolvedValueOnce({ _id: new ObjectId('507f1f77bcf86cd799439099') });

    const collection = jest.fn().mockImplementation((name: string) => {
      if (name === 'orders') return { updateOne, findOne };
      return { findOne };
    });
    const db = { collection } as unknown as import('mongodb').Db;

    const result = await upsertOrderFromCheckoutSession(
      mockSession({ metadata: { book_id: 'b1', user_id: 'u1' } }),
      db
    );

    expect(result.success).toBe(true);
    expect(result.created).toBe(false);
    expect(result.action_taken).toMatch(/Duplicate key/i);
  });
});
