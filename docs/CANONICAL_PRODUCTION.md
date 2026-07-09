# Canonical Production Target

**Decision (2026-05-19):** **Google Cloud Run** via [cloudbuild.yaml](../cloudbuild.yaml) is the authoritative production deployment path for MANGU Publishers.

## Rationale

| Criterion | Cloud Run | Vercel (ci.yml) | AWS Amplify |
|-----------|-----------|-----------------|-------------|
| Documented in README / QUICK_START | Primary | Secondary | Legacy |
| Full pipeline (lint, test, secret audit, Docker) | Yes | Partial | No tests in amplify.yml |
| Secret Manager integration | Yes | Vercel env UI | Amplify env |
| Service name alignment | `mangu-publishers` | Separate project | Different stack |

## Operator launch checklist (step-by-step)

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
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
./scripts/sync-gcp-secrets-from-env.sh
./scripts/verify-gcp-production.sh
```

Required Secret Manager names (created by sync script when values exist in `.env.local`):

| Secret name | Env var |
|-------------|---------|
| `supabase-service-role-key` | `SUPABASE_SERVICE_ROLE_KEY` |
| `stripe-secret-key` | `STRIPE_SECRET_KEY` |
| `stripe-webhook-secret` | `STRIPE_WEBHOOK_SECRET` |
| `upstash-redis-rest-url` | `UPSTASH_REDIS_REST_URL` (optional) |
| `upstash-redis-rest-token` | `UPSTASH_REDIS_REST_TOKEN` (optional) |
| `resend-api-key` | `RESEND_API_KEY` (optional) |
| `openai-api-key` | `OPENAI_API_KEY` (optional) |

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
2. URL: `https://YOUR_DOMAIN/api/webhook`  
3. Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed` (minimum)  
4. Copy signing secret → add to `.env.local` as `STRIPE_WEBHOOK_SECRET`  
5. Re-run `./scripts/sync-gcp-secrets-from-env.sh`

Local testing:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

### 5. Deploy to Cloud Run

```bash
# Trigger via push to main (Cloud Build) or manual:
gcloud builds submit --config=cloudbuild.yaml
```

Substitutions in `cloudbuild.yaml` must include public env vars (`_NEXT_PUBLIC_*`). Private secrets come from Secret Manager at deploy time.

### 6. Post-deploy verification

```bash
./scripts/verify-gcp-production.sh
curl -sfS https://YOUR_DOMAIN/api/live
curl -sfS https://YOUR_DOMAIN/api/health | jq .
```

### 7. Browser QA (manual)

| Flow | Pass criteria |
|------|----------------|
| Register / login | Auth cookies set, dashboard loads |
| Browse books | `/books`, deep links return 200 |
| Checkout | Stripe test/live session creates |
| Admin health | `/admin/health` shows green checks (admin role) |
| Webhook | Test payment updates order in Supabase |

Log results in [docs/OPERATOR_QA_LOG.md](./OPERATOR_QA_LOG.md).

## What this means operationally

1. **Release:** Merge to `main` → Cloud Build → Cloud Run revision.
2. **Secrets:** GCP Secret Manager names must match `cloudbuild.yaml` `--set-secrets`.
3. **Verify:** `./scripts/verify-gcp-production.sh` + `bash scripts/launch-readiness.sh` locally first.
4. **Vercel:** Retired (Fix C10 + PR #144). The standalone `vercel-deploy.yml` workflow duplicated CI lint/build with dummy credentials and never deployed; it and the optional ci.yml Vercel job have both been removed. Cloud Run is the only deploy target.
5. **Amplify:** Legacy reference only — do not use for new releases.

## Operator scripts

| Script | Purpose |
|--------|---------|
| [scripts/launch-readiness.sh](../scripts/launch-readiness.sh) | Local CI mirror + migration + lockfile gates |
| [scripts/ci-local.sh](../scripts/ci-local.sh) | Same gates, npm-based |
| [scripts/verify-gcp-production.sh](../scripts/verify-gcp-production.sh) | Secret + Cloud Run health check |
| [scripts/sync-gcp-secrets-from-env.sh](../scripts/sync-gcp-secrets-from-env.sh) | Push `.env.local` server secrets to GCP |
| [scripts/verify-migrations.sh](../scripts/verify-migrations.sh) | Pre-deploy migration file check |
| [scripts/bundle-migrations.sh](../scripts/bundle-migrations.sh) | Single SQL bundle for Supabase |
| [blockers/fix-all.sh](../blockers/fix-all.sh) | Full blocker pipeline verification |

## Related issues

- Closes [#70 — Decide canonical production target](https://github.com/redinc23/my_publishing/issues/70).
