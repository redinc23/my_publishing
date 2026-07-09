# Phase 4 Operator Runbook

Single copy-paste sequence for the operator blocked on GCP auth. Run from repo root after `.env.local` is filled (`cp .env.local.example .env.local`).

**Quick start:** [LAUNCH_NOW.md](./LAUNCH_NOW.md) (condensed checklist) · **Status:** [deployment_status.md](./reports/deployment/deployment_status.md)  
**Canonical references:** [MASTER_EXECUTION_CHECKLIST.md](./MASTER_EXECUTION_CHECKLIST.md) Phase 4 · [CANONICAL_PRODUCTION.md](./CANONICAL_PRODUCTION.md) · [OPERATOR_QA_LOG.md](./OPERATOR_QA_LOG.md)

| Constant       | Value                                         |
| -------------- | --------------------------------------------- |
| GCP account    | `renee@mangu-publishers.com` (never `books@`) |
| Project        | `delta-wonder-488420-i3`                      |
| Region         | `us-central1`                                 |
| Service        | `mangu-publishers`                            |
| Domain         | `https://mangu-publishers.com`                |
| Stripe webhook | `https://mangu-publishers.com/api/webhook`    |

---

## 1. GCP auth and project

```bash
gcloud auth login                    # choose renee@mangu-publishers.com
gcloud auth application-default login
gcloud config set account renee@mangu-publishers.com
gcloud config set project delta-wonder-488420-i3
gcloud config set run/region us-central1
gcloud auth list                     # active account must be renee@
```

## 2. Bootstrap (optional preflight)

```bash
./scripts/bootstrap-operator-access.sh
```

## 3. Sync secrets and grant Cloud Run access

```bash
./scripts/sync-gcp-secrets-from-env.sh
./scripts/grant-cloudrun-secret-access.sh
./scripts/verify-gcp-production.sh
```

## 4. Deploy

```bash
./scripts/gcloud-build-submit.sh
```

Do **not** use raw `gcloud builds submit` — the script loads required `_NEXT_PUBLIC_*` substitutions from `.env.local`.

## 5. Post-deploy verify

```bash
./scripts/verify-gcp-production.sh
curl -sS https://mangu-publishers.com/api/live
curl -sS "https://mangu-publishers.com/api/health?ready=1"
curl -sS -o /dev/null -w "%{http_code}\n" https://mangu-publishers.com/homepage/v_a_1.html
```

Expect: fresh `/api/live` timestamp, `/api/health?ready=1` healthy (env, DB, auth, migrations, Stripe).

## 6. Stripe webhook (after deploy is reachable)

**URL must be exactly** `https://mangu-publishers.com/api/webhook` (not `/api/stripe/webhook`).

```bash
# Option A: script (live mode keys in .env.local)
./scripts/create-stripe-webhook.sh

# Option B: Stripe Dashboard → Developers → Webhooks → Add endpoint
#   URL: https://mangu-publishers.com/api/webhook
#   Events: checkout.session.completed (minimum)
#   Copy whsec_... → .env.local STRIPE_WEBHOOK_SECRET
```

Re-sync and redeploy so Cloud Run picks up the new secret:

```bash
# update .env.local: STRIPE_WEBHOOK_SECRET=whsec_...
./scripts/sync-gcp-secrets-from-env.sh
./scripts/gcloud-build-submit.sh
```

Local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

## 7. DNS cutover (Vercel → Cloud Run)

Per [OPERATOR_QA_LOG.md](./OPERATOR_QA_LOG.md): `www.mangu-publishers.com` currently serves via **Vercel**. Apex may TLS-mismatch until cutover.

1. Confirm Cloud Run revision healthy (step 5) **before** DNS changes.
2. Map domain in Cloud Run → Integrations → Custom Domains (or use existing mapping).
3. Update registrar/DNS: point `mangu-publishers.com` / `www` at Cloud Run (`ghs.googlehosted.com` or Cloud Run mapping records) — **not** Vercel.
4. If Cloudflare proxies the record, set DNS-only during cutover to avoid stale cache.
5. Verify: `curl -sI https://mangu-publishers.com` → 200/307, valid cert; `/api/live` timestamp matches today's deploy.

Record wiring conclusion in `docs/OPERATOR_QA_LOG.md`.

---

## Quick reference — scripts

| Script                                    | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| `scripts/bootstrap-operator-access.sh`    | Auth, env, GCP, domain, webhook preflight   |
| `scripts/sync-gcp-secrets-from-env.sh`    | Push `.env.local` secrets to Secret Manager |
| `scripts/grant-cloudrun-secret-access.sh` | IAM bindings for runtime SA                 |
| `scripts/gcloud-build-submit.sh`          | Cloud Build submit with substitutions       |
| `scripts/verify-gcp-production.sh`        | Secret + health checks                      |
| `scripts/create-stripe-webhook.sh`        | Create live webhook at `/api/webhook`       |

## Not required for MVP

- **Sentry** — optional P1, not implemented (App Router; placeholder in `components/common/ErrorBoundary.tsx`). Use Cloud Logging.
