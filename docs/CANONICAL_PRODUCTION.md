# Canonical Production Target

**Decision (2026-05-19):** **Google Cloud Run** via [cloudbuild.yaml](../cloudbuild.yaml) is the authoritative production deployment path for MANGU Publishers.

> **Authority:** Signing ADR is [ADR-001](./adr/ADR-001-canonical-platform.md) (status **RECOMMENDED** Option A until Phase 6 signatures → ACCEPTED / G9). This file remains the operator checklist. Monitors target `https://mangu-publishers.com` (apex). `www` remains on Vercel until Phase 15 DNS cutover.

## Rationale

| Criterion                                        | Cloud Run          | Vercel (ci.yml)  | AWS Amplify             |
| ------------------------------------------------ | ------------------ | ---------------- | ----------------------- |
| Documented in README / QUICK_START               | Primary            | Secondary        | Legacy                  |
| Full pipeline (lint, test, secret audit, Docker) | Yes                | Partial          | No tests in amplify.yml |
| Secret Manager integration                       | Yes                | Vercel env UI    | Amplify env             |
| Service name alignment                           | `mangu-publishers` | Separate project | Different stack         |

## Operator launch checklist (step-by-step)

**Quick start:** [LAUNCH_NOW.md](./LAUNCH_NOW.md) · **Phase 4 detail:** [PHASE4_OPERATOR_RUNBOOK.md](./PHASE4_OPERATOR_RUNBOOK.md) · **Status:** [deployment_status.md](./reports/deployment/deployment_status.md)

| Constant       | Value                                      |
| -------------- | ------------------------------------------ |
| GCP account    | `renee@mangu-publishers.com`               |
| Project        | `delta-wonder-488420-i3`                   |
| Region         | `us-central1`                              |
| Service        | `mangu-publishers`                         |
| Domain         | `https://mangu-publishers.com`             |
| Stripe webhook | `https://mangu-publishers.com/api/webhook` |
| Deploy script  | `./scripts/gcloud-build-submit.sh`         |

Complete these in order after merging the launch-unblock PR to `main`.

### 1. Local environment

```bash
cp .env.local.example .env.local
# Fill placeholders from dashboards (no real values in git):
#   Supabase → https://app.supabase.com/project/_/settings/api
#   Stripe   → https://dashboard.stripe.com/apikeys
#   Upstash  → https://console.upstash.com/
npm run validate-env
bash scripts/launch-readiness.sh
```

### 2. GCP authentication and secrets

```bash
gcloud auth login                    # renee@mangu-publishers.com
gcloud config set project delta-wonder-488420-i3
./scripts/sync-gcp-secrets-from-env.sh
./scripts/verify-gcp-production.sh
```

Required Secret Manager names (created by sync script when values exist in `.env.local`):

| Secret name                 | Env var                               |
| --------------------------- | ------------------------------------- |
| `supabase-service-role-key` | `SUPABASE_SERVICE_ROLE_KEY`           |
| `stripe-secret-key`         | `STRIPE_SECRET_KEY`                   |
| `stripe-webhook-secret`     | `STRIPE_WEBHOOK_SECRET`               |
| `upstash-redis-rest-url`    | `UPSTASH_REDIS_REST_URL` (optional)   |
| `upstash-redis-rest-token`  | `UPSTASH_REDIS_REST_TOKEN` (optional) |
| `resend-api-key`            | `RESEND_API_KEY` (optional)           |
| `openai-api-key`            | `OPENAI_API_KEY` (optional)           |

### 3. Supabase production migrations

```bash
# Option A: SQL Editor (recommended for hosted Supabase)
./scripts/bundle-migrations.sh > /tmp/mangu-migrations.sql
# Paste into Supabase Dashboard → SQL Editor → Run

# Option B: Supabase CLI (if project linked)
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Verify: tables exist, RLS enabled, `npm run verify-rls` passes against prod URL (with `.env.local` pointing at prod).

### 4. Stripe production webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://mangu-publishers.com/api/webhook`
3. Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed` (minimum)
4. Copy signing secret → add to `.env.local` as `STRIPE_WEBHOOK_SECRET`
5. Re-run `./scripts/sync-gcp-secrets-from-env.sh`

Local testing:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

### 5. Deploy to Cloud Run

```bash
# Loads NEXT_PUBLIC_* from .env.local and submits cloudbuild.yaml with substitutions:
./scripts/gcloud-build-submit.sh
```

Do **not** run raw `gcloud builds submit` without substitutions — the script loads required `_NEXT_PUBLIC_*` values from `.env.local`. Private secrets come from Secret Manager at deploy time.

### 6. Post-deploy verification

```bash
./scripts/verify-gcp-production.sh
curl -sfS https://mangu-publishers.com/api/live
curl -sfS "https://mangu-publishers.com/api/health?ready=1" | jq .
```

### 7. Browser QA (manual)

| Flow             | Pass criteria                                   |
| ---------------- | ----------------------------------------------- |
| Register / login | Auth cookies set, dashboard loads               |
| Browse books     | `/books`, deep links return 200                 |
| Checkout         | Stripe test/live session creates                |
| Admin health     | `/admin/health` shows green checks (admin role) |
| Webhook          | Test payment updates order in Supabase          |

Log results in [docs/OPERATOR_QA_LOG.md](./OPERATOR_QA_LOG.md).

## What this means operationally

1. **Release:** Merge to `main` → Cloud Build → Cloud Run revision.
2. **Secrets:** GCP Secret Manager names must match `cloudbuild.yaml` `--set-secrets`.
3. **Verify:** `./scripts/verify-gcp-production.sh` + `bash scripts/launch-readiness.sh` locally first.
4. **Vercel:** Retired (Fix C10 + PR #144). The standalone `vercel-deploy.yml` workflow duplicated CI lint/build with dummy credentials and never deployed; it and the optional ci.yml Vercel job have both been removed. Cloud Run is the only deploy target.
5. **Amplify:** Legacy reference only — do not use for new releases.

## Operator scripts

| Script                                                                                | Purpose                                                   |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [scripts/launch-readiness.sh](../scripts/launch-readiness.sh)                         | Local CI mirror + migration + lockfile gates              |
| [scripts/ci-local.sh](../scripts/ci-local.sh)                                         | Same gates, npm-based                                     |
| [scripts/verify-gcp-production.sh](../scripts/verify-gcp-production.sh)               | Secret + Cloud Run health check                           |
| [scripts/sync-gcp-secrets-from-env.sh](../scripts/sync-gcp-secrets-from-env.sh)       | Push `.env.local` server secrets to GCP                   |
| [scripts/gcloud-build-submit.sh](../scripts/gcloud-build-submit.sh)                   | Submit Cloud Build with `NEXT_PUBLIC_*` from `.env.local` |
| [scripts/grant-cloudrun-secret-access.sh](../scripts/grant-cloudrun-secret-access.sh) | IAM bindings for Cloud Run runtime SA                     |
| [scripts/verify-migrations.sh](../scripts/verify-migrations.sh)                       | Pre-deploy migration file check                           |
| [scripts/bundle-migrations.sh](../scripts/bundle-migrations.sh)                       | Single SQL bundle for Supabase                            |
| [blockers/fix-all.sh](../blockers/fix-all.sh)                                         | Full blocker pipeline verification                        |

## Related issues

- Closes [#70 — Decide canonical production target](https://github.com/redinc23/my_publishing/issues/70).
