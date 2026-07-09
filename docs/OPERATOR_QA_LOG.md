# Operator QA Log

Automated checks from plan execution. Manual browser steps still required for auth/checkout.

## Phase 3 + PR #136 review + Phase 4 gate (agent-run, 2026-07-09)

**Supabase project:** `mangu-publishers` / `tkzvikozrcynhwsqtkqp`

| Sub-stage | Result |
|-----------|--------|
| `[PASS] 3 / 0.3.c` — public base table count | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'` → **36** (exact match). No migration bundle needed. Did not re-run `verify-rls` (known false positive on orders/reading_progress). |
| `[REVIEW] PR #136` — `fix(ci): resolve deploy, bug-to-issue, and Cloud Build failures` | **Partial accept.** Safe: pin `@actions/core@1.11.1` in `bug-to-issue.yml`; gate optional Vercel deploy on `vars.VERCEL_PROJECT_ID` + `continue-on-error`. **Reject as-is:** `cloudbuild.yaml` silent placeholder/`USE_MOCKS` fallbacks — would bake mock `NEXT_PUBLIC_*` into Docker/Cloud Run if a trigger omits substitutions. Superseded by fail-closed check + `./scripts/gcloud-build-submit.sh` path. |
| `[BLOCKED] 4.1` — GCP auth | Cloud agent has **no** `gcloud` credentials. Phase 4 requires interactive `gcloud auth login` as **`renee@mangu-publishers.com`** (not `books@`) on project `delta-wonder-488420-i3`. |
| `[OBS]` — Current public surface | `www.mangu-publishers.com` responds via **Vercel** (`server: Vercel`). `/api/live` fresh (2026-07-09). `/api/health?ready=1` → `degraded` / Stripe **warn** ("Stripe not configured"). Apex `mangu-publishers.com` TLS SAN mismatch from this environment; redirects to `www`. Canonical target remains **Cloud Run** per `docs/CANONICAL_PRODUCTION.md`. |
| `[HOLD]` — Dependabot #125–#134 | Hold until after launch (preserves validated dependency state). |

