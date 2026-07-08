# Operator QA Log

Automated checks from plan execution. Manual browser steps still required for auth/checkout.

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
