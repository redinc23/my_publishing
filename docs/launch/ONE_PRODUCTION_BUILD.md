# One Production Build Runbook

This is the single production launch path for MANGU Publishers.

Do not launch production from AWS Amplify or Vercel unless a new architecture decision replaces this document. Those configs remain in the repository as legacy/secondary references.

## Production architecture

```text
Developer/operator
  -> main branch
  -> cloudbuild.yaml
  -> Cloud Build quality gates
  -> Docker image in Artifact Registry
  -> Cloud Run service mangu-publishers
  -> Supabase + Stripe + optional OpenAI/Resend
```

## Source of truth

| Concern | Source |
| --- | --- |
| Build/deploy pipeline | [`cloudbuild.yaml`](../../cloudbuild.yaml) |
| Launch wrapper | [`deploy_master.sh`](../../deploy_master.sh) |
| Build submission helper | [`scripts/gcloud-build-submit.sh`](../../scripts/gcloud-build-submit.sh) |
| Secret sync helper | [`scripts/sync-gcp-secrets-from-env.sh`](../../scripts/sync-gcp-secrets-from-env.sh) |
| Production verification | [`scripts/verify-gcp-production.sh`](../../scripts/verify-gcp-production.sh) |
| Account links workbook | [`PRODUCTION_ACCOUNT_LINKS.md`](./PRODUCTION_ACCOUNT_LINKS.md) |

## Build gates

Cloud Build must pass these gates before Cloud Run receives traffic:

1. `npm ci`
2. `npm run lint`
3. `npm run type-check`
4. `npm test`
5. `npm run build`
6. Secret audit against `.next/static`, `.next/server`, and `public`
7. Docker build and push
8. Cloud Run deploy
9. Cloud Run service description verification

Local mirror:

```bash
./scripts/ci-local.sh
```

## Required operator inputs

Fill [`PRODUCTION_ACCOUNT_LINKS.md`](./PRODUCTION_ACCOUNT_LINKS.md) before launch. Keep secrets out of docs.

Required values in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=https://mangu-publishers.com
```

Optional:

```bash
OPENAI_API_KEY=
RESEND_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Pre-launch sequence

### 1. Confirm clean quality gate

```bash
npm ci
./scripts/ci-local.sh
```

### 2. Apply Supabase migrations

Recommended path:

```bash
./scripts/bundle-migrations.sh > /tmp/mangu-all-migrations.sql
```

Then paste the bundle into the Supabase SQL Editor for the production project listed in [`PRODUCTION_ACCOUNT_LINKS.md`](./PRODUCTION_ACCOUNT_LINKS.md).

Verify:

```bash
npm run verify-rls
```

### 3. Authenticate GCP

```bash
gcloud auth login
gcloud config set project delta-wonder-488420-i3
```

### 4. Sync server secrets

```bash
./scripts/sync-gcp-secrets-from-env.sh
```

Expected GCP Secret Manager entries:

- `supabase-service-role-key`
- `stripe-secret-key`
- `stripe-webhook-secret`
- `openai-api-key` optional
- `resend-api-key` optional

### 5. Launch one production build

Preferred:

```bash
./deploy_master.sh
```

Equivalent lower-level commands:

```bash
./scripts/gcloud-build-submit.sh
./scripts/verify-gcp-production.sh
```

## Post-deploy verification

Run:

```bash
curl -i https://mangu-publishers.com/api/live
curl -i 'https://mangu-publishers.com/api/health?ready=1'
curl -I https://mangu-publishers.com/
curl -I https://mangu-publishers.com/homepage/v_a_1.html
```

Expected:

- `/api/live` returns HTTP 200 with `status: "alive"`
- `/api/health?ready=1` returns HTTP 200 and `ready: true`
- `/` reaches the launch homepage
- `/homepage/v_a_1.html` returns HTTP 200

## Stripe webhook cutover

After Cloud Run is reachable:

1. Open Stripe webhooks from [`PRODUCTION_ACCOUNT_LINKS.md`](./PRODUCTION_ACCOUNT_LINKS.md).
2. Create or update endpoint:
   ```text
   https://mangu-publishers.com/api/webhook
   ```
3. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
   - `payment_intent.payment_failed`
4. Copy the `whsec_...` signing secret into `.env.local`.
5. Run:
   ```bash
   ./scripts/sync-gcp-secrets-from-env.sh
   ./scripts/gcloud-build-submit.sh
   ```
6. Complete a Stripe test checkout and confirm rows in `orders` and `webhook_events`.

## Go/no-go gate

Production is **GO** only when all are true:

- [ ] `npm ci` passes
- [ ] `./scripts/ci-local.sh` passes
- [ ] Supabase migrations are applied
- [ ] First production admin user exists
- [ ] GCP secrets are synced
- [ ] Cloud Build is green
- [ ] `/api/live` is healthy
- [ ] `/api/health?ready=1` is ready
- [ ] Homepage returns 200
- [ ] Stripe webhook delivers successfully
- [ ] Manual auth/admin/checkout QA is complete

If any item fails, production is **NO-GO**.

## Rollback

Use Cloud Run revision traffic management:

1. Open the Cloud Run service link from [`PRODUCTION_ACCOUNT_LINKS.md`](./PRODUCTION_ACCOUNT_LINKS.md).
2. Select the last known-good revision.
3. Route 100% traffic to that revision.
4. Record the rollback evidence in [`PRODUCTION_ACCOUNT_LINKS.md`](./PRODUCTION_ACCOUNT_LINKS.md).

