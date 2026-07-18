# PHOENIX RECON — Phase 0 Report

**Per:** `CLAUDE.md` (execution briefing) §3 · **Contract:** `docs/PROJECT_PHOENIX.md` v4.0
**Baseline commit:** `main` @ `464edaa` · **Date:** 2026-07-18
**Verdict:** Migration has NOT started on `main`. Zero MongoDB/Better Auth/Vercel Blob code is merged. Scaffolding exists only on `cursor/mongodb-scaffold-dffa`. The Phoenix doc's core assumptions hold, with the deltas listed in §9.

---

## 1. Routing reality

**App Router is authoritative.** `app/` contains the full application: route groups `(auth)`, `(consumer)`, `(portals)`, plus `admin/`, `api/`, `checkout/`, `dashboard/`, `users/`, root `layout.tsx`/`page.tsx`, `sitemap.ts`, `robots.ts`.

`pages/` contains exactly one file — `_document.tsx` — which is a Pages Router artifact that App Router never renders. It is dead code (→ Delta D1, remove in WS4).

`vercel.json` is minimal (`buildCommand`, `framework: nextjs`, region `iad1`) and routing-neutral. **The Phoenix doc's App Router file paths (`app/api/...`, `app/(auth)/actions.ts`) are correct as written. No doc amendment needed for WS1 paths.**

## 2. Migration branch inventory (`cursor/mongodb-scaffold-dffa`)

5 commits ahead of `main`, none merged. Contents:

| Asset                                                                                                                                                                                                                             | Notes                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `lib/mongodb.ts`                                                                                                                                                                                                                  | Mongo client module (doc says `lib/mongo.ts` → Delta D2)                   |
| `lib/db/provider.ts` + unit test                                                                                                                                                                                                  | DB provider toggle                                                         |
| `scripts/atlas-bootstrap.ts`, `scripts/lib/atlas-admin.ts` (digest auth), `scripts/mongo-up.ts`, `mongo-ping.ts`, `mongo-ensure-indexes.ts`, `mongo-import-uri.ts`, `sync-mongodb-to-vercel.ts`, `scripts/lib/env-file.ts` + test | Fulfills the doc's `npm run db:mongo:up\|ping\|indexes` requirement (P5.x) |
| `.github/workflows/mongo-up.yml`                                                                                                                                                                                                  | Atlas bootstrap workflow                                                   |
| `docs/adr/ADR-002-mongodb-data-platform.md`                                                                                                                                                                                       | Decision record                                                            |
| `package.json`: `mongodb ^7.5.0`, `digest-fetch ^3.1.1`; scripts `db:atlas:bootstrap`, `db:mongo:{up,ping,indexes,import-uri,sync-vercel}`                                                                                        |                                                                            |
| Reworked `app/api/health/route.ts`                                                                                                                                                                                                | Mongo-aware health check (overlaps WS4 Task 4.x)                           |

**Not present on the branch:** `better-auth`, `@vercel/blob`, any app-layer/data-layer changes, `types/mongo.ts`, `lib/mongo-queries.ts`. WS1/WS3 start from zero as the doc assumes. **Resolution: reuse the branch's infra scripts and client module in WS2/WS4 PRs (cherry-pick or re-base), rather than re-writing.**

## 3. package.json audit (`main`)

- **Present (legacy, WS4 removes):** `@supabase/ssr ^0.12.3`, `@supabase/supabase-js ^2.110.7`
- **Absent (to add):** `better-auth` (WS1), `mongodb` (WS2 — take `^7.5.0` from scaffold), `@vercel/blob` (WS3)
- **Already present (doc requires — no action):** `@upstash/ratelimit 1.1.3`, `@upstash/redis ^1.32.0`, `resend ^3.2.0`
- Next.js `14.2.35`, Jest + Playwright + Sentry configs all present as the briefing's §1 repo facts state.

## 4. Existing auth/data surface (what WS1–WS2d must touch)

`grep -ri supabase` over `app/ lib/ components/ types/` → **643 occurrences across 96 files.** Concentrations:

- **Core clients (delete in WS4):** `lib/supabase/{client,server,admin,edge-auth,queries,public-queries,portal-queries,author-ownership}.ts` (+ test)
- **Auth flows (WS1):** `app/(auth)/{login,register,reset-password,verify-email,callback}/*`, `lib/middleware/auth.ts`, `middleware.ts`, `app/api/session/route.ts`
- **Data/actions (WS2):** `lib/actions/*` (books 52 hits, reviews, follows, reading-list, revenue, payouts, analytics, export-data, upload, users, partner), `app/api/{webhook,checkout,health,upload,analytics,resonance}/*`, `lib/{reading/entitlement,resonance/*,services/realtime-analytics}.ts`
- **Pages/UI (WS2d):** admin pages, `app/dashboard/*`, `app/checkout/page.tsx`, `app/(consumer)/books/[slug]/page.tsx`, `app/sitemap.ts`, layout DNS-prefetch
- **Ops scripts (WS4 retire/replace):** `setup.sh` (28 refs), `pre-launch-verify.sh` (9), `scripts/{run-migrations,seed-database,verify-rls,role-crawl}.ts`
- **Legacy dir:** `supabase/migrations/` (WS4)

