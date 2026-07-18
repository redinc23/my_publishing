/** @jest-environment node */

/**
 * MCP transport security (P0-017, G7).
 *
 * Guarantees: the endpoint is disabled by default (404), fail-closed rate
 * limited when enabled, and user search text cannot inject PostgREST filters.
 */

jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => '203.0.113.9'),
}));

import { mcpGuard, sanitizeSearchQuery, isMcpEnabled } from '@/app/api/mcp/[transport]/route';
import { enforceRateLimit } from '@/lib/rate-limit';

const mockedEnforce = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>;
const ORIGINAL_ENV = process.env;

function req(): Request {
  return new Request('https://mangu-publishers.com/api/mcp/mcp', { method: 'POST' });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.MCP_ENABLED;
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

  it('is enabled only for the exact string "true"', () => {
    process.env.MCP_ENABLED = 'TRUE';
    expect(isMcpEnabled()).toBe(false);
    process.env.MCP_ENABLED = 'true';
    expect(isMcpEnabled()).toBe(true);
  });
});

describe('MCP rate limiting (fail closed)', () => {
  it('passes through (null) when under the limit', async () => {
    process.env.MCP_ENABLED = 'true';
    mockedEnforce.mockResolvedValue({
      success: true,
      reason: 'ok',
      limit: 10,
      remaining: 9,
      reset: 0,
      headers: {},
    });
    expect(await mcpGuard(req())).toBeNull();
    expect(mockedEnforce).toHaveBeenCalledWith('api', 'mcp:203.0.113.9');
  });

  it('returns 429 when the limiter rejects (including fail-closed unavailable)', async () => {
    process.env.MCP_ENABLED = 'true';
    mockedEnforce.mockResolvedValue({
      success: false,
      reason: 'unavailable',
      limit: 0,
      remaining: 0,
      reset: Date.now() + 30_000,
      headers: { 'Retry-After': '30' },
    });
    const res = await mcpGuard(req());
    expect(res?.status).toBe(429);
    expect(res?.headers.get('Retry-After')).toBe('30');
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
