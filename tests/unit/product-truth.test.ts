/** @jest-environment node */

/**
 * Product-truth guarantees (P0-012 contact, P0-013 newsletter) — G6 / CCR-018.
 *
 * The one invariant these lock in: we NEVER report success for an email-backed
 * action we cannot actually perform. When the provider is unconfigured the
 * newsletter route returns 503 (disabled) and the contact action returns an
 * honest error pointing at a real address — never a fake "success".
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number; headers?: HeadersInit } = {}) => ({
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      json: async () => body,
    }),
  },
}));

// The email layer is mocked per-test so we can toggle "configured" vs not.
jest.mock('@/lib/email/send', () => ({
  isEmailConfigured: jest.fn(),
  subscribeToNewsletter: jest.fn(),
  sendContactMessage: jest.fn(),
  CONTACT_INBOX: 'books@mangu-publishers.com',
}));

// Newsletter route now uses double opt-in + rate limiting — mock both so CI
// with real-looking Upstash/Supabase placeholders cannot hang the suite.
jest.mock('@/lib/email/newsletter', () => ({
  startNewsletterSubscription: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => 'test-client'),
}));

import { POST as newsletterPOST } from '@/app/api/newsletter/route';
import { submitContactMessage } from '@/app/(consumer)/contact/actions';
import { isEmailConfigured, sendContactMessage } from '@/lib/email/send';
import { startNewsletterSubscription } from '@/lib/email/newsletter';
import { enforceRateLimit } from '@/lib/rate-limit';

const mockedIsConfigured = isEmailConfigured as jest.MockedFunction<typeof isEmailConfigured>;
const mockedStartSubscribe = startNewsletterSubscription as jest.MockedFunction<
  typeof startNewsletterSubscription
>;
const mockedSendContact = sendContactMessage as jest.MockedFunction<typeof sendContactMessage>;
const mockedEnforceRateLimit = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>;

function newsletterRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function contactForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validContact = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Question about a title',
  message: 'I would like to ask about availability of a specific book.',
};

beforeEach(() => {
  jest.clearAllMocks();
  // Fresh reset timestamp per test — avoid module-load Date.now() going stale.
  mockedEnforceRateLimit.mockResolvedValue({
    success: true,
    reason: 'ok',
    limit: 30,
    remaining: 29,
    reset: Date.now() + 60_000,
    headers: {},
  });
});

describe('newsletter route (P0-013)', () => {
  it('returns 503 disabled and never subscribes when email is not configured', async () => {
    mockedIsConfigured.mockReturnValue(false);
    const res = await newsletterPOST(newsletterRequest({ email: 'reader@example.com' }));
    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe('disabled');
    expect(mockedStartSubscribe).not.toHaveBeenCalled();
    expect(mockedEnforceRateLimit).not.toHaveBeenCalled();
  });

  it('rejects an invalid email with 400 when configured', async () => {
    mockedIsConfigured.mockReturnValue(true);
    const res = await newsletterPOST(newsletterRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(mockedStartSubscribe).not.toHaveBeenCalled();
  });

  it('returns 502 (not success) when the provider fails', async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedStartSubscribe.mockResolvedValue({ status: 'error', error: new Error('boom') });
    const res = await newsletterPOST(newsletterRequest({ email: 'reader@example.com' }));
    expect(res.status).toBe(502);
    expect((await res.json()).status).toBe('error');
  });

  it('returns 200 success only on a real subscribe', async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedStartSubscribe.mockResolvedValue({ status: 'sent' });
    const res = await newsletterPOST(newsletterRequest({ email: 'reader@example.com' }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('success');
    expect(mockedStartSubscribe).toHaveBeenCalledWith('reader@example.com');
  });

  it('returns 429 when rate limited', async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedEnforceRateLimit.mockResolvedValue({
      success: false,
      reason: 'limited',
      limit: 30,
      remaining: 0,
      reset: Date.now() + 60_000,
      headers: { 'Retry-After': '60' },
    });
    const res = await newsletterPOST(newsletterRequest({ email: 'reader@example.com' }));
    expect(res.status).toBe(429);
    expect((await res.json()).status).toBe('error');
    expect(mockedStartSubscribe).not.toHaveBeenCalled();
  });

  it('returns 503 when rate limiter is unavailable', async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedEnforceRateLimit.mockResolvedValue({
      success: false,
      reason: 'unavailable',
      limit: 30,
      remaining: 0,
      reset: Date.now() + 30_000,
      headers: { 'Retry-After': '30' },
    });
    const res = await newsletterPOST(newsletterRequest({ email: 'reader@example.com' }));
    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe('disabled');
    expect(mockedStartSubscribe).not.toHaveBeenCalled();
  });
});

describe('contact action (P0-012)', () => {
  it('returns an honest error (not success) and never sends when unconfigured', async () => {
    mockedIsConfigured.mockReturnValue(false);
    const state = await submitContactMessage(
      { status: 'idle', message: '' },
      contactForm(validContact)
    );
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/books@mangu-publishers\.com/);
    expect(mockedSendContact).not.toHaveBeenCalled();
  });

  it('surfaces validation errors before any send attempt', async () => {
    mockedIsConfigured.mockReturnValue(true);
    const state = await submitContactMessage(
      { status: 'idle', message: '' },
      contactForm({ ...validContact, email: 'bad', message: 'short' })
    );
    expect(state.status).toBe('error');
    expect(state.fieldErrors?.email).toBeTruthy();
    expect(mockedSendContact).not.toHaveBeenCalled();
  });

  it('reports success only when the message is actually sent', async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedSendContact.mockResolvedValue({ success: true, data: { id: 'e1' } });
    const state = await submitContactMessage(
      { status: 'idle', message: '' },
      contactForm(validContact)
    );
    expect(state.status).toBe('success');
    expect(mockedSendContact).toHaveBeenCalledTimes(1);
  });

  it('reports an honest error when the send fails', async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedSendContact.mockResolvedValue({ success: false, error: new Error('nope') });
    const state = await submitContactMessage(
      { status: 'idle', message: '' },
      contactForm(validContact)
    );
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/books@mangu-publishers\.com/);
  });
});
