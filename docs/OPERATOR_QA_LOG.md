# Operator QA Log

Automated checks from plan execution. Manual browser steps still required for auth/checkout.

## Automated (agent-run)

| Check | Command / URL | Result |
|-------|---------------|--------|
| Launch readiness | `bash scripts/launch-readiness.sh` | PASS (2026-07-08) — type-check, lint, 25/25 tests, 15 migrations, build |
| Type-check fix | `tsconfig.json` exclude `**/*.test.ts` | Fixed Jest globals in `lib/supabase/queries.test.ts` blocking `tsc` |
| Migration integrity | `bash scripts/verify-migrations.sh` | PASS — 15 files; `20260619124500_*` + `20260619162409_*` overlap is idempotent (`IF NOT EXISTS`) |
| Prod readiness | `curl -skL https://mangu-publishers.com/api/health?ready=1` | HTTP 200 — env, DB, auth, migrations, Stripe all **pass** (2026-07-08) |
| Prod liveness | `curl -skL https://mangu-publishers.com/api/live` | HTTP 200 `{"status":"alive",...}` (2026-07-08) |
| Prod smoke `/` | `curl -sk https://mangu-publishers.com/` | HTTP 200 (2026-07-08) |
| Prod smoke `/books` | `curl -sk https://mangu-publishers.com/books` | HTTP 200 (2026-07-08) |
| npm audit (high) | `npm audit --audit-level=high` | 10 high (mostly `next@14` transitive); no fix without major bump (2026-07-08) |
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
| GCP secrets | `./scripts/sync-gcp-secrets-from-env.sh` | **Blocked in cloud agent:** no `gcloud auth` or `.env.local` (operator has env locally) |
| GCP deploy | `./scripts/gcloud-build-submit.sh` | **Blocked in cloud agent:** same — production already healthy via prior deploy |
| GCP smoke | `./scripts/verify-gcp-production.sh` | Partial via curl: `/api/health?ready=1` green (2026-07-08); full script needs `gcloud auth login` |
| Supabase migrations | `./scripts/apply-supabase-migrations.sh` | **Skipped:** prod health `migrations.status=pass`; overlapping content_type migrations are idempotent |
| verify-rls | `npm run verify-rls` | **Blocked:** requires `.env.local` with `SUPABASE_SERVICE_ROLE_KEY` |
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