**Code landed this run (branch `cursor/phase4-pr136-review-7a40`):**
- Take PR #136 safe CI workflow fixes (`bug-to-issue.yml`, `ci.yml`).
- Harden `cloudbuild.yaml` `next-build` to **fail closed** if `_NEXT_PUBLIC_*` substitutions are empty/placeholder (no silent mocks).
- Grant script: add Upstash secrets to optional accessor list (Phase 4.3 historical failure).
- `e2e.yml`: add CI mock env so Playwright webServer can boot (fixes PR #136 Playwright red).

**Operator next (Phase 4 — Copilot Pro / local machine with `renee@`):**
```bash
gcloud auth login   # must be renee@mangu-publishers.com
gcloud config set project delta-wonder-488420-i3
# ensure .env.local has real secrets (not Phase 2 placeholders)
./scripts/sync-gcp-secrets-from-env.sh
./scripts/grant-cloudrun-secret-access.sh
gcloud secrets list
# verify accessor on upstash-redis-rest-url + upstash-redis-rest-token
./scripts/gcloud-build-submit.sh
./scripts/verify-gcp-production.sh
curl -sS https://www.mangu-publishers.com/api/live
curl -sS "https://www.mangu-publishers.com/api/health?ready=1"
# record KNOWN_GOOD_REVISION from:
gcloud run services describe mangu-publishers --region us-central1 --format='value(status.latestReadyRevisionName)'
```

Do **not** merge PR #136’s `cloudbuild.yaml` placeholder fallbacks. Prefer this branch (or cherry-pick its safe workflow hunks only).

## Phase 2 — Local Validation Gate (agent-run, 2026-07-09)

**Environment:** Node v20.20.2, npm v10.8.2, Next.js 14.2.35, sandbox (GCP Cloud Run target)

| Sub-stage | Result |
|-----------|--------|
| `[PASS] 2.0.a` — Node version | v20.20.2 satisfies `.nvmrc` / `engines >= 20`. |
| `[PASS] 2.0.b` — npm ci clean install from package-lock.json; Node v20.20.2. | No lockfile drift; 1021 packages installed; 17 audit vulns all in `next@14.2.35` chain, deferred (same as previous run). |
| `[PASS] 2.0.c` — Stale `.next` cache removed (`rm -rf .next`). | |
| `[PASS] 2.0.d` — `.env.local` created from `.env.local.example` shape; confirmed git-ignored (`git check-ignore -v .env.local`). Placeholder values: real Supabase project URL, dummy JWT-shaped anon + service-role keys, `pk_test_`/`sk_test_` dummy Stripe keys, `STRIPE_WEBHOOK_SECRET` blank (Phase 5), `NEXT_PUBLIC_SITE_URL=https://mangu-publishers.com`, Upstash dummy URL + token. Real secrets remain operator-local. | |
| `[PASS] 2.0.e` — `npm run validate-env` exited 0 (placeholder-shaped env; real secrets remain operator-local). | One expected warning: "Stripe webhook secret missing" because Stripe keys are present but `STRIPE_WEBHOOK_SECRET` is blank per Phase 5 checklist. No errors; validator correctly marks Stripe webhook as optional/warning-only. |
| `[PASS] 2.1.a` — type-check passed. | `tsc --noEmit` exited 0, zero errors. |
| `[PASS] 2.1.b` — lint passed. | `next lint` — no ESLint warnings or errors. |
| `[PASS] 2.1.c` — unit tests passed (6 suites, 25 tests). | All 25 tests pass across 6 suites. Two expected console.warn lines from `lib/rate-limit.ts` (Redis not set in test env — benign). |
| `[PASS] 2.1.d` — next build succeeded. | 53 pages generated (static + dynamic); `next build` exited 0. Two webpack Edge Runtime warnings for `@supabase/ssr` and `@upstash/redis` (pre-existing, known, not blocking). Secret audit: no `sk_test_`/`sk_live_`/`whsec_` patterns in `.next` output. |
| `[PASS] 2.1.e` — `bash scripts/launch-readiness.sh` passed. | npm ci → type-check → lint → 25/25 unit tests → 15 migration files → build → lockfile @upstash check → secret audit — all PASS. No gcloud gates in this script; no SKIPPED items required. |

**Fixes applied this run:** None required. All sub-stages passed on first attempt.

**Notes:**
- `STRIPE_WEBHOOK_SECRET` left blank intentionally — Phase 5 populates this per checklist.
- `npm audit` 17 vulnerabilities (10 high) in `next@14.2.35` chain — same as 2026-07-08 entry; fix requires Next 16 (breaking), deferred to engineering.
- `verify-rls` not run per task constraints (Phase 3, known false positive flagged in checklist).
- No gcloud/Supabase/Stripe network operations attempted per task constraints (Phases 3–5).

## Automated (agent-run, 2026-07-08)

| Check | Command / URL | Result |
|-------|---------------|--------|
| Launch readiness gate | `bash scripts/launch-readiness.sh` | PASS (npm ci, type-check, lint, 25/25 unit tests, 15 migrations, build, lockfile, secret audit) |
| Type-check | `npm run type-check` | PASS (after adding `@types/jest`; was failing on `lib/supabase/queries.test.ts`) |
| E2E (chromium) | `npx playwright test --project=chromium` | PASS 26/26 runnable, 3 skipped (need real Supabase creds) |
| Prod liveness | `curl https://mangu-publishers.com/api/live` | HTTP 200 |
| Prod readiness | `curl "https://mangu-publishers.com/api/health?ready=1"` | HTTP 200 `healthy` — env, database, auth, migrations, stripe all `pass` |
| Prod RBAC | `curl -I https://mangu-publishers.com/admin/dashboard` | 307 → `/login` (unauthenticated blocked) |
| Prod webhook guard | `POST /api/webhook` without signature | HTTP 400 `Missing signature` (correct rejection) |
| Prod routes | `/`, `/books`, `/comics`, `/papers`, `/login`, `/register` | All HTTP 200 |
| Prod env bake | scan served JS for `localhost:3000` | Clean — `NEXT_PUBLIC_SITE_URL` baked correctly |
| Secret scan | ripgrep for `sk_live_`, `sk_test_`, `whsec_`, JWTs, `re_`, `AIza` | Clean — zero secrets in repo |
| npm audit | `npm audit --audit-level=high` | 17 vulns (10 high) — all in `next@14.2.35` chain; fix requires Next 16 (breaking). Deferred to engineering. |
| GitHub Actions | `gh run list` | **BLOCKED: account locked due to billing issue** — no jobs start. Workflow-file bug (`secrets.*` in job `if:`) fixed on this branch; runs will stay red until billing is resolved. |
| Prod RLS: profiles (anon) | PostgREST query with public anon key | PASS — `[]`, no rows leak |
| Prod RLS: draft books (anon) | PostgREST query with public anon key | PASS — `[]`, drafts hidden |
| Prod RLS: orders (anon) | PostgREST query with public anon key | PASS — `[]`, orders hidden |
| Prod migrations | table probes (missing table returns PGRST205; these return `[]`) | Applied — `profiles`, `books`, `orders` exist; matches `migrations: pass` from `/api/health?ready=1` |
| Prod catalog | published books (anon) | `[]` — catalog empty; seed data pending (matches QA item 7 note) |

### Fixes landed this run (branch `cursor/launch-readiness-fixes-6de2`)

- `secrets.*` removed from job-level `if:` in `ci.yml` / `deploy.yml` (invalidated both workflows — every run failed in 0s)
- `/books`, `/comics`, `/papers` crash fixed: cookie-based Supabase client was used inside `unstable_cache` (`getBooksPage`, `getAuthorSummary`) — now uses admin client with explicit `visibility='public'` filter
- `/admin/books/new` route created (was a linked 404; known issue in error table) with admin-only `createBookAdmin` action
- `updateBookAdmin` role check fixed (`profiles.user_id`, not `profiles.id` — admins were rejected)
- E2E selector bugs fixed (strict-mode violations, `/api/health` startup-probe status)
- `@types/jest` added so `tsc --noEmit` passes

## Automated (agent-run)

| Check | Command / URL | Result |
|-------|---------------|--------|
| Type-check | `npm run type-check` | PASS (2026-05-31) |
| Lint | `npm run lint` | PASS (2026-05-31) |
| Unit tests | `npm test` | PASS 12/12 (2026-05-31) |
| Env validation | `npm run validate-env` | PASS (2026-05-31) |
| Production build | `USE_MOCKS=true npm run build` | PASS (2026-05-19) |
| Local health | `curl localhost:3000/api/health` | PASS (mock mode, 2026-05-19) |
| GitHub Actions secrets | `gh secret list` | 5 secrets configured |
| PR #73 merge | `gh pr merge 73` | Merged to `main` |
| Homepage assets push | commit `ff23d55` | Pushed to `origin/main` (2026-05-31) |
| Prod smoke `/` | `curl https://mangu-publishers.com/` | HTTP 200 (old deploy still live, 2026-05-31) |
| Prod smoke `/api/health` | `curl https://mangu-publishers.com/api/health` | HTTP 200 `{"status":"ok",...}` (2026-05-31) |
| Prod smoke static homepage | `curl https://mangu-publishers.com/homepage/v_a_1.html` | HTTP 404 until Cloud Run redeploy (2026-05-31) |
| Cloud Build deploy | `./scripts/gcloud-build-submit.sh` | **BLOCKED:** `gcloud auth login` required (token refresh failed) |

## Manual (operator — browser)

| # | Test | Pass | Date | Notes |
|---|------|------|------|-------|
| 1 | Register at `/register` | ☐ | | |
| 2 | Profile row in Supabase `profiles` | ☐ | | |
| 3 | Login / logout | ☐ | | |
| 4 | Password reset | ☐ | | |
| 5 | Non-admin blocked from `/admin` | ☐ | | |
| 6 | Admin `/admin/health` | ☐ | | |
| 7 | Browse `/books` | ☐ | | Requires migrations + seed |
| 8 | Stripe test checkout `4242…` | ☐ | | [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md) |
| 9 | Stripe webhook event received | ☐ | | Dashboard → Webhooks |
| 10 | New static homepage loads at `/` | ☐ | | After Cloud Run redeploy with `ff23d55` |

## Infrastructure (operator — cloud)

| Item | Script / action | Status |
|------|-----------------|--------|
| GCP secrets | `./scripts/sync-gcp-secrets-from-env.sh` | **Blocked:** run `gcloud auth login` locally, then re-run |
| GCP deploy | `./scripts/gcloud-build-submit.sh` | **Blocked:** same — auth token refresh failed 2026-05-31 |
| GCP smoke | `./scripts/verify-gcp-production.sh` | Partial: domain live; redeploy needed for new homepage |
| Supabase migrations | `./scripts/bundle-migrations.sh` → SQL Editor | Operator-dependent |
| Canonical prod | `docs/CANONICAL_PRODUCTION.md` | **Done** — Cloud Run; issue #70 closed |
| Stripe prod webhook | `https://mangu-publishers.com/api/webhook` → Secret Manager | See [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md) |

## Phase 2 intake

| Artifact | Status |
|----------|--------|
| `environment.local.sh` | Created with `PROJECT_ID`; fill domain/slugs/RACI |
| `FIELDS_TO_GATHER.md` | Template — operator to complete |
| `12-ownership-raci.md` | Worksheet placeholders remain until names provided |

## Redeploy checklist (operator — run after `gcloud auth login`)

```bash
gcloud auth login
gcloud config set project delta-wonder-488420-i3
./scripts/gcloud-build-submit.sh
./scripts/verify-gcp-production.sh
curl -I https://mangu-publishers.com/
curl -I https://mangu-publishers.com/homepage/v_a_1.html
curl -sS https://mangu-publishers.com/api/health | head -c 500
```

Expected after redeploy: `/` redirects or serves new homepage; `/homepage/v_a_1.html` returns HTTP 200.
