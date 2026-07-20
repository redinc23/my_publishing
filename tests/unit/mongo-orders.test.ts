/**
 * @jest-environment node
 *
 * Phoenix 2b.1.4 — webhook order upsert idempotency (mocked Db).
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('getDb should not be called when Db is injected');
  }),
}));

import type Stripe from 'stripe';
import {
  markOrderRefundedByPaymentIntent,
  upsertOrderFromCheckoutSession,
} from '@/lib/mongo-orders';

function mockOrdersDb(updateResult: {
  upsertedCount: number;
  matchedCount: number;
  modifiedCount?: number;
}) {
  const updateOne = jest.fn().mockResolvedValue(updateResult);
  const findOne = jest.fn().mockResolvedValue({ title: 'Test Book' });
  const collection = jest.fn().mockImplementation((name: string) => {
    if (name === 'books') return { findOne };
    return { updateOne };
  });
  return {
    db: { collection } as unknown as import('mongodb').Db,
    updateOne,
    findOne,
  };
}

function sessionFixture(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_1',
    object: 'checkout.session',
    amount_total: 1299,
    currency: 'usd',
    payment_intent: 'pi_test_abc',
    metadata: {
      book_id: '507f1f77bcf86cd799439011',
      user_id: 'user-1',
      book_slug: 'test-book',
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe('lib/mongo-orders', () => {
  it('upserts order by stripe_payment_intent_id on first delivery', async () => {
    const { db, updateOne } = mockOrdersDb({ upsertedCount: 1, matchedCount: 0 });
    const result = await upsertOrderFromCheckoutSession(sessionFixture(), db);

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.inserted).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(updateOne).toHaveBeenCalledWith(
      { stripe_payment_intent_id: 'pi_test_abc' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          user_id: 'user-1',
          status: 'completed',
          stripe_payment_intent_id: 'pi_test_abc',
          stripe_session_id: 'cs_test_1',
        }),
      }),
      { upsert: true }
    );
  });

  it('treats second delivery as duplicate (idempotent)', async () => {
    const updateOne = jest
      .fn()
      .mockResolvedValueOnce({ upsertedCount: 1, matchedCount: 0 })
      .mockResolvedValueOnce({ upsertedCount: 0, matchedCount: 1 });
    const findOne = jest.fn().mockResolvedValue({ title: 'Test Book' });
    const collection = jest.fn().mockImplementation((name: string) => {
      if (name === 'books') return { findOne };
      return { updateOne };
    });
    const db = { collection } as unknown as import('mongodb').Db;

    const first = await upsertOrderFromCheckoutSession(sessionFixture(), db);
    const second = await upsertOrderFromCheckoutSession(sessionFixture(), db);

    expect('error' in first).toBe(false);
    expect('error' in second).toBe(false);
    if ('error' in first || 'error' in second) return;
    expect(first.inserted).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(second.inserted).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(updateOne).toHaveBeenCalledTimes(2);
  });

  it('rejects missing metadata without writing', async () => {
    const { db, updateOne } = mockOrdersDb({ upsertedCount: 0, matchedCount: 0 });
    const result = await upsertOrderFromCheckoutSession(
      sessionFixture({ metadata: { book_id: '', user_id: '' } }),
      db
    );
    expect(result).toEqual({ error: 'Missing required metadata (book_id or user_id)' });
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('rejects completed session without payment_intent', async () => {
    const { db, updateOne } = mockOrdersDb({ upsertedCount: 0, matchedCount: 0 });
    const result = await upsertOrderFromCheckoutSession(
      sessionFixture({ payment_intent: null }),
      db
    );
    expect(result).toEqual({
      error: 'Missing payment_intent on completed checkout session',
    });
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('marks order refunded by payment intent', async () => {
    const updateOne = jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    const collection = jest.fn().mockReturnValue({ updateOne });
    const db = { collection } as unknown as import('mongodb').Db;

    const result = await markOrderRefundedByPaymentIntent(
      'pi_test_abc',
      'requested_by_customer',
      db
    );
    expect(result.updated).toBe(true);
    expect(updateOne).toHaveBeenCalledWith(
      { stripe_payment_intent_id: 'pi_test_abc' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'refunded' }),
      })
    );
  });
});
