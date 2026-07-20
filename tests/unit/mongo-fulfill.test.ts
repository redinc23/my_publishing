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

import {
  markOrderRefundedByPaymentIntent,
  upsertOrderFromCheckout,
} from '@/lib/orders/mongo-fulfill';

function mockOrdersCollection(handlers: {
  updateOne?: jest.Mock;
  findOne?: jest.Mock;
}) {
  const updateOne =
    handlers.updateOne ??
    jest.fn().mockResolvedValue({ upsertedCount: 1, upsertedId: 'oid1', matchedCount: 0 });
  const findOne = handlers.findOne ?? jest.fn().mockResolvedValue({ _id: 'oid1' });
  const collection = jest.fn().mockReturnValue({ updateOne, findOne });
  return {
    db: { collection } as unknown as import('mongodb').Db,
    updateOne,
    findOne,
    collection,
  };
}

describe('lib/orders/mongo-fulfill', () => {
  const baseInput = {
    paymentIntentId: 'pi_test_123',
    sessionId: 'cs_test_abc',
    userId: 'user-1',
    bookId: '507f1f77bcf86cd799439011',
    bookTitle: 'Test Book',
    amount: 9.99,
    currency: 'usd',
  };

  it('upserts a new order by stripe_payment_intent_id', async () => {
    const { db, updateOne, collection } = mockOrdersCollection({});

    const result = await upsertOrderFromCheckout(baseInput, db);

    expect(collection).toHaveBeenCalledWith('orders');
    expect(updateOne).toHaveBeenCalledWith(
      { stripe_payment_intent_id: 'pi_test_123' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          user_id: 'user-1',
          status: 'completed',
          amount: 9.99,
          stripe_payment_intent_id: 'pi_test_123',
          stripe_session_id: 'cs_test_abc',
        }),
      }),
      { upsert: true }
    );
    expect(result.created).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.orderId).toBe('oid1');
  });

  it('treats second delivery as duplicate (no upsertedCount)', async () => {
    const updateOne = jest
      .fn()
      .mockResolvedValue({ upsertedCount: 0, upsertedId: null, matchedCount: 1 });
    const findOne = jest.fn().mockResolvedValue({ _id: 'existing-oid' });
    const { db } = mockOrdersCollection({ updateOne, findOne });

    const first = await upsertOrderFromCheckout(baseInput, db);
    const second = await upsertOrderFromCheckout(baseInput, db);

    expect(first.created).toBe(false);
    expect(first.duplicate).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.orderId).toBe('existing-oid');
    expect(updateOne).toHaveBeenCalledTimes(2);
  });

  it('handles unique-index race (code 11000) as duplicate success', async () => {
    const updateOne = jest.fn().mockRejectedValue({ code: 11000 });
    const findOne = jest.fn().mockResolvedValue({ _id: 'race-winner' });
    const { db } = mockOrdersCollection({ updateOne, findOne });

    const result = await upsertOrderFromCheckout(baseInput, db);

    expect(result.created).toBe(false);
    expect(result.duplicate).toBe(true);
    expect(result.orderId).toBe('race-winner');
  });

  it('falls back to stripe_session_id when payment intent is null', async () => {
    const { db, updateOne } = mockOrdersCollection({});

    await upsertOrderFromCheckout({ ...baseInput, paymentIntentId: null }, db);

    expect(updateOne).toHaveBeenCalledWith(
      { stripe_session_id: 'cs_test_abc' },
      expect.any(Object),
      { upsert: true }
    );
  });

  it('marks order refunded by payment intent', async () => {
    const updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const { db, collection } = mockOrdersCollection({ updateOne });

    const result = await markOrderRefundedByPaymentIntent('pi_test_123', db);

    expect(collection).toHaveBeenCalledWith('orders');
    expect(updateOne).toHaveBeenCalledWith(
      { stripe_payment_intent_id: 'pi_test_123' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'refunded' }) })
    );
    expect(result.found).toBe(true);
  });
});
