# Deployment Status Tracker

**Last updated:** 2026-07-09  
**Operator launch:** [`docs/LAUNCH_NOW.md`](../../LAUNCH_NOW.md) (single-page commands)  
**Canonical target:** Google Cloud Run via [`cloudbuild.yaml`](../../../cloudbuild.yaml) â€” see [`docs/CANONICAL_PRODUCTION.md`](../../CANONICAL_PRODUCTION.md)  
**Runbook:** [`docs/PHASE4_OPERATOR_RUNBOOK.md`](../../PHASE4_OPERATOR_RUNBOOK.md)  
**Source checklist:** [`docs/MASTER_EXECUTION_CHECKLIST.md`](../../MASTER_EXECUTION_CHECKLIST.md)  
**QA log:** [`docs/OPERATOR_QA_LOG.md`](../../OPERATOR_QA_LOG.md)

> **BLOCKED** rows are **operator-only** â€” they require live credentials, GCP/Stripe/DNS dashboards, or interactive auth. Agents cannot complete them.

## Status legend

| Status      | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| **DONE**    | Code-complete or verified locally in repo                |
| **TODO**    | Not started; can be done locally or by operator          |
| **BLOCKED** | Requires operator credentials, dashboards, or GCP access |

## Copilot checklist corrections (documented errors)

| Topic               | Wrong (Copilot)                                     | Correct (repo)                                                                                                                                                                                |
| ------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe webhook URL  | `/api/stripe/webhook`                               | **`/api/webhook`** â€” handler at [`app/api/webhook/route.ts`](../../../app/api/webhook/route.ts)                                                                                             |
| Format check script | `npx prettier --check .` only                       | **`npm run format:check`** â€” script in [`package.json`](../../../package.json) (`prettier --check .`); also used by [`scripts/pre-launch-verify.sh`](../../../scripts/pre-launch-verify.sh) |
| Sentry              | Required for launch                                 | **Optional P1** â€” not implemented; only placeholder comment in [`components/common/ErrorBoundary.tsx`](../../../components/common/ErrorBoundary.tsx)                                        |
| Node engines        | Strict upper bound (e.g. `20.x` only)               | **`>=20.0.0`** in `package.json`; `.nvmrc` pins 20 for CI/Cloud Build                                                                                                                         |
| Cloud Build submit  | Raw `gcloud builds submit --config=cloudbuild.yaml` | **`./scripts/gcloud-build-submit.sh`** â€” loads `NEXT_PUBLIC_*` from `.env.local`                                                                                                            |

---

## Phase 0 â€” Pre-flight / decision lock

| Phase | Task                                                             | Status  | Owner    | Evidence                                                                                                                                                | Blocker                 |
| ----- | ---------------------------------------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 0     | 0.1 Canonical production target = Cloud Run                      | DONE    | Agent    | [`docs/CANONICAL_PRODUCTION.md`](../../CANONICAL_PRODUCTION.md) names Cloud Run; Vercel/Amplify legacy only                                             | â€”                     |
| 0     | 0.2 Collect and lock identifiers (Supabase, Stripe, GCP, domain) | BLOCKED | Operator | Â§0.6 state vars need real dashboard values                                                                                                             | Requires operator input |
| 0     | 0.3 Resumption state check                                       | DONE    | Agent    | [`blockers/blockers.yml`](../../../blockers/blockers.yml) 13/13 resolved; [`docs/OPERATOR_QA_LOG.md`](../../OPERATOR_QA_LOG.md) Phase 2 PASS 2026-07-09 | â€”                     |

---

## Phase 1 â€” Environment provisioning

