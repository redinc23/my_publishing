/**
 * Friendly rate-limit responses (enhancement E-003 / WS6-adjacent).
 * Edge-safe — used from middleware.ts.
 *
 * Default OFF: `NEXT_PUBLIC_FEATURE_FRIENDLY_429` must be exactly `true`.
 */

export function isFriendly429Enabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_FRIENDLY_429 === 'true';
}

export function parseRetryAfterSeconds(headers: Record<string, string>): number | null {
  const raw = headers['Retry-After'] || headers['retry-after'];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function wantsHtml(request: Request): boolean {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

/** Build a 429 (or 503) response — plain text by default, JSON/HTML when flag on. */
export function buildRateLimitResponse(
  request: Request,
  result: { reason: string; headers: Record<string, string> }
): Response {
  const status = result.reason === 'unavailable' ? 503 : 429;
  const retryAfter = parseRetryAfterSeconds(result.headers);
  const headers = { ...result.headers };

  if (!isFriendly429Enabled()) {
    return new Response(status === 503 ? 'Service Unavailable' : 'Too Many Requests', {
      status,
      headers,
    });
  }

  const message =
    status === 503
      ? 'Our rate limiter is temporarily unavailable. Please try again shortly.'
      : 'You are making requests too quickly. Please wait a moment and try again.';

  // Browser navigations → dedicated page (keeps JSON APIs machine-readable).
  if (wantsHtml(request) && !new URL(request.url).pathname.startsWith('/api/')) {
    const url = new URL('/too-many-requests', request.url);
    if (retryAfter != null) url.searchParams.set('retry', String(retryAfter));
    if (status === 503) url.searchParams.set('reason', 'unavailable');
    return Response.redirect(url, 302);
  }

  headers['Content-Type'] = 'application/json';
  return new Response(
    JSON.stringify({
      error: status === 503 ? 'rate_limiter_unavailable' : 'rate_limited',
      message,
      retry_after_seconds: retryAfter,
    }),
    { status, headers }
  );
}
