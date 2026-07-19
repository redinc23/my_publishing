/** @jest-environment node */

/**
 * Fail-closed route contract (P0-011 / CCR-007, issue #195).
 *
 * When Upstash is unreachable, `enforceRateLimit` resolves
 * `{ success: false, reason: 'unavailable' }` and every protected route must
 * REJECT (503 + Retry-After) instead of serving the request unthrottled.
 * These three routes previously inspected only `reason === 'limited'` and
 * silently allowed traffic during a Redis outage — these tests pin the
 * fail-closed behavior so the regression cannot return.
 */

import { GET as confirmGET } from '@/app/api/newsletter/confirm/route';
import { GET as unsubscribeGET } from '@/app/api/newsletter/unsubscribe/route';
import { PUT as preferencesPUT } from '@/app/api/email/preferences/route';
import { enforceRateLimit } from '@/lib/rate-limit';
import { confirmNewsletterSubscription, unsubscribeByToken } from '@/lib/email/newsletter';
import { createClient } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number; headers?: HeadersInit } = {}) => ({
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      json: async () => body,
    }),
    redirect: (url: string, status = 307) => ({
      status,
      headers: new Headers({ Location: url }),
      json: async () => ({}),
    }),
  },
}));
jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => 'test-client'),
}));
jest.mock('@/lib/email/newsletter', () => ({
  confirmNewsletterSubscription: jest.fn(),
  unsubscribeByToken: jest.fn(),
}));
jest.mock('@/lib/email/urls', () => ({
  getEmailBaseUrl: jest.fn(() => 'https://site.test'),
}));
jest.mock('@/lib/email/preferences', () => ({
  DEFAULT_EMAIL_PREFERENCES: { marketing: false, receipts: true, author_alerts: true },
  isMissingTableError: jest.fn(() => false),
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));

const mockedEnforce = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>;
const mockedConfirm = confirmNewsletterSubscription as jest.MockedFunction<
  typeof confirmNewsletterSubscription
>;
const mockedUnsubscribe = unsubscribeByToken as jest.MockedFunction<typeof unsubscribeByToken>;
const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;

const VALID_TOKEN = 'a'.repeat(32);

function getRequest(url: string): NextRequest {
  return { headers: new Headers(), nextUrl: new URL(url) } as unknown as NextRequest;
}

function putRequest(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

/** Limiter state when Upstash is down/unreachable in production (fail-closed). */
function mockLimiterUnavailable() {
  mockedEnforce.mockResolvedValue({
    success: false,
    reason: 'unavailable',
    limit: 30,
    remaining: 0,
    reset: Date.now() + 30_000,
    headers: { 'Retry-After': '30' },
  });
}

function mockLimiterLimited() {
  mockedEnforce.mockResolvedValue({
    success: false,
    reason: 'limited',
    limit: 30,
    remaining: 0,
    reset: Date.now() + 30_000,
    headers: { 'Retry-After': '30', 'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '0' },
  });
}

function mockLimiterOk() {
  mockedEnforce.mockResolvedValue({
    success: true,
    reason: 'ok',
    limit: 30,
    remaining: 29,
    reset: Date.now() + 60_000,
    headers: { 'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '29' },
  });
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/newsletter/confirm', () => {
  it('fails closed with 503 and never touches the subscription when the limiter is unavailable', async () => {
    mockLimiterUnavailable();

    const res = await confirmGET(
      getRequest(`https://x.test/api/newsletter/confirm?token=${VALID_TOKEN}`)
    );

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(mockedConfirm).not.toHaveBeenCalled();
  });

  it('rejects 429 when limited', async () => {
    mockLimiterLimited();

    const res = await confirmGET(
      getRequest(`https://x.test/api/newsletter/confirm?token=${VALID_TOKEN}`)
    );

    expect(res.status).toBe(429);
    expect(mockedConfirm).not.toHaveBeenCalled();
  });

  it('confirms and redirects when the limiter allows', async () => {
    mockLimiterOk();
    mockedConfirm.mockResolvedValue('confirmed');

    const res = await confirmGET(
      getRequest(`https://x.test/api/newsletter/confirm?token=${VALID_TOKEN}`)
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://site.test/?newsletter=confirmed');
    expect(mockedConfirm).toHaveBeenCalledWith(VALID_TOKEN);
  });
});

describe('GET /api/newsletter/unsubscribe', () => {
  it('fails closed with 503 and never touches the subscription when the limiter is unavailable', async () => {
    mockLimiterUnavailable();

    const res = await unsubscribeGET(
      getRequest(`https://x.test/api/newsletter/unsubscribe?token=${VALID_TOKEN}`)
    );

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(mockedUnsubscribe).not.toHaveBeenCalled();
  });

  it('rejects 429 when limited', async () => {
    mockLimiterLimited();

    const res = await unsubscribeGET(
      getRequest(`https://x.test/api/newsletter/unsubscribe?token=${VALID_TOKEN}`)
    );

    expect(res.status).toBe(429);
    expect(mockedUnsubscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes and redirects when the limiter allows', async () => {
    mockLimiterOk();
    mockedUnsubscribe.mockResolvedValue('unsubscribed');

    const res = await unsubscribeGET(
      getRequest(`https://x.test/api/newsletter/unsubscribe?token=${VALID_TOKEN}`)
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://site.test/?newsletter=unsubscribed');
    expect(mockedUnsubscribe).toHaveBeenCalledWith(VALID_TOKEN);
  });
});

describe('PUT /api/email/preferences', () => {
  it('fails closed with 503 and never reaches the database when the limiter is unavailable', async () => {
    mockLimiterUnavailable();

    const res = await preferencesPUT(putRequest({ marketing: true }));

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('rejects 429 when limited', async () => {
    mockLimiterLimited();

    const res = await preferencesPUT(putRequest({ marketing: true }));

    expect(res.status).toBe(429);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('persists preferences when the limiter allows', async () => {
    mockLimiterOk();
    const row = { marketing: true, receipts: true, author_alerts: false };
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q: any = {};
        q.upsert = jest.fn(() => q);
        q.select = jest.fn(() => q);
        q.single = jest.fn().mockResolvedValue({ data: row, error: null });
        return q;
      }),
    } as never);

    const res = await preferencesPUT(putRequest({ marketing: true }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ preferences: row, persisted: true });
  });
});
