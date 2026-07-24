---
name: mangu-observability
description: This skill should be used when working on structured logging, Sentry, rate limiting, Upstash, Retry-After 429s, log drains, alerting, or WS6 hardening for Mangu Publishers.
version: 1.0.0
---

# Observability & Rate Limiting (WS6)

## Logger (`lib/logger.ts`)

JSON shape: `{ level, route, requestId, message, stack }`.
Wrap API handlers; do not log secrets or raw auth cookies.

## Sentry

- Configs: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Wire DSN via env; add `SENTRY_RELEASE` in CI; upload source maps
- Verify events received after deploy (human confirms project UI)

## Rate limit (`lib/ratelimit.ts`)

- `@upstash/ratelimit` sliding window
- `/api/*` → 100 req / 60s per IP
- `/api/auth/*` → 10 req / 60s per IP
- Enforce in `middleware.ts` (Edge-safe REST)
- Response: **429** + `Retry-After`
- Whitelist `/api/health`
- MCP uses shared API bucket via `mcpGuard`

## Alerting

Dashboard alert config is a **HUMAN GATE** (Vercel / Atlas / Upstash / Sentry).
Document click-paths in `HUMAN_TASKS.md`.

## References

- `references/ratelimit-constants.md`
- `references/log-drain.md`
