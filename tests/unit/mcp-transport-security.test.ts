/** @jest-environment node */

/**
 * MCP transport security (P0-017, G7).
 *
 * Guarantees: the endpoint is disabled by default (404), fail-closed rate
 * limited when enabled (429), requires Bearer authentication when enabled
 * (401), fails closed as disabled when enabled without a configured key
 * (404), and user search text cannot inject PostgREST filters.
 */

jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => '203.0.113.9'),
}));

import { mcpGuard, sanitizeSearchQuery, isMcpEnabled, isValidMcpApiKey } from '@/lib/mcp/guard';
import { enforceRateLimit } from '@/lib/rate-limit';

const mockedEnforce = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>;
const ORIGINAL_ENV = process.env;

const TEST_KEY = 'test-mcp-key-0123456789abcdef';

function req(auth?: string): Request {
  return new Request('https://mangu-publishers.com/api/mcp/mcp', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : undefined,
  });
}

function mockRateLimitOk(): void {
  mockedEnforce.mockResolvedValue({
    success: true,
    reason: 'ok',
    limit: 10,
    remaining: 9,
    reset: 0,
    headers: {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.MCP_ENABLED;
  delete process.env.MCP_API_KEY;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('MCP enable gate', () => {
  it('is disabled by default', () => {
    expect(isMcpEnabled()).toBe(false);
  });

  it('returns 404 and never rate-limits when disabled', async () => {
    const res = await mcpGuard(req());
    expect(res?.status).toBe(404);
    expect(mockedEnforce).not.toHaveBeenCalled();
  });

  it('returns 404 even with a valid-looking Bearer header when disabled', async () => {
    process.env.MCP_API_KEY = TEST_KEY;
    const res = await mcpGuard(req(`Bearer ${TEST_KEY}`));
    expect(res?.status).toBe(404);
    expect(mockedEnforce).not.toHaveBeenCalled();
  });

  it('is enabled only for the exact string "true"', () => {
    process.env.MCP_ENABLED = 'TRUE';
    expect(isMcpEnabled()).toBe(false);
    process.env.MCP_ENABLED = 'true';
    expect(isMcpEnabled()).toBe(true);
  });
});

describe('MCP rate limiting (fail closed)', () => {
  it('passes through (null) when enabled, authenticated and under the limit', async () => {
    process.env.MCP_ENABLED = 'true';
    process.env.MCP_API_KEY = TEST_KEY;
    mockRateLimitOk();
    expect(await mcpGuard(req(`Bearer ${TEST_KEY}`))).toBeNull();
    expect(mockedEnforce).toHaveBeenCalledWith('api', 'mcp:203.0.113.9');
  });

  it('returns 429 when the limiter rejects (including fail-closed unavailable)', async () => {
    process.env.MCP_ENABLED = 'true';
    process.env.MCP_API_KEY = TEST_KEY;
    mockedEnforce.mockResolvedValue({
      success: false,
      reason: 'unavailable',
      limit: 0,
      remaining: 0,
      reset: Date.now() + 30_000,
      headers: { 'Retry-After': '30' },
    });
    const res = await mcpGuard(req(`Bearer ${TEST_KEY}`));
    expect(res?.status).toBe(429);
    expect(res?.headers.get('Retry-After')).toBe('30');
  });

  it('rate-limits before auth so Bearer-key brute force is also capped', async () => {
    process.env.MCP_ENABLED = 'true';
    process.env.MCP_API_KEY = TEST_KEY;
    mockedEnforce.mockResolvedValue({
      success: false,
      reason: 'limited',
      limit: 30,
      remaining: 0,
      reset: Date.now() + 60_000,
      headers: { 'Retry-After': '60' },
    });
    // No Authorization header at all — still 429 (limiter runs first).
    const res = await mcpGuard(req());
    expect(res?.status).toBe(429);
  });
});

describe('MCP authentication (when enabled)', () => {
  beforeEach(() => {
    process.env.MCP_ENABLED = 'true';
    mockRateLimitOk();
  });

  it('fails closed as 404 when enabled but MCP_API_KEY is not configured', async () => {
    const res = await mcpGuard(req());
    expect(res?.status).toBe(404);
    expect(await res?.json()).toEqual({ error: 'not_found' });
  });

  it('returns 401 with WWW-Authenticate when the Authorization header is missing', async () => {
    process.env.MCP_API_KEY = TEST_KEY;
    const res = await mcpGuard(req());
    expect(res?.status).toBe(401);
    expect(res?.headers.get('WWW-Authenticate')).toContain('Bearer');
    expect(await res?.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 401 for a wrong key', async () => {
    process.env.MCP_API_KEY = TEST_KEY;
    const res = await mcpGuard(req('Bearer definitely-the-wrong-key'));
    expect(res?.status).toBe(401);
  });

  it('returns 401 for a malformed Authorization header', async () => {
    process.env.MCP_API_KEY = TEST_KEY;
    expect((await mcpGuard(req(`Basic ${TEST_KEY}`)))?.status).toBe(401);
    expect((await mcpGuard(req('Bearer')))?.status).toBe(401);
  });

  it('accepts the exact key (scheme matched case-insensitively)', async () => {
    process.env.MCP_API_KEY = TEST_KEY;
    expect(await mcpGuard(req(`Bearer ${TEST_KEY}`))).toBeNull();
    expect(await mcpGuard(req(`bearer ${TEST_KEY}`))).toBeNull();
  });

  it('key comparison is constant-time safe across lengths', () => {
    expect(isValidMcpApiKey('short', TEST_KEY)).toBe(false);
    expect(isValidMcpApiKey(TEST_KEY, TEST_KEY)).toBe(true);
    expect(isValidMcpApiKey(`${TEST_KEY}x`, TEST_KEY)).toBe(false);
  });
});

describe('search query sanitization', () => {
  it('strips PostgREST filter metacharacters', () => {
    expect(sanitizeSearchQuery('a,b(c)d%e*f\\g:h')).toBe('a b c d e f g h');
  });

  it('neutralizes an .or() injection attempt', () => {
    // The comma/percent that would break out of the ilike pattern are gone,
    // so the payload can no longer add a filter condition.
    const out = sanitizeSearchQuery('x%,visibility.eq.private');
    expect(out).not.toMatch(/[,()%*\\:]/);
    expect(out).toBe('x visibility.eq.private');
  });

  it('caps length at 100 characters', () => {
    expect(sanitizeSearchQuery('a'.repeat(500)).length).toBe(100);
  });
});
