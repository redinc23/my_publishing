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
    json: (body: unknown, init: { status?: number } = {}) => ({
      status: init.status ?? 200,
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

import { POST as newsletterPOST } from '@/app/api/newsletter/route';
import { submitContactMessage } from '@/app/(consumer)/contact/actions';
import { isEmailConfigured, subscribeToNewsletter, sendContactMessage } from '@/lib/email/send';

const mockedIsConfigured = isEmailConfigured as jest.MockedFunction<typeof isEmailConfigured>;
const mockedSubscribe = subscribeToNewsletter as jest.MockedFunction<typeof subscribeToNewsletter>;
const mockedSendContact = sendContactMessage as jest.MockedFunction<typeof sendContactMessage>;

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

beforeEach(() => jest.clearAllMocks());

describe('newsletter route (P0-013)', () => {
  it('returns 503 disabled and never subscribes when email is not configured', async () => {
    mockedIsConfigured.mockReturnValue(false);
    const res = await newsletterPOST(newsletterRequest({ email: 'reader@example.com' }));
    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe('disabled');
    expect(mockedSubscribe).not.toHaveBeenCalled();
  });

  it('rejects an invalid email with 400 when configured', async () => {
    mockedIsConfigured.mockReturnValue(true);
    const res = await newsletterPOST(newsletterRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(mockedSubscribe).not.toHaveBeenCalled();
  });

  it('returns 502 (not success) when the provider fails', async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedSubscribe.mockResolvedValue({ success: false, error: new Error('boom') });
    const res = await newsletterPOST(newsletterRequest({ email: 'reader@example.com' }));
    expect(res.status).toBe(502);
    expect((await res.json()).status).toBe('error');
  });

  it('returns 200 success only on a real subscribe', async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedSubscribe.mockResolvedValue({ success: true });
    const res = await newsletterPOST(newsletterRequest({ email: 'reader@example.com' }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('success');
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
