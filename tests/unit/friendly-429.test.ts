/** @jest-environment node */

import {
  buildRateLimitResponse,
  isFriendly429Enabled,
  parseRetryAfterSeconds,
  wantsHtml,
} from '@/lib/rate-limit-response';

const ORIGINAL = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL };
  delete process.env.NEXT_PUBLIC_FEATURE_FRIENDLY_429;
});

afterAll(() => {
  process.env = ORIGINAL;
});

describe('friendly 429 helpers', () => {
  it('is off by default', () => {
    expect(isFriendly429Enabled()).toBe(false);
  });

  it('parses Retry-After seconds', () => {
    expect(parseRetryAfterSeconds({ 'Retry-After': '12' })).toBe(12);
    expect(parseRetryAfterSeconds({})).toBeNull();
  });

  it('detects HTML accept', () => {
    expect(wantsHtml(new Request('https://x.test/', { headers: { Accept: 'text/html' } }))).toBe(
      true
    );
    expect(
      wantsHtml(new Request('https://x.test/api/x', { headers: { Accept: 'application/json' } }))
    ).toBe(false);
  });

  it('returns plain text when flag off', async () => {
    const res = buildRateLimitResponse(new Request('https://x.test/login'), {
      reason: 'limited',
      headers: { 'Retry-After': '5' },
    });
    expect(res.status).toBe(429);
    expect(await res.text()).toBe('Too Many Requests');
  });

  it('returns JSON with message when flag on for API', async () => {
    process.env.NEXT_PUBLIC_FEATURE_FRIENDLY_429 = 'true';
    const res = buildRateLimitResponse(
      new Request('https://x.test/api/newsletter', {
        headers: { Accept: 'application/json' },
      }),
      { reason: 'limited', headers: { 'Retry-After': '8' } }
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
    expect(body.retry_after_seconds).toBe(8);
    expect(body.message).toMatch(/too quickly/i);
  });

  it('redirects HTML navigations to /too-many-requests when flag on', () => {
    process.env.NEXT_PUBLIC_FEATURE_FRIENDLY_429 = 'true';
    const res = buildRateLimitResponse(
      new Request('https://x.test/login', { headers: { Accept: 'text/html' } }),
      { reason: 'limited', headers: { 'Retry-After': '3' } }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/too-many-requests?retry=3');
  });
});
