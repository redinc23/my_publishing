# Operator QA Log

Automated checks from plan execution. Manual browser steps still required for auth/checkout.

## Phase 1 — Authority, baseline refresh, traceability (agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 1 (Steps 1.1–1.5). Executed via GitHub API by the agent; no local/gcloud/supabase/stripe access — external-system facts below are DOC-ONLY/REPORTED as classified.

| UTC | Actor | Env | SHA / deploy ID | Test-Gate | Action | Expected | Actual | Result | Artifact / follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-18 | agent (GitHub API) | repo | `3d9ea3c77e2829125a950b10a9d2a658d212d58a` (origin/main, commit 2026-07-17T14:52:30Z) | Step 1.2 / G12 | Refresh volatile baseline | Baseline matches or supersedes source snapshot 2026-07-17 | main SHA matches source snapshot exactly; 19 open PRs; 96 branches (25 `cursor/ci-autofix-automation-*`, 9 with open PRs); 0 tags; 0 releases; 19 workflows; 25 local migration files (tip `20260717114300_order_items_select_own.sql`); `docs/NEXT_GO.md` absent; `docs/adr/` absent; `scripts/verify-gcp-production.sh` + `scripts/grant-cloudrun-secret-access.sh` MISSING | PASS (baseline refreshed) | `docs/NEXT_GO.md` §3; issue #202 (P0-020) |
| 2026-07-18 | agent | repo | branch `release/next-go-authority` | Step 1.1 / P0-019 / G13 | Commit authority document `docs/NEXT_GO.md` + ADR-001 PROPOSED | Authority establishes NO-GO, decision rule, evidence model, gate matrix | Committed via authority PR to protected main | IN PROGRESS until PR merges | authority PR; issues #196 (P0-019), #190 (P0-003) |
| 2026-07-18 | agent | repo | — | Step 1.4 / traceability | Create issue-backed P0 map (20 items) | Every P0 has owner, dependencies, acceptance criteria, evidence location, rollback notes | 20 issues created: #186 (P0-007), #187 (P0-001), #188 (P0-006), #189 (P0-002), #190 (P0-003), #191 (P0-009), #192 (P0-004), #193 (P0-008), #194 (P0-005), #195 (P0-011), #196 (P0-019), #197 (P0-012), #198 (P0-018), #199 (P0-015), #200 (P0-017), #201 (P0-013), #202 (P0-020), #203 (P0-016), #204 (P0-014), #205 (P0-010) | PASS | issues #186–#205; `docs/NEXT_GO.md` §5 |
| 2026-07-18 | agent | repo | — | Step 1.5 | Lock operating rules + launch scope | Rules in authority doc; README/QUICK_START link authority; false production-ready claims corrected | `docs/NEXT_GO.md` §7–§8 locked; QUICK_START "PRODUCTION READY" banner replaced with authority link (CCR-018); README deployment section links authority | IN PROGRESS until PR merges | authority PR |
| 2026-07-18 | agent | external | — | CCR-017 | Classify external claims | GCP/Supabase/Stripe/DNS/Sentry claims marked DOC-ONLY pending in-system verification | GCP project `delta-wonder-488420-i3`/region `us-central1`/service `mangu-publishers`: DOC-ONLY; hosted migration count 22: DOC-ONLY (25 local VERIFIED); Stripe webhook/Secret Manager: DOC-ONLY; www served by Vercel + apex TLS mismatch: REPORTED 2026-07-09 (stale, re-verify Phase 6/15); Actions billing lock: REPORTED 2026-07-08 (re-verify on next run) | DOCUMENTED | `docs/NEXT_GO.md` §3.3 |

**Notes:** 2026-07-17 unit/type-check results below remain REPORTED against an uncommitted working tree (base `326bb60`) — not release evidence; Phase 4 reruns on the exact candidate SHA (CCR-005). Manual QA rows 1–10 below remain blank ⇒ G10 FALSE. This file is append-only: prior rows preserved; superseded facts are marked, never deleted (CCR-002).

## Full-site validation and hardening wave (agent-run, 2026-07-17)

**Scope:** full test suite, full route/API surface, `docs/reports/OPERATOR_AUDIT_20260708.json` findings 1Î“Ã‡Ã´8, and release-document sync.

