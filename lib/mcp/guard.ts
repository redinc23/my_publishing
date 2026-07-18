/**
 * MCP gate + rate-limit guard and input sanitization.
 *
 * Extracted from the route handler so Next.js doesn't flag these as invalid
 * route exports (Next.js route files may only export HTTP method handlers and
 * route-segment config).
 */

import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

/** MCP is off unless explicitly enabled — read per-request so it's togglable. */
export function isMcpEnabled(): boolean {
  return process.env.MCP_ENABLED === 'true';
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

/**
 * Gate + rate-limit guard applied before the MCP handler runs. Returns a
 * Response to short-circuit (404 disabled / 429 limited), or null to proceed.
 */
export async function mcpGuard(request: Request): Promise<Response | null> {
  if (!isMcpEnabled()) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await enforceRateLimit('api', `mcp:${getClientIdentifier(request)}`);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'rate_limited', reason: result.reason }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...result.headers },
    });
  }

  return null;
}
