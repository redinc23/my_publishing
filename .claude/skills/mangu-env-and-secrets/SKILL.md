---
name: mangu-env-and-secrets
description: This skill should be used when the user asks about environment variables, validate-env, .env.local, Vercel env promotion, missing MONGODB_URI or BETTER_AUTH secrets, SUPABASE_SERVICE_ROLE_KEY TEMP usage, or secret hygiene for Mangu Publishers / Phoenix.
version: 1.0.0
---

# Env & Secrets

## Rules

1. **No secrets in the repo.** Ever. Templates only in `.env*.example`.
2. Missing secret → append `HUMAN_TASKS.md` with exact var + where to create it. Continue unblocked work.
3. Fail fast via Zod env validation (`lib/utils/env-validation.ts` — WS4 target).
4. Local: `cp .env.local.example .env.local` then `npm run validate-env`.
5. Do not set `NODE_ENV=production` in `.env.local`.

## Naming (recon D4)

Prefer **`NEXT_PUBLIC_SITE_URL`** (already wired). Phoenix doc §9.1 may say `NEXT_PUBLIC_APP_URL` —
amend doc rather than renaming live vars without cause.

## Phoenix target vars

See `references/env-matrix.md` for local / preview / prod / TEMP.

Core Phoenix set includes: `MONGODB_URI`, `DATABASE_PROVIDER=mongodb`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, Stripe trio (+ publishable), `BLOB_READ_WRITE_TOKEN`, Upstash URL/token,
`RESEND_API_KEY`, Sentry DSNs (+ build trio where used), `NEXT_PUBLIC_SITE_URL`,
`MCP_ENABLED` (default unset/false), and TEMP `SUPABASE_SERVICE_ROLE_KEY` until Phase 14.

Survivors outside minimal §9.1: `OPENAI_API_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
Sentry `ORG` / `PROJECT` / `AUTH_TOKEN` for source maps (recon D5).

## TEMP Supabase

`SUPABASE_SERVICE_ROLE_KEY` may exist in env for `migrate-storage` + export-delta **only**.
It must not appear in application runtime code after WS4. Remove at P14.4 (human).

## Forbidden

See `references/forbidden-patterns.md`.

## Agent workflow when env is wrong

1. Identify missing/invalid vars from validation errors.
2. Point human to console click-path in `HUMAN_TASKS.md`.
3. Do not invent placeholder secrets that look real.
4. Prefer mock/test modes for unit tests over live credentials.
