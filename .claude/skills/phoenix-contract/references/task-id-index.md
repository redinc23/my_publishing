# Phoenix Task ID → Ownership Map

Quick index. Full text lives in `docs/PROJECT_PHOENIX.md` §4.3 / §5.

## WS1 — Auth (PR #1)

| ID  | Focus                              | Primary files                                 |
| --- | ---------------------------------- | --------------------------------------------- |
| 1.x | Better Auth + Mongo adapter        | `lib/auth.ts`, `lib/auth-client.ts`           |
| 1.3 | Auth route handler                 | `app/api/auth/[...all]/route.ts`              |
| 1.4 | Middleware cookie gate             | `middleware.ts`                               |
| 1.7 | Forced reset script + login banner | `scripts/request-password-reset.ts`, login UI |
| —   | Reset email                        | `emails/reset.tsx`                            |

## WS2 — Data (PR #2a–d)

| ID   | Focus                             | Primary files                                      |
| ---- | --------------------------------- | -------------------------------------------------- |
| 2a.1 | Mongo singleton                   | `lib/mongo.ts` (scaffold may use `lib/mongodb.ts`) |
| 2a.2 | Types                             | `types/mongo.ts`                                   |
| 2a.3 | Queries                           | `lib/mongo-queries.ts`                             |
| 2b.1 | API routes + Stripe webhook       | `app/api/**`, webhook handler                      |
| 2c.1 | Server actions + rating recompute | `lib/actions/**`                                   |
| 2c.2 | Audit                             | `lib/audit.ts`                                     |
| 2d.1 | Pages/components data wiring      | `app/**`, `components/**`                          |

## WS3 — Storage (PR #3)

| ID  | Focus                    | Primary files                    |
| --- | ------------------------ | -------------------------------- |
| 3.1 | Blob + remotePatterns    | `@vercel/blob`, `next.config.js` |
| 3.2 | Upload action            | `lib/actions/upload.ts`          |
| 3.3 | Gated download           | `app/api/files/[id]/route.ts`    |
| 3.4 | Storage migration script | `scripts/migrate-storage.ts`     |

## WS4 — Health / env / cleanup (PR #4)

| ID  | Focus                  | Primary files                                   |
| --- | ---------------------- | ----------------------------------------------- |
| 4.1 | Ready health           | `app/api/health/route.ts`                       |
| 4.x | Env Zod schema         | `lib/utils/env-validation.ts`                   |
| 4.x | Purge Supabase clients | delete `lib/supabase/`, uninstall `@supabase/*` |

## WS5 — Tests (PR #5)

Mongo/Better Auth mocks, webhook idempotency, rating recompute, E2E auth + purchase.

## WS6 — Observability (PR #6)

| ID  | Focus          | Primary files                       |
| --- | -------------- | ----------------------------------- |
| 6.x | Logger         | `lib/logger.ts`                     |
| 6.3 | Rate limit     | `lib/ratelimit.ts`, `middleware.ts` |
| 6.x | Sentry release | `sentry.*.config.ts`, CI            |

## Phase 11 scripts (agent writes; human runs)

`export-supabase.sh`, `transform-data.ts`, `migrate-storage.ts`, `export-delta.ts`,
`send-forced-resets.ts`, `verify-migration.mongo.js`
