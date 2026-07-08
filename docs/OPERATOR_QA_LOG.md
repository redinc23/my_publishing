# Operator QA Log

Automated checks from plan execution. Manual browser steps still required for auth/checkout.

## Automated (agent-run) — 2026-07-08 runbook execution

| Check | Command / URL | Result |
|-------|---------------|--------|
| Migration integrity (Mission 3.1) | `bash scripts/verify-migrations.sh` | PASS — 15 files present, non-empty (2026-07-08) |
| Overlap check `20260619124500` vs `20260619162409` | manual review | PASS — both idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`); safe to apply in sequence |
| Type-check | `npm run type-check` | PASS after adding `@types/jest` (was failing on `lib/supabase/queries.test.ts` — pre-existing on `main`) |
| Lint | `npm run lint` | PASS — no warnings or errors (2026-07-08) |
| Unit tests | `npm test` | PASS 25/25 in 6 suites (2026-07-08) |
| Production build | `npm run build` (CI placeholder env) | PASS — compiled successfully; shared JS 87.5 kB (2026-07-08) |
| Full gate (Mission 2.1) | `bash scripts/launch-readiness.sh` | PASS — exit 0, incl. lockfile @upstash check + post-build secret audit (2026-07-08) |
| Prod liveness | `GET https://mangu-publishers.com/api/live` | HTTP 200 (2026-07-08) |
| Prod readiness | `GET https://mangu-publishers.com/api/health?ready=1` | HTTP 200 `status:healthy, ready:true` — env, database, auth, migrations, stripe all `pass` (2026-07-08) |
| Migrations applied in prod (Mission 3.2) | `/api/health?ready=1` `checks.migrations` | PASS — required + optional tables present (verified via readiness probe; `supabase db push` not needed) |
| RLS anon probes (Mission 3.4) | PostgREST with public anon key | PASS — `profiles`, `orders`, `manuscripts`, draft `books` all return 0 rows to anon (2026-07-08) |
| Storage buckets (Mission 3.3) | Storage public-object endpoint | `book-covers` + `published-epubs` exist and are Public; `manuscripts` not publicly accessible (private or requires service-role check) |
| RBAC smoke (`/admin`, `/admin/dashboard`, `/library`) | `curl -w %{redirect_url}` | PASS — HTTP 307 → `/login` for unauthenticated (2026-07-08) |
| Repo secret scan (Phase 12) | ripgrep for `sk_live_`/`sk_test_`/`whsec_`/`re_`/AWS keys/private keys/JWTs | PASS — zero matches in tracked files (2026-07-08) |
| Dependency audit (Phase 9) | `npm audit --audit-level=high` | 17 vulns (10 high). All high are in `next@14.2.35` (DoS/cache-poisoning/SSRF advisories → fix is next 16 major) and dev-only ESLint/glob/minimatch chain. No critical. |
| GitHub Actions | `gh run list` | **BLOCKED** — all jobs fail with "account is locked due to a billing issue"; resolve GitHub billing before CI can go green |
| Workflow `if:` secret gates (Phase 8) | `.github/workflows/{ci,deploy}.yml` | FIXED — `secrets.*` in job-level `if:` replaced with `vars.VERCEL_DEPLOY_ENABLED` / `vars.GCP_DEPLOY_ENABLED` gates |
| Playwright e2e (Phase 7) | `npx playwright test --project=chromium` (mock env) | PASS — 23 passed, 6 skipped (backend-dependent tests correctly skip without a real Supabase). Fixed strict-mode selector bugs and stale health-probe expectations in the specs. |
| `/books` `/comics` `/papers` listing crash | streamed prod HTML + local repro | **BUG FOUND & FIXED** — `getBooksPage` used the cookie-based Supabase client inside `unstable_cache`, which Next.js forbids; the book list crashed to the error boundary (prod HTML streams error digest `3048245647`). Switched to the admin client (same pattern as `getFeaturedBooks`). Needs redeploy to take effect. |

### Known apex-domain TLS anomaly (found 2026-07-08)

`mangu-publishers.com` A records include both Google Cloud Run IPs (`216.239.32.21` etc.) **and** a Vercel IP (`76.76.21.21`). The Vercel IP serves a cert valid only for `www.mangu-publishers.com`, so roughly 1-in-5 HTTPS connections to the apex fail TLS verification. Fix in DNS: remove the `76.76.21.21` A record from the apex (keep apex → Cloud Run only), or move the apex fully to one host.

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
