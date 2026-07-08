# Operator QA Log

Automated checks from plan execution. Manual browser steps still required for auth/checkout.

## Automated (agent-run)

### 2026-07-08 run (launch plan Phases 2–3, 7–9)

| Check | Command / URL | Result |
|-------|---------------|--------|
| Full local gate | `bash scripts/launch-readiness.sh` | PASS (npm ci, type-check, lint, 25 unit tests, migrations, build, lockfile, secret audit) |
| Type-check | `npm run type-check` | PASS — after adding `@types/jest` (was failing on `lib/supabase/queries.test.ts`) |
| Migration integrity | `bash scripts/verify-migrations.sh` | PASS — 15 files, none empty. Overlapping `20260619124500` / `20260619162409` both fully idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) — safe to apply in sequence |
| E2E (chromium, mock mode) | `npx playwright test --project=chromium` | PASS 26/26 (+3 correctly skipped as backend-dependent) — after fixing `/books` `/comics` `/papers` crash (`cookies()` inside `unstable_cache`) and Playwright strict-mode selectors |
| Prod liveness | `curl https://mangu-publishers.com/api/live` | HTTP 200 (3/3 attempts) |
| Prod readiness | `curl https://mangu-publishers.com/api/health?ready=1` | HTTP 200 `{"status":"healthy","ready":true}` — env, database, auth, migrations, Stripe all `pass` |
| Prod listing pages | `curl https://mangu-publishers.com/{books,comics,papers,login}` | HTTP 200 each; `/books` renders "Browse Books" (no error boundary) |
| Dependency audit | `npm audit --audit-level=high` | Exit 0 at high gate; 17 advisories total (10 high) — all fixes require breaking major upgrades (`next@16`, `@react-email/components@1`); tracked, not blocking |
| CI `if:` gates | `.github/workflows/{ci,deploy}.yml` | FIXED — `secrets.*` in job-level `if:` silently skips jobs; now gated on `vars.GCP_PROJECT_ID` / `vars.VERCEL_PROJECT_ID` (operator: define these repo **variables**) |

### 2026-05-31 run

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
