# Middleware Matcher Guidance

## Public (examples — refine in WS1 PR)

- Marketing / catalog read paths as product requires
- `/login`, `/register`, `/api/auth/*`, `/api/health`
- MCP endpoint only when intentionally public + `MCP_ENABLED` (still rate limited)

## Protected (minimum)

- `/dashboard*`
- `/admin*`
- `/api/files*`

## Pattern

```ts
// Pseudocode — cookie only on Edge
const sessionCookie = getSessionCookie(request);
if (isProtected(pathname) && !sessionCookie) {
  return redirectToLogin(request);
}
// Optional: Upstash rate limit (edge-safe REST) — WS6
```

Full session + role checks happen off-edge.