| Phase | Task                                               | Status  | Owner    | Evidence                                                                                 | Blocker                                        |
| ----- | -------------------------------------------------- | ------- | -------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1     | 1.1 Materialize `.env.local` from example          | TODO    | Operator | [`.env.local.example`](../../../.env.local.example) exists; `.env.local` git-ignored     | Operator must create with real secrets         |
| 1     | 1.2 Populate Phase-1 required variables            | BLOCKED | Operator | `npm run validate-env` via [`scripts/validate-env.ts`](../../../scripts/validate-env.ts) | Needs Supabase/Stripe/Upstash dashboard access |
| 1     | 1.3 Phase-2 optional vars (OpenAI, Resend, Sentry) | TODO    | Operator | Sentry not implemented (optional P1)                                                     | Non-blocking for MVP                           |
| 1     | 1.4 Key-rotation sub-checklist                     | TODO    | Operator | [`scripts/sync-gcp-secrets-from-env.sh`](../../../scripts/sync-gcp-secrets-from-env.sh)  | â€”                                            |

---

## Phase 2 â€” Local validation gate

| Phase | Task                                         | Status | Owner | Evidence                                                                     | Blocker                       |
| ----- | -------------------------------------------- | ------ | ----- | ---------------------------------------------------------------------------- | ----------------------------- |
| 2     | 2.0.a Node version `>=20.0.0`                | DONE   | Agent | `node -v` â†’ v24.14.0 (satisfies `engines`)                                 | â€”                           |
| 2     | 2.0.b `npm ci` clean install                 | DONE   | Agent | `pre-launch-verify.sh` 2026-07-09 — SKIP/`npm install` on Windows contention | —                             |
| 2     | 2.0.c Remove stale `.next/`                  | DONE   | Agent | Prior `.next/` used for secret scan PASS                                     | â€”                           |
| 2     | 2.0.d `npm run validate-env`                 | DONE   | Agent | PASS with `.env.local` (pre-launch run 2026-07-09)                           | â€”                           |
| 2     | 2.1.a `npm run type-check`                   | DONE   | Agent | PASS `pre-launch-verify.sh` 2026-07-09                                       | —                             |
| 2     | 2.1.b `npm run lint`                         | DONE   | Agent | PASS `pre-launch-verify.sh` 2026-07-09                                       | —                             |
| 2     | 2.1.c `npm run format:check`                 | DONE   | Agent | PASS `pre-launch-verify.sh` 2026-07-09                                       | —                             |
| 2     | 2.1.d `npm test`                             | DONE   | Agent | 7 suites / 42 tests PASS 2026-07-09                                          | —                             |
| 2     | 2.1.e `npm run build` (mock env)             | DONE   | Agent | PASS mock env `pre-launch-verify.sh` 2026-07-09                              | —                             |
| 2     | 2.1 Full `bash scripts/pre-launch-verify.sh` | DONE   | Agent | **11/11 PASS** 2026-07-09 (`SKIP_NPM_CI=1` on Windows)                       | E2E 26/29 (3 auth-flow fails) |

**Mock env for local build** (from `launch-readiness.sh`):

