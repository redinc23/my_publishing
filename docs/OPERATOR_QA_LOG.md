# Operator QA Log

Automated checks from plan execution (2026-05-19). Manual browser steps still required for auth/checkout.

## Automated (agent-run)

| Check | Command / URL | Result |
|-------|---------------|--------|
| Type-check | `npm run type-check` | PASS (main, 2026-05-19) |
| Lint | `npm run lint` | PASS |
| Unit tests | `npm test` | PASS 12/12 |
| Production build | `USE_MOCKS=true npm run build` | PASS |
| Local health | `curl localhost:3000/api/health` | PASS (mock mode) |
| GitHub Actions secrets | `gh secret list` | 5 secrets configured |
| PR #73 merge | `gh pr merge 73` | Merged to `main` |

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

## Infrastructure (operator — cloud)

| Item | Script / action | Status |
|------|-----------------|--------|
| GCP secrets | `./scripts/sync-gcp-secrets-from-env.sh` | **Blocked:** run `gcloud auth login` locally, then re-run |
| GCP smoke | `./scripts/verify-gcp-production.sh` | Ran 2026-05-19: 5 secrets MISSING; Cloud Run service not deployed yet |
| Supabase migrations | `./scripts/bundle-migrations.sh` → SQL Editor | **Blocked:** `.env.local` still has placeholder Supabase URL |
| Canonical prod | `docs/CANONICAL_PRODUCTION.md` | **Done** — Cloud Run; issue #70 closed |
| Stripe prod webhook | `https://YOUR_DOMAIN/api/webhook` → Secret Manager | See [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md) |

## Phase 2 intake

| Artifact | Status |
|----------|--------|
| `environment.local.sh` | Created with `PROJECT_ID`; fill domain/slugs/RACI |
| `FIELDS_TO_GATHER.md` | Template — operator to complete |
| `12-ownership-raci.md` | Worksheet placeholders remain until names provided |
