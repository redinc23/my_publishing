/** @jest-environment node */

/**
 * Phoenix 2b.1.4 — Mongo webhook path: deliver checkout.session.completed twice
 * → one upsert call with $setOnInsert; both responses are success/200 semantics.
 */

import { POST as postWebhook } from '@/app/api/webhook/route';
import { isMongoPrimary } from '@/lib/db/provider';
import { upsertOrderByPaymentIntent, markOrderRefundedByPaymentIntent } from '@/lib/mongo-queries';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getStripe } from '@/lib/stripe/server';
import { sendPurchaseReceiptForCheckoutSession } from '@/lib/email/triggers';
import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number; headers?: HeadersInit } = {}) => ({
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: jest.fn(() => true),
  getDatabaseProvider: jest.fn(() => 'mongodb'),
}));
jest.mock('@/lib/mongo-queries', () => ({
  upsertOrderByPaymentIntent: jest.fn(),
  markOrderRefundedByPaymentIntent: jest.fn(),
}));
jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => 'stripe-ip'),
}));
jest.mock('@/lib/stripe/server', () => ({
  getStripe: jest.fn(),
}));
jest.mock('@/lib/email/triggers', () => ({
  sendPurchaseReceiptForCheckoutSession: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => {
    throw new Error('Supabase admin must not be used on Mongo webhook path');
  }),
}));

const mockedIsMongo = isMongoPrimary as jest.MockedFunction<typeof isMongoPrimary>;
const mockedUpsert = upsertOrderByPaymentIntent as jest.MockedFunction<
  typeof upsertOrderByPaymentIntent
>;
const mockedRefund = markOrderRefundedByPaymentIntent as jest.MockedFunction<
  typeof markOrderRefundedByPaymentIntent
>;
const mockedEnforce = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>;
const mockedGetStripe = getStripe as jest.MockedFunction<typeof getStripe>;

function webhookRequest(event: unknown, signature = 'sig_test'): NextRequest {
  return {
    headers: new Headers({ 'stripe-signature': signature }),
    text: jest.fn().mockResolvedValue(JSON.stringify(event)),
  } as unknown as NextRequest;
}

describe('webhook Mongo idempotency (2b.1.4)', () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockedIsMongo.mockReturnValue(true);
    mockedEnforce.mockResolvedValue({
      success: true,
      reason: 'ok',
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
      headers: {},
    });
    mockedGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn((_payload: string, _sig: string, _secret: string) => {
          // overwritten per test via mockImplementation
          throw new Error('constructEvent not stubbed');
        }),
      },
    } as never);
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  function stubEvent(event: unknown) {
    mockedGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue(event),
      },
    } as never);
  }

  it('upserts order once semantics across two deliveries and returns 200 both times', async () => {
    const session = {
      id: 'cs_test_1',
      payment_intent: 'pi_test_1',
      amount_total: 1999,
      currency: 'usd',
      metadata: { book_id: 'book-1', user_id: 'user-1', book_slug: 'demo' },
    };
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: session },
    };

    stubEvent(event);
    mockedUpsert
      .mockResolvedValueOnce({ upserted: true, orderId: 'ord_1' })
      .mockResolvedValueOnce({ upserted: false, orderId: 'ord_1' });

    const first = await postWebhook(webhookRequest(event));
    const second = await postWebhook(webhookRequest(event));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockedUpsert).toHaveBeenCalledTimes(2);
    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_payment_intent_id: 'pi_test_1',
        user_id: 'user-1',
      })
    );
    expect(sendPurchaseReceiptForCheckoutSession).toHaveBeenCalled();

    const body1 = await first.json();
    const body2 = await second.json();
    expect(body1.received).toBe(true);
    expect(body2.received).toBe(true);
    expect(String(body1.result.action_taken)).toMatch(/created/i);
    expect(String(body2.result.action_taken)).toMatch(/already existed/i);
  });

  it('treats duplicate-key errors as success (200)', async () => {
    const session = {
      id: 'cs_test_2',
      payment_intent: 'pi_test_2',
      amount_total: 500,
      currency: 'usd',
      metadata: { book_id: 'book-2', user_id: 'user-2' },
    };
    const event = {
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: { object: session },
    };
    stubEvent(event);
    const dup = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    mockedUpsert.mockRejectedValue(dup);

    const res = await postWebhook(webhookRequest(event));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(String(body.result.action_taken)).toMatch(/duplicate/i);
  });

  it('marks refunds on Mongo without touching Supabase', async () => {
    const charge = {
      id: 'ch_1',
      payment_intent: 'pi_refund',
      refunds: { data: [{ reason: 'requested_by_customer' }] },
    };
    const event = {
      id: 'evt_refund',
      type: 'charge.refunded',
      data: { object: charge },
    };
    stubEvent(event);
    mockedRefund.mockResolvedValue(true);

    const res = await postWebhook(webhookRequest(event));
    expect(res.status).toBe(200);
    expect(mockedRefund).toHaveBeenCalledWith('pi_refund', 'requested_by_customer');
  });
});