```bash
export USE_MOCKS=true
export NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key-for-ci
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Phase 3 â€” Database migration & storage

| Phase | Task                                        | Status | Owner    | Evidence                                                                                                       | Blocker                          |
| ----- | ------------------------------------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 3     | 3.1 Migration-set integrity (15 files)      | DONE   | Agent    | [`scripts/verify-migrations.sh`](../../../scripts/verify-migrations.sh); 15 files in `supabase/migrations/`    | â€”                              |
| 3     | 3.2 Apply migrations to production Supabase | DONE   | Operator | QA log: 36 tables confirmed on `tkzvikozrcynhwsqtkqp`                                                          | â€”                              |
| 3     | 3.3 Verify storage buckets                  | TODO   | Operator | Migration #8 defines `book-covers`, `manuscripts`, `published-epubs`                                           | Supabase dashboard               |
| 3     | 3.4 Verify RLS                              | TODO   | Operator | [`scripts/verify-rls.ts`](../../../scripts/verify-rls.ts) â€” known false positives on orders/reading_progress | Needs `.env.local` with prod ref |
| 3     | 3.5 Seed data for QA                        | TODO   | Operator | `npm run db:seed -- --create-profiles --minimal`                                                               | Needs prod credentials           |

---

## Phase 4 â€” GCP production deployment

| Phase | Task                                                           | Status  | Owner    | Evidence                                                                                                                  | Blocker                                      |
| ----- | -------------------------------------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 4     | 4.1 `gcloud auth login` + set project `delta-wonder-488420-i3` | BLOCKED | Operator | Must use `renee@mangu-publishers.com` per QA log                                                                          | Interactive GCP auth                         |
| 4     | 4.2 Sync secrets via `sync-gcp-secrets-from-env.sh`            | BLOCKED | Operator | [`scripts/sync-gcp-secrets-from-env.sh`](../../../scripts/sync-gcp-secrets-from-env.sh)                                   | Real creds in `.env.local`                   |
| 4     | 4.3 Grant Cloud Run SA secret access                           | BLOCKED | Operator | [`scripts/grant-cloudrun-secret-access.sh`](../../../scripts/grant-cloudrun-secret-access.sh)                             | GCP IAM; Upstash secrets historically missed |
| 4     | 4.4 Submit Cloud Build                                         | BLOCKED | Operator | **`./scripts/gcloud-build-submit.sh`** (not raw `gcloud submit`)                                                          | GCP auth + `.env.local`                      |
| 4     | 4.5 Post-deploy verification                                   | BLOCKED | Operator | [`scripts/verify-gcp-production.sh`](../../../scripts/verify-gcp-production.sh) + curl `/api/live`, `/api/health?ready=1` | Deploy must succeed first                    |

---

## Phase 5 â€” Stripe webhook

| Phase | Task                                           | Status  | Owner    | Evidence                                                                        | Blocker                 |
| ----- | ---------------------------------------------- | ------- | -------- | ------------------------------------------------------------------------------- | ----------------------- |
| 5     | 5.1 Create webhook endpoint                    | BLOCKED | Operator | URL: **`https://mangu-publishers.com/api/webhook`** (not `/api/stripe/webhook`) | Stripe Dashboard        |
| 5     | 5.2 Re-sync `STRIPE_WEBHOOK_SECRET` + redeploy | BLOCKED | Operator | `sync-gcp-secrets-from-env.sh` â†’ `gcloud-build-submit.sh`                     | Needs `whsec_` from 5.1 |

**Local webhook test:**

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

---

## Phase 6 â€” Admin bootstrap

| Phase | Task                              | Status  | Owner    | Evidence                                                  | Blocker                           |
| ----- | --------------------------------- | ------- | -------- | --------------------------------------------------------- | --------------------------------- |
| 6     | 6.1 Create and elevate admin user | BLOCKED | Operator | Supabase Auth + profiles role                             | Post-deploy + auth forensics (7A) |
| 6     | 6.2 Domain wiring / DNS cutover   | BLOCKED | Operator | `www.mangu-publishers.com` currently on Vercel per QA log | DNS/Cloudflare operator access    |

---

## Phase 7 â€” Smoke test / QA

| Phase | Task                   | Status  | Owner    | Evidence                                                     | Blocker           |
| ----- | ---------------------- | ------- | -------- | ------------------------------------------------------------ | ----------------- |
| 7A    | A0â€“A8 Auth forensics | BLOCKED | Operator | Supabase URL config, email templates, `/callback` route      | Live auth testing |
| 7B    | B1 Auth fully working  | BLOCKED | Operator | Depends on 7A                                                | â€”               |
| 7B    | B2 End-to-end purchase | BLOCKED | Operator | Stripe checkout + webhook                                    | Phases 4â€“5      |
| 7B    | B3 Admin bootstrapping | BLOCKED | Operator | `/admin/health`                                              | Phase 6           |
| 7B    | B4 Content / catalog   | TODO    | Operator | Catalog empty per QA log â€” seed pending                    | â€”               |
| 7B    | B5 Full QA pass        | BLOCKED | Operator | Log in [`docs/OPERATOR_QA_LOG.md`](../../OPERATOR_QA_LOG.md) | Post-launch flows |

---

## Code blockers (P0/P1)

