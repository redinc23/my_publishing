/**
 * @jest-environment node
 *
 * Phoenix WS2b — Mongo order upsert idempotency (Task 2b.1.4).
 */

jest.mock('@/lib/server-only-guard', () => ({}));
jest.mock('@/lib/mongo', () => ({
  getDb: jest.fn(() => {
    throw new Error('getDb should not be called when Db is injected');
  }),
}));

import { ObjectId } from 'mongodb';
import { buildCompletedOrderInsert, upsertCompletedOrder } from '@/lib/mongo-orders';
import { serializeMongoValue } from '@/lib/mongo-serialize';

function mockOrdersCollection(existing: Record<string, unknown> | null = null) {
  let stored = existing;
  const updateOne = jest.fn().mockImplementation(async (_filter, _update, options) => {
    if (stored) {
      return { upsertedCount: 0, matchedCount: 1, modifiedCount: 0 };
    }
    const insert = _update.$setOnInsert;
    stored = { _id: new ObjectId(), ...insert };
    return {
      upsertedCount: options?.upsert ? 1 : 0,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedId: stored._id,
    };
  });
  const findOne = jest.fn().mockImplementation(async () => stored);
  const findOneAndUpdate = jest.fn().mockImplementation(async (_filter, update) => {
    if (!stored) return null;
    stored = { ...stored, ...update.$set };
    return stored;
  });

  const collection = jest.fn().mockReturnValue({ updateOne, findOne, findOneAndUpdate });
  return {
    db: { collection } as unknown as import('mongodb').Db,
    updateOne,
    findOne,
    getStored: () => stored,
  };
}

describe('lib/mongo-orders', () => {
  const baseInput = {
    user_id: 'user-1',
    amount: 12.99,
    currency: 'USD',
    order_items: [
      {
        book_id: 'book-1',
        title: 'Test Book',
        quantity: 1,
        unit_amount: 12.99,
        currency: 'USD',
      },
    ],
    stripe_session_id: 'cs_test_1',
    stripe_payment_intent_id: 'pi_test_1',
  };

  it('buildCompletedOrderInsert includes stripe_payment_intent_id', () => {
    const now = new Date('2026-07-20T00:00:00.000Z');
    const doc = buildCompletedOrderInsert(baseInput, now);
    expect(doc).toMatchObject({
      user_id: 'user-1',
      status: 'completed',
      stripe_payment_intent_id: 'pi_test_1',
      stripe_session_id: 'cs_test_1',
      amount: 12.99,
    });
    expect(doc.created_at).toBe(now);
  });

  it('upsertCompletedOrder creates once then treats replay as existing', async () => {
    const { db, updateOne } = mockOrdersCollection(null);

    const first = await upsertCompletedOrder(baseInput, db);
    expect(first.created).toBe(true);
    expect(first.order.stripe_payment_intent_id).toBe('pi_test_1');

    const second = await upsertCompletedOrder(baseInput, db);
    expect(second.created).toBe(false);
    expect(second.order.stripe_payment_intent_id).toBe('pi_test_1');
    expect(updateOne).toHaveBeenCalledTimes(2);

    // Both calls filter by payment intent (idempotency key)
    expect(updateOne.mock.calls[0][0]).toEqual({
      stripe_payment_intent_id: 'pi_test_1',
    });
    expect(updateOne.mock.calls[1][0]).toEqual({
      stripe_payment_intent_id: 'pi_test_1',
    });
    expect(updateOne.mock.calls[0][1].$setOnInsert).toBeDefined();
  });

  it('falls back to stripe_session_id when payment intent is null', async () => {
    const { db, updateOne } = mockOrdersCollection(null);
    await upsertCompletedOrder({ ...baseInput, stripe_payment_intent_id: null }, db);
    expect(updateOne.mock.calls[0][0]).toEqual({
      stripe_session_id: 'cs_test_1',
    });
  });
});

describe('lib/mongo-serialize', () => {
  it('converts ObjectId and Date recursively', () => {
    const id = new ObjectId();
    const when = new Date('2026-07-20T12:00:00.000Z');
    const out = serializeMongoValue({
      _id: id,
      nested: { at: when, ids: [id] },
    }) as { _id: string; nested: { at: string; ids: string[] } };

    expect(out._id).toBe(id.toString());
    expect(out.nested.at).toBe(when.toISOString());
    expect(out.nested.ids[0]).toBe(id.toString());
  });
});
