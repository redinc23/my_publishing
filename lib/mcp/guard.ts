/**
 * MCP gate + auth + rate-limit guard and input sanitization.
 *
 * Extracted from the route handler so Next.js doesn't flag these as invalid
 * route exports (Next.js route files may only export HTTP method handlers and
 * route-segment config).
 *
 * Decision (P0-017, issue #200 — recorded in docs/MCP_SERVER.md): the public
 * MCP transport is a non-launch surface, so it is DISABLED by default (404).
 * It is served only when `MCP_ENABLED=true`, and then only to clients
 * presenting `Authorization: Bearer ${MCP_API_KEY}` (401 otherwise), behind
 * the shared fail-closed rate limiter (429 when limited/unavailable). If
 * `MCP_ENABLED=true` but `MCP_API_KEY` is not configured, the endpoint fails
 * closed as if disabled — it can never be reachable unauthenticated.
 */

import { createHash, timingSafeEqual } from 'crypto';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

/** MCP is off unless explicitly enabled — read per-request so it's togglable. */
export function isMcpEnabled(): boolean {
  return process.env.MCP_ENABLED === 'true';
}

/**
 * The key MCP clients must present when the transport is enabled. Read
 * per-request so rotation is an env change, not a code change. An unset/empty
 * key is returned as undefined so callers can fail closed on misconfiguration.
 */
function getMcpApiKey(): string | undefined {
  const key = process.env.MCP_API_KEY;
  return key && key.length > 0 ? key : undefined;
}

/**
 * Constant-time key comparison. Both sides are SHA-256 hashed first so
 * `timingSafeEqual` always compares equal-length buffers and neither the key
 * length nor a matching prefix is leaked via early-exit timing.
 */
export function isValidMcpApiKey(provided: string, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

/**
 * Extract and verify the Bearer credential. True only when the request carries
 * `Authorization: Bearer <MCP_API_KEY>` with an exact key match (the scheme is
 * matched case-insensitively per RFC 7235).
 */
export function hasValidMcpAuthorization(request: Request, apiKey: string): boolean {
  const header = request.headers.get('authorization');
  if (!header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  return isValidMcpApiKey(match[1].trim(), apiKey);
}

/**
 * Strip characters that are significant in the PostgREST filter grammar so
 * user-supplied search text cannot break out of an `ilike` pattern or inject
 * additional `.or()` conditions. Also caps length.
 */
export function sanitizeSearchQuery(input: string): string {
  return input
    .replace(/[,()%*\\:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function jsonResponse(
  status: number,
  body: Record<string, string>,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/**
 * Gate + rate-limit + auth guard applied before the MCP handler runs. Returns
 * a Response to short-circuit, or null to proceed:
 *  - 404 when disabled (default) or enabled-but-misconfigured (fail closed);
 *  - 429 when the fail-closed rate limiter rejects (limited or unavailable) —
 *    checked before auth so Bearer-key brute force is also capped;
 *  - 401 when enabled and the Bearer key is missing or invalid.
 */
export async function mcpGuard(request: Request): Promise<Response | null> {
  if (!isMcpEnabled()) {
    return jsonResponse(404, { error: 'not_found' });
  }

  const result = await enforceRateLimit('api', `mcp:${getClientIdentifier(request)}`);
  if (!result.success) {
    return jsonResponse(429, { error: 'rate_limited', reason: result.reason }, result.headers);
  }

  // Authentication (fail closed): an enabled transport without a configured
  // key is treated as disabled — it must never be reachable unauthenticated.
  const apiKey = getMcpApiKey();
  if (!apiKey) {
    console.error('[mcp] MCP_ENABLED=true but MCP_API_KEY is not set — failing closed (404).');
    return jsonResponse(404, { error: 'not_found' });
  }
  if (!hasValidMcpAuthorization(request, apiKey)) {
    return jsonResponse(
      401,
      { error: 'unauthorized' },
      { 'WWW-Authenticate': 'Bearer realm="mcp"' }
    );
  }

  return null;
}