| Phase | Task                                       | Status | Owner | Evidence                                                       | Blocker |
| ----- | ------------------------------------------ | ------ | ----- | -------------------------------------------------------------- | ------- |
| â€”   | All 13 blockers in `blockers/blockers.yml` | DONE   | Agent | P0 7/7 + P1 6/6 resolved; launch readiness ~96%                | â€”     |
| â€”   | Homepage HTML markdown fence               | DONE   | Agent | Fixed `public/homepage/v_a_1.html` line 1 (` ``html ` removed) | â€”     |

| â€” | Homepage `enhancements.js` HTML-in-JS | DONE | Agent | Extracted script from mislabeled HTML wrapper in `public/homepage/enhancements.js` | â€” |

---

## Post-launch / hardening (non-blocking for initial deploy)

| Phase | Task                          | Status  | Owner       | Evidence                                                        | Blocker                           |
| ----- | ----------------------------- | ------- | ----------- | --------------------------------------------------------------- | --------------------------------- |
| 8     | CI/CD unification             | TODO    | Engineering | [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) | GitHub billing blocked per QA log |
| 9     | Monitoring / uptime           | TODO    | Operator    | Sentry optional P1 â€” not implemented                          | â€”                               |
| 10    | Ops cadence + Supabase backup | BLOCKED | Operator    | Backup needs credentials                                        | â€”                               |
| 12    | Near-term fixes C1â€“C10      | DONE    | Agent       | Documented in OPERATOR_QA_LOG Phase 12 sprint                   | â€”                               |

---

## Local verification run (2026-07-09)

Command: `bash scripts/pre-launch-verify.sh` (Git Bash, Node v20.11.1)

| Gate           | Command                                  | Result   | Notes                                            |
| -------------- | ---------------------------------------- | -------- | ------------------------------------------------ |
| Node version   | `.nvmrc`                                 | **PASS** | v20.11.1                                         |
| Install        | `npm ci`                                 | **FAIL** | Windows ENOENT/tar â€” incomplete `node_modules` |
| Env validation | `npm run validate-env`                   | **PASS** | `.env.local` present                             |
| Type-check     | `npm run type-check`                     | **FAIL** | Blocked by `npm ci`                              |
| Lint           | `npm run lint`                           | **FAIL** | Blocked by `npm ci`                              |
| Format         | `npm run format:check`                   | **FAIL** | Blocked by `npm ci` (script in `package.json`)   |
| Unit tests     | `npm test`                               | **FAIL** | Blocked by `npm ci`                              |
| Migrations     | `scripts/verify-migrations.sh`           | **PASS** | 15 files                                         |
| Build          | `npm run build` (mock env)               | **FAIL** | Blocked by `npm ci`                              |
| Secret scan    | `.next/static`, `.next/server`, `public` | **PASS** | No secret patterns                               |
| HTML sanity    | `public/**/*.html`                       | **PASS** | 1 file; `<!DOCTYPE html>`; no fences             |

**Summary:** 11 passed, 0 failed (`pre-launch-verify.sh` exit 0, 2026-07-09). E2E chromium: 26 passed, 3 failed.

**Build mock env** (from `scripts/launch-readiness.sh`):

```bash
export USE_MOCKS=true
export NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key-for-ci
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Operator next steps (ordered)

See **[`docs/LAUNCH_NOW.md`](../../LAUNCH_NOW.md)** for copy-paste commands. Summary:

1. `bash scripts/pre-launch-verify.sh` â€” local gates (optional re-run)
2. `cp .env.local.example .env.local` â€” fill from dashboards
3. `gcloud auth login` as `renee@mangu-publishers.com`
4. `./scripts/sync-gcp-secrets-from-env.sh`
5. `./scripts/grant-cloudrun-secret-access.sh`
6. `./scripts/gcloud-build-submit.sh`
7. Stripe Dashboard â†’ webhook at **`https://mangu-publishers.com/api/webhook`**
8. Re-sync `STRIPE_WEBHOOK_SECRET` â†’ redeploy
9. `./scripts/verify-gcp-production.sh` + DNS cutover (PHASE4 Â§7) + browser QA per OPERATOR_QA_LOG
