/**
 * Client-IP extraction and rate-limit identity tests (directive Phase 6.7).
 */
import { getClientIdentifier, getRateLimitIdentity, isValidIp } from '@/lib/rate-limit';

function req(headers: Record<string, string>): Request {
  // jsdom lacks the fetch-API Request global; the resolver only needs headers.get().
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { get: (name: string) => map.get(name.toLowerCase()) ?? null },
  } as unknown as Request;
}

describe('isValidIp', () => {
  it('accepts valid IPv4', () => {
    expect(isValidIp('203.0.113.7')).toBe(true);
    expect(isValidIp('0.0.0.0')).toBe(true);
    expect(isValidIp('255.255.255.255')).toBe(true);
  });

  it('rejects IPv4 with out-of-range octets', () => {
    expect(isValidIp('999.1.1.1')).toBe(false);
    expect(isValidIp('192.168.1.256')).toBe(false);
  });

  it('accepts IPv6 and IPv4-mapped forms', () => {
    expect(isValidIp('2001:db8::1')).toBe(true);
    expect(isValidIp('::ffff:203.0.113.7')).toBe(true);
    expect(isValidIp('fe80::a634:d9ff:fe51:cf6c')).toBe(true);
  });

  it('rejects hostnames and arbitrary strings', () => {
    expect(isValidIp('example.com')).toBe(false);
    expect(isValidIp('not-an-ip')).toBe(false);
    expect(isValidIp('')).toBe(false);
    expect(isValidIp('203.0.113.7; DROP TABLE users')).toBe(false);
  });
});

describe('getClientIdentifier', () => {
  it('prefers cf-connecting-ip (Cloudflare-verified)', () => {
    const r = req({
      'cf-connecting-ip': '203.0.113.10',
      'x-forwarded-for': '198.51.100.1',
    });
    expect(getClientIdentifier(r)).toBe('203.0.113.10');
  });

  it('uses x-real-ip when no Cloudflare header', () => {
    const r = req({ 'x-real-ip': '203.0.113.11' });
    expect(getClientIdentifier(r)).toBe('203.0.113.11');
  });

  it('takes the RIGHTMOST XFF hop, ignoring a spoofed leftmost value', () => {
    const r = req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.12' });
    expect(getClientIdentifier(r)).toBe('203.0.113.12');
  });

  it('filters malformed entries from the chain', () => {
    const r = req({ 'x-forwarded-for': 'junk, not-an-ip, 203.0.113.13' });
    expect(getClientIdentifier(r)).toBe('203.0.113.13');
  });

  it('supports IPv6 hops', () => {
    const r = req({ 'x-forwarded-for': '1.1.1.1, 2001:db8::1' });
    expect(getClientIdentifier(r)).toBe('2001:db8::1');
  });

  it('rejects a fully spoofed/invalid chain', () => {
    const r = req({ 'x-forwarded-for': 'fake, also-fake' });
    expect(getClientIdentifier(r)).toBe('unknown');
  });

  it('rejects an invalid cf-connecting-ip and falls through', () => {
    const r = req({
      'cf-connecting-ip': 'garbage',
      'x-forwarded-for': '203.0.113.14',
    });
    expect(getClientIdentifier(r)).toBe('203.0.113.14');
  });

  it('returns unknown with no headers', () => {
    expect(getClientIdentifier(req({}))).toBe('unknown');
  });
});

describe('getRateLimitIdentity', () => {
  it('returns the trusted IP when one exists', () => {
    const r = req({ 'x-forwarded-for': '203.0.113.20' });
    expect(getRateLimitIdentity(r)).toBe('203.0.113.20');
  });

  it('never assigns unidentified clients to one shared bucket', () => {
    const a = getRateLimitIdentity(req({ 'user-agent': 'browser-a' }));
    const b = getRateLimitIdentity(req({ 'user-agent': 'browser-b' }));
    expect(a).toMatch(/^anon-[0-9a-f]+$/);
    expect(b).toMatch(/^anon-[0-9a-f]+$/);
    expect(a).not.toBe(b);
    expect(a).not.toBe('unknown');
  });

  it('is stable for the same client surface on the same day', () => {
    const r1 = req({ 'user-agent': 'same-ua', 'accept-language': 'en' });
    const r2 = req({ 'user-agent': 'same-ua', 'accept-language': 'en' });
    expect(getRateLimitIdentity(r1)).toBe(getRateLimitIdentity(r2));
  });

  it('rejects attacker-selected identity headers', () => {
    const r = req({ 'x-forwarded-for': 'ratelimit:auth:victim' });
    expect(getRateLimitIdentity(r)).not.toContain('victim');
  });
});