Per-file → Task-ID mapping will be enumerated in each WS PR body (the WS PRs are the unit of accountability per briefing §4).

## 5. Existing scripts

`main` has `db:seed`, `db:migrate`, `verify-rls` (all Supabase-era; retire in WS4) and `validate-env` (gates `npm run dev`). **No `db:mongo:*` scripts exist on `main`** — they exist on the scaffold branch (§2) and should be adopted, not re-written (→ Delta D3).

## 6. Env examples vs Phoenix §9.1

- `.env.example` is a one-line pointer stub, not a real example (→ Delta D6).
- `.env.local.example` / `.env.production.example` (superset) currently carry: 3× `SUPABASE_*`, 3× Stripe, `NEXT_PUBLIC_SITE_URL`, 2× Upstash, 5× Sentry (`DSN`, `NEXT_PUBLIC_DSN`, `ORG`, `PROJECT`, `AUTH_TOKEN`), and `OPENAI_API_KEY` (prod only).
- **Missing vs doc §9.1:** `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`
- **Naming conflict:** repo uses `NEXT_PUBLIC_SITE_URL`; doc §9.1 says `NEXT_PUBLIC_APP_URL` (→ Delta D4)
- **Undocumented in doc:** `OPENAI_API_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, Sentry build-time trio (→ Delta D5)

## 7. CI inventory (19 workflows)

- **Supabase/GCP-touching (WS4 retires or scrubs):** `supabase-migrate.yml`, `rls-check.yml`, `deploy.yml`, `health-check.yml`, `ci.yml`, `e2e.yml`, `preview-e2e.yml`, `container-scan.yml`, `copilot-setup-steps.yml`, plus `cloudbuild.yaml` + `Dockerfile` (legacy GCP Cloud Run — keep on standby until Phase 13/14 per rollback rule)
- **Neutral (keep):** `format-check.yml`, `codeql.yml`, `dependency-review.yml`, `npm-audit.yml`, `lighthouse-ci.yml`, `auto-merge.yml`, `bug-to-issue.yml`, `stale.yml`, `release-please.yml`, `admin-setup.yml`
- **Incoming from scaffold branch:** `mongo-up.yml`
- **Test jobs for WS5 to extend:** `ci.yml` (jest), `e2e.yml` / `preview-e2e.yml` (Playwright)

## 8. Test baseline (2026-07-18, `main` + this branch)

- **Jest: 24/24 suites, 127/127 tests PASS** (2.9s; one worker-teardown warning — pre-existing, benign). This is the floor: no WS PR may go below it.
- **Playwright: not runnable in this environment.** `playwright.config.ts` boots `npm run dev`, which runs `validate-env` requiring real Supabase secrets. E2E baseline is therefore whatever `e2e.yml`/`preview-e2e.yml` report in CI (→ Delta D7). Local e2e baseline is a human-gated item (`HUMAN_TASKS.md` when WS5 starts).

## 9. Delta list (doc says X, repo has Y, resolution Z)

| #   | Doc says                                       | Repo has                                                                                 | Resolution                                                                                                                                                              |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | App Router                                     | App Router ✅ but vestigial `pages/_document.tsx`                                        | Delete file in WS4 cleanup; no doc change                                                                                                                               |
| D2  | `lib/mongo.ts`                                 | Scaffold branch: `lib/mongodb.ts` + `lib/db/provider.ts`                                 | Reuse scaffold module; export `getDb()` per doc contract; `docs:` commit amending filename in doc                                                                       |
| D3  | `npm run db:mongo:up\|ping\|indexes` exist     | Absent on `main`; present on scaffold branch                                             | Adopt scaffold scripts in WS2 PR                                                                                                                                        |
| D4  | `NEXT_PUBLIC_APP_URL`                          | `NEXT_PUBLIC_SITE_URL` wired throughout                                                  | Keep `NEXT_PUBLIC_SITE_URL`; amend doc §9.1 (`docs:` commit) — renaming a live var is risk without benefit                                                              |
| D5  | §9.1 lists 14 vars                             | Repo also uses `OPENAI_API_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, Sentry build trio | Amend doc §9.1 to include them (they survive the migration)                                                                                                             |
| D6  | Real `.env.example`                            | One-line stub                                                                            | Rebuild in WS4 env cleanup                                                                                                                                              |
| D7  | Test baseline incl. e2e                        | e2e not runnable without secrets                                                         | CI is the e2e baseline of record; log local-run as human gate at WS5                                                                                                    |
| D8  | _(review note)_ WS3 uploads `access: 'public'` | —                                                                                        | Flagged on PR #239: direct blob URLs of manuscripts are shareable once leaked despite UUID paths + gated download route. Needs a doc decision before WS3 implementation |

---

_Phase 0 complete. Next: WS1 (Auth, PR #1) per briefing §4, pending merge of this report._