| UTC | Env | Test-Gate | Action | Expected | Actual | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-17T14:20Z | local (Node 24.4.1, npm 11.4.2) | G2-prep | `npm run type-check` on working tree (baseline `326bb60` + today's uncommitted hardening edits) | 0 errors | 0 errors | PASS (uncommitted tree Î“Ã‡Ã¶ commit before release evidence) | terminal |
| 2026-07-17T14:25Z | local | G2-prep | `npx jest --runInBand` same tree | all suites pass | 63/63 tests pass (10 suites, ~9.6s) | PASS (same caveat) | terminal |
| 2026-07-17T13:10Z | local | audit | `rg` env/example/scan of untracked files for secrets; `.env.production` template | no private values in git | template documents names only; secrets stay out of git | PASS | `.env.production` |
| 2026-07-17T13:40Z | local | audit | curl route/content smoke vs audit expectations (`/api/mcp/[transport]`, stats CTA, formats) | claims match code | `/api/mcp/[transport]` exists (no rate limit Î“Ã‡Ã¶ Phase 5B); homepage Stats + `/books?format=` exist; sitemap/robots wired | PASS | `docs/reports/ROUTE_CONTENT_AUDIT_20260717.md` |

**Docs sync this wave:** `docs/MANGOU_MASTER_TODO.md` Î“Ã‡Ã´ next-session agent brief: status matrix, completed-work ledger, explicit remaining launch steps (env Î“Ã‡Ã’ Supabase Î“Ã‡Ã’ build Î“Ã‡Ã’ deploy Î“Ã‡Ã’ smoke Î“Ã‡Ã’ manual QA), per-phase agent handoff prompts, and IA index. `docs/NEXT_STEPS.md` remains the ranked checklist and now links the audit + next-agent brief.

**Notes for tomorrow's agent:** baseline tree = `326bb60`; today's route/content fixes were applied in the working tree (uncommitted at log time). Analytics growth-rate `NaN%` when `prev=0` was fixed in `lib/analytics/growth-rate.ts` (null-on-zero + sentinel tests). Dev-edit loop `components/library/book-download-button.tsx` restored from git after an out-of-scope local edit.

## Auth/cookie rate limiting + launch-prep (agent-run, 2026-07-11)

**Scope:** `lib/rate-limit.ts` (unified limiter: fail-closed, proxy-aware IP, Upstash or in-memory), `app/api/session/route.ts` (cookie-based register/login/logout with server-side email confirm via admin API when configured), `app/api/password/route.ts` (forgot/reset with rate limits), `app/auth/confirm/page.tsx` (post-confirm setPassword type UX), cookie-aware register/login/logout flows, `SUPABASE_SERVICE_ROLE_KEY` server-only enforcement, `middleware.ts` session gating, `docs/MANGOU_MASTER_TODO.md` (single launch checklist), `docs/NEXT_STEPS.md` (master checklist + CI link), `README.md` (rate-limit + middleware doc sync), `jest.config.js`/`tests` updates, `.env*` template sync (`SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_*`, `RESEND_API_KEY`, `SENTRY_*`).

| UTC | Env | Test-Gate | Action | Expected | Actual | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-11T16:55Z | local (Node 24.4.1, npm 11.4.2) | G2-prep | `npm run type-check` on working tree (baseline `a4051ab` + uncommitted edits) | 0 errors | 0 errors | PASS (uncommitted tree Î“Ã‡Ã¶ commit before release evidence) | terminal |
| 2026-07-11T16:55Z | local | G2-prep | `npx jest --runInBand` same tree (incl. new `tests/api/session.test.ts`, `tests/api/password.test.ts`) | all suites pass | 63/63 tests pass (10 suites, ~8.6s) | PASS (same caveat) | terminal |
| 2026-07-11T17:00Z | local | docs | master checklist rewritten as `docs/MANGOU_MASTER_TODO.md`; `docs/NEXT_STEPS.md` synced (8 unchecked phases, CI fix link) | single source of truth | both files updated and cross-linked | PASS | this commit |

**Notes:** `SUPABASE_SERVICE_ROLE_KEY` (optional) enables server-side email confirm for password-register and admin ops; when unset, register returns `email_verification_required` honestly. In-memory rate limiting is per-instance; set `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` for multi-instance. `RESEND_API_KEY` remains optional Î“Ã‡Ã¶ newsletter subscribe returns honest unavailable state. `SENTRY_DSN`/`SENTRY_AUTH_TOKEN` set up for #127 (separate follow-up). PR #130 (`fix/distributed-rate-limiting`) closed as superseded by this unified limiter work.

## Post-PR#128 remaining-work execution (agent-run, 2026-07-09)

**Scope:** execute next items after PR #128 merge Î“Ã‡Ã¶ launch hardening (rate limiting, security headers, newsletter, CI E2E, GCP scripts).

| UTC | Env | Test-Gate | Action | Expected | Actual | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-09T10:20Z | live | site | `curl -sI https://www.mangu-publishers.com/` | 200/3xx, canonical host | 200, `server: Vercel` | PASS (note: Vercel still serving; Cloud Run canonical target pending DNS swap per `docs/CANONICAL_PRODUCTION.md`) | terminal |
| 2026-07-09T10:20Z | live | site | `curl -sI https://mangu-publishers.com/` | 200/3xx | 308 Î“Ã‡Ã’ `https://www.mangu-publishers.com/`; `server: Vercel` | PASS (redirect works; TLS cert CN mismatch on apex noted 2026-07-08 persists until DNS/cert fix) | terminal |
| 2026-07-09T10:21Z | live | site | `curl -s https://www.mangu-publishers.com/api/health?ready=1` | `ready:true` when configured | `{"status":"degraded","ready":false,...,"stripe":{"status":"warn","error":"Not configured"}}` | WARN Î“Ã‡Ã¶ Stripe not configured on live Vercel env; `supabase: ok`, `env: ok` | terminal |
| 2026-07-09T10:25Z | live | G4/G8 | `curl -s -X POST https://www.mangu-publishers.com/api/webhook` (unsigned) | 400 missing signature | `{"error":"Missing Stripe signature"}` 400 | PASS (signature gate enforced) | terminal |
| 2026-07-09T11:30Z | local (Node 24.4.1, npm 11.4.2) | G2-prep | `npm run type-check` on working tree (baseline `4b97c76` + today's uncommitted edits) | 0 errors | 0 errors | PASS (uncommitted tree Î“Ã‡Ã¶ commit before release evidence) | terminal |
| 2026-07-09T11:35Z | local | G2-prep | `npx jest --runInBand` same tree (incl. new `tests/api/subscribe.test.ts`) | all suites pass | 57/57 tests pass (9 suites, ~9.1s) | PASS (same caveat) | terminal |
| 2026-07-09T12:10Z | repo | docs | write `docs/LAUNCH_HARDENING.md` (audit) + `docs/NEXT_STEPS.md` (checklist); link from `docs/MASTER_PRODUCTION_PLAN.md` | launch-prep docs exist | both docs written; master plan P0 table links added | PASS | this commit |
| 2026-07-09T12:45Z | repo | scripts | create `scripts/gcloud-build-submit.sh`, `scripts/gcp-config.sh`, `scripts/sync-gcp-secrets-from-env.sh`; sync `cloudbuild.yaml` substitutions | canonical GCP path scripted | scripts created, executable, referenced in CI/CD docs | PASS | this commit |
| 2026-07-09T13:00Z | repo | app | wire `/api/subscribe` Î“Ã‡Ã’ `NewsletterCTA`; add `lib/rate-limit.ts`; add `lib/security-headers.ts`; document `UPSTASH_*`/`RESEND_API_KEY` in `.env.example` | newsletter + rate limit + headers land | all implemented; rate limit fail-closed without Upstash; headers applied via `next.config.mjs` | PASS | this commit |

**Remaining after this wave (see `docs/NEXT_STEPS.md`):** CI E2E BASE_URL alignment + PR #129 revert decision; apply 4 pending Supabase migrations + `grant-cloudrun-secret-access.sh`; GCP promote secrets Î“Ã‡Ã’ `gcloud-build-submit.sh` Î“Ã‡Ã’ verify; DNS swap to Cloud Run (canonical) + TLS fix; Stripe production webhook + live purchase/refund QA; manual QA rows 1Î“Ã‡Ã´10; Lighthouse on production URL.

## Fix/production-audit-findings-1-8 + Next.js 14.2.35 pin (agent-run, 2026-07-08)

**Scope:** `docs/reports/OPERATOR_AUDIT_20260708.json` (audited app @ `d953f2a`) findings 1Î“Ã‡Ã´8 remediation on branch `fix/production-audit-findings-1-8`; Next.js pinned `14.2.35` per `docs/reports/CLEAN_BUILD_REPORT.md` guidance (Node Î“Ã´Â¥22 + Supabase ESM constraints).

| UTC | Env | Test-Gate | Action | Expected | Actual | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-08T09:50Z | live | site | `curl -s https://www.mangu-publishers.com/api/health?ready=1` | 200 + ready:true when configured | `{"status":"degraded","ready":false,...,"stripe":{"status":"warn","error":"Not configured"}}` | WARN (Stripe env absent on Vercel deployment; supabase ok, env ok) | terminal |
| 2026-07-08T09:51Z | live | site | `curl -s https://www.mangu-publishers.com/api/books?status=published` | published list or [] | `{"books":[],"pagination":{"total":0,...}}` | PASS (catalog empty Î“Ã‡Ã¶ seed content remains a launch task) | terminal |
| 2026-07-08T09:51Z | live | site | `curl -sI https://mangu-publishers.com/` (apex) | 200/3xx | 308 to www but TLS cert CN=*.vercel.app mismatch on apex | WARN Î“Ã‡Ã¶ apex cert/SAN fix pending (canonical Cloud Run cutover per `docs/CANONICAL_PRODUCTION.md`) | terminal |
| 2026-07-08T09:55Z | live | G4/G8 | `curl -s -X POST https://www.mangu-publishers.com/api/webhook` (unsigned) | 400 missing signature | `{"error":"Missing Stripe signature"}` 400 | PASS | terminal |
| 2026-07-08T11:00Z | local (Node 24.4.1, npm 11.4.2) | G2-prep | `npm run type-check` on branch (incl. `next.config.mjs` TypeScript (`app/` excluded per Next 14 rules), `lib/supabase/*` ESM fixes) | 0 errors | 0 errors | PASS | terminal |
| 2026-07-08T11:05Z | local | G2-prep | `npx jest --runInBand` on branch | all suites pass | 52/52 tests pass (8 suites, ~8.3s) | PASS | terminal |
| 2026-07-08T11:30Z | local | build | `npm run build` (Next 14.2.35, Node 24.4.1) | production build succeeds | compiled successfully; 24 routes; middleware 69.4 kB; warnings only (Sentry/OpenTelemetry, Edge runtime) | PASS | `.next/` (local artifact) |
| 2026-07-08T12:20Z | repo | audit | finding fixes: ESLint 9 flat-config compat, `verify-rls` script, `auth/confirm` page, security headers, rate-limit module, webhook idempotency doc, `docs/CANONICAL_PRODUCTION.md`, `docs/MIGRATIONS.md` sync | findings 1Î“Ã‡Ã´8 addressed | all patched; see `docs/reports/OPERATOR_AUDIT_20260708.json` status updates | PASS | this branch |

**Follow-ups (queued in `docs/MASTER_PRODUCTION_PLAN.md` P0/P1):** apply pending Supabase migrations (4 pending per `docs/MIGRATIONS.md`); promote secrets Î“Ã‡Ã’ GCP Secret Manager Î“Ã‡Ã’ Cloud Run build/deploy; DNS/TLS apex fix + canonical cutover; Stripe production keys + webhook endpoint; Lighthouse CI on production URL.

## Full-site validation + CLEAN_BUILD_REPORT remediation (agent-run, 2026-07-08)

**Scope:** execute against `docs/reports/CLEAN_BUILD_REPORT.md` (2026-07-08): Node Î“Ã´Â¥22 contract, Next.js pin, Supabase ESM/SSM import fixes, canonical deployment-path docs.

| UTC | Env | Test-Gate | Action | Expected | Actual | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-08T09:12Z | local | env | `node -v` / `npm -v` | Î“Ã´Â¥22 / Î“Ã´Â¥10 | v24.4.1 / 11.4.2 | PASS | terminal |
| 2026-07-08T09:15Z | local | deps | `npm install` with `@supabase/auth-js` constraint check | clean install | installed; warned Node Î“Ã´Â¥20.18.0 required by `@supabase/auth-js` Î“Ã‡Ã¶ satisfied by 24.4.1 | PASS | terminal |
| 2026-07-08T09:40Z | repo | imports | fix `@supabase/auth-helpers-nextjs` ESM imports across `lib/supabase/*` (server/client/middleware) | no CJS/ESM interop failures | imports normalized to `@supabase/ssr` per report | PASS | commit |
| 2026-07-08T10:05Z | repo | next | pin `next` to `14.2.35`; keep `eslint-config-next` in sync | reproducible build | pinned in `package.json`; lockfile updated | PASS | commit |
| 2026-07-08T10:30Z | local | build | `npm run build` | succeeds under pinned versions | success (see 2026-07-08T11:30Z entry above for full log) | PASS | `.next/` |
| 2026-07-08T10:45Z | repo | docs | write `docs/CANONICAL_PRODUCTION.md`; sync `docs/DEPLOYMENT.md`, `docs/CI_CD.md` | single canonical deploy path declared | Cloud Run via `cloudbuild.yaml` declared canonical; Vercel/Amplify marked compatibility-only | PASS | commit |

**Notes:** CLEAN_BUILD_REPORT verdict was NO-GO pending Node/Next/Supabase alignment; this wave clears the toolchain blockers. Remaining P0s: pending migrations, secrets promotion, DNS/TLS, Stripe prod wiring.

## OPERATOR_AUDIT_20260708 remediation wave 1 (agent-run, 2026-07-08)

| UTC | Env | Test-Gate | Action | Expected | Actual | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-08T08:20Z | repo | audit | parse `docs/reports/OPERATOR_AUDIT_20260708.json` (app @ `d953f2a`) | findings actionable | 8 findings (ESLint 9, RLS verify script, auth confirm page, headers, rate limit, webhook idempotency, canonical deploy doc, migrations doc) | PASS | report |
| 2026-07-08T08:35Z | repo | lint | `eslint.config.mjs` flat-config compat for ESLint 9 | `npm run lint` runs | flat config updated; `eslint-config-next` resolver shim added | PASS | commit |
| 2026-07-08T08:50Z | repo | rls | `scripts/verify-rls.ts` + `npm run verify-rls` | RLS verification script exists | script added (requires `SUPABASE_SERVICE_ROLE_KEY`; fails closed) | PASS | commit |
| 2026-07-08T09:00Z | repo | auth | add `app/auth/confirm/page.tsx` | email confirm landing exists | page added (setPassword flow aware) | PASS | commit |
| 2026-07-08T09:10Z | repo | security | `lib/security-headers.ts` + `next.config.mjs` headers | headers applied | CSP/HSTS/frame/referrer headers wired | PASS | commit |

## Next-session agent brief sync (agent-run, 2026-07-17)

| UTC | Env | Test-Gate | Action | Expected | Actual | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-17T15:00Z | repo | docs | update `docs/MANGOU_MASTER_TODO.md` + `docs/NEXT_STEPS.md` with current ledger and next-agent handoff | brief reflects reality | synced to baseline `326bb60` + today's uncommitted hardening edits | PASS | this commit |

## CI outage and recovery ledger (operator-run, 2026-07-08)

**2026-07-08 ~09:00Z:** GitHub Actions unavailable Î“Ã‡Ã´ "The account is locked due to a billing issue." All workflow runs blocked. Local verification used as interim evidence (type-check, Jest, build). Re-check Actions availability before Phase 3 recovery merge; CI-green-on-exact-SHA (G2) still required.

## Pre-launch verification script run (operator-run, 2026-06-30)

| UTC | Env | Test-Gate | Action | Expected | Actual | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-30T14:00Z | local | pre-launch | `./scripts/pre-launch-verify.sh` | all checks pass | env validation, type-check, lint, unit tests, build pass; E2E skipped (no BASE_URL) | PASS (E2E pending) | terminal |

## Initial production smoke (operator-run, 2026-06-27)

| UTC | Env | Test-Gate | Action | Expected | Actual | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-27T10:00Z | live | smoke | homepage, /books, /api/health | 200s | all 200; health ok | PASS | terminal |
| 2026-06-27T10:05Z | live | smoke | `/api/health?ready=1` | ready:true | degraded (Stripe warn) | WARN | terminal |

## Historical QA (2026-05-31 Î“Ã‡Ã’ 2026-06-26)

| UTC | Env | Test-Gate | Action | Expected | Actual | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-20T12:00Z | local | unit | `npx jest` | pass | 48/48 pass | PASS | terminal |
| 2026-06-15T09:00Z | local | build | `npm run build` | pass | success | PASS | terminal |
| 2026-06-10T11:00Z | staging | auth | register/login smoke | works | works | PASS | Î“Ã‡Ã¶ |
| 2026-05-31T10:00Z | local | setup | initial scaffold | runs | runs | PASS | Î“Ã‡Ã¶ |

## Manual QA (launch-critical) Î“Ã‡Ã´ required for G10

| # | Scenario | Tester | UTC | SHA | Deploy/Revision | Result | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Register new account (real email) | ____ | ____ | ____ | ____ | ____ | ____ |
| 2 | Profile row created in Supabase | ____ | ____ | ____ | ____ | ____ | ____ |
| 3 | Login / logout | ____ | ____ | ____ | ____ | ____ | ____ |
| 4 | Password reset email flow | ____ | ____ | ____ | ____ | ____ | ____ |
| 5 | Non-admin blocked from /admin | ____ | ____ | ____ | ____ | ____ | ____ |
| 6 | Admin sees /admin/health | ____ | ____ | ____ | ____ | ____ | ____ |
| 7 | Browse /books catalog | ____ | ____ | ____ | ____ | ____ | ____ |
| 8 | Stripe test purchase (4242) | ____ | ____ | ____ | ____ | ____ | ____ |
| 9 | Webhook received (Stripe dashboard) | ____ | ____ | ____ | ____ | ____ | ____ |
| 10 | Homepage loads, no console errors | ____ | ____ | ____ | ____ | ____ | ____ |
