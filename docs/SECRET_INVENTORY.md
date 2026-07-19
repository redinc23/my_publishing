# Secret Inventory (REDACTED — P0-016 / CCR-009)

**Status:** Redacted inventory only. This document lists secret **names**,
**store-of-record identifiers**, and **accessor bindings**. It must **never**
contain secret values (CCR-009). If a value is ever pasted here, treat it as
compromised: rotate immediately and scrub git history.

**Canonical platform (ADR-001, ACCEPTED Option B):** Vercel is the sole
canonical production platform. The store of record for production runtime
env is **Vercel → Project `manguprojectz` → Settings → Environment Variables
(Production)**. GCP Secret Manager (project `delta-wonder-488420-i3`) remains
the store for the **legacy / non-canonical Cloud Run surface** (apex may still
resolve to Cloud Run until the Phase 15 DNS cutover) and for emergency rollback.

## 1. P0-016 scope — payment & rate-limit secrets

| Env var | Purpose | Store of record (canonical) | Legacy store ID (GCP Secret Manager) | Expected format (never the value) |
| --- | --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe API secret (payments) | Vercel Production env | `projects/delta-wonder-488420-i3/secrets/stripe-secret-key` | `sk_live_…` (production); must match publishable-key mode |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification | Vercel Production env | `projects/delta-wonder-488420-i3/secrets/stripe-webhook-secret` | `whsec_…` from the canonical endpoint (`https://www.mangu-publishers.com/api/webhook`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js client key (public by design) | Vercel Production env (build-time bake) | _Not stored in Secret Manager_ — build-time value (`cloudbuild.yaml` substitution on the legacy path) | `pk_live_…` (production); same account + mode as `STRIPE_SECRET_KEY` |
| `UPSTASH_REDIS_REST_URL` | Distributed rate limiting (endpoint) | Vercel Production env | `projects/delta-wonder-488420-i3/secrets/upstash-redis-rest-url` | `https://….upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limiting (credential) | Vercel Production env | `projects/delta-wonder-488420-i3/secrets/upstash-redis-rest-token` | Upstash REST token (non-empty) |

### Must be ABSENT in production (P0-016)

| Env var | Why forbidden | Enforcement |
| --- | --- | --- |
| `USE_MOCKS` | `true` swaps live Stripe/Upstash for mocks — silent payment/rate-limit failure | `npm run validate-env -- --production` fails if present-and-`true`, warns if present at all; never set it in Vercel Production or Cloud Run `--set-env-vars` |
| `SKIP_EMAILS` | `true` suppresses transactional email in production | Same as above |

## 2. Other secrets referenced by the ops scripts (context)

| Env var | Legacy store ID (GCP Secret Manager) | Required on legacy Cloud Run path |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `projects/delta-wonder-488420-i3/secrets/supabase-service-role-key` | Required (`--set-secrets` in `cloudbuild.yaml`) |
| `RESEND_API_KEY` | `projects/delta-wonder-488420-i3/secrets/resend-api-key` | Optional (mounted only if the secret exists) |
| `OPENAI_API_KEY` | `projects/delta-wonder-488420-i3/secrets/openai-api-key` | Optional (mounted only if the secret exists) |

## 3. Accessor bindings (least privilege — CCR-008)

- **Canonical (Vercel):** Production env vars are injected by Vercel at
  build/runtime for project `manguprojectz` only. No GCP IAM binding exists
  for the canonical path; access is governed by Vercel project membership.
- **Legacy (Cloud Run):** exactly one principal — the Cloud Run **runtime
  service account** — holds `roles/secretmanager.secretAccessor`, and only on
  the secret names in §1/§2. The runtime SA is resolved by
  `scripts/grant-cloudrun-secret-access.sh` in this order:
  1. explicit `SERVICE_ACCOUNT` override,
  2. the SA the deployed service actually runs as
     (`gcloud run services describe … spec.template.spec.serviceAccountName`),
  3. the project default compute SA
     (`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`).
- Bindings are managed **only** via
  `scripts/grant-cloudrun-secret-access.sh` (idempotent; binds only secrets
  that exist; skips absent optional secrets with a note; fails closed when a
  required secret is missing). Review with `DRY_RUN=1` before applying.
- No other human or SA principal should hold `secretAccessor` on these
  secrets. Audit:
  `gcloud secrets get-iam-policy <secret> --project=delta-wonder-488420-i3`.

## 4. Validation commands (repo-side)

```bash
npm run validate-env -- --production        # production-shaped config (P0-016)
DRY_RUN=1 ./scripts/grant-cloudrun-secret-access.sh   # preview IAM bindings (legacy path)
./scripts/verify-gcp-production.sh                    # legacy surface liveness/readiness
```

Runtime/GCP-side verification (live Stripe mode match, actual Vercel/GCP
values, IAM audit, masked env-name export in `docs/OPERATOR_QA_LOG.md`) is a
**human operator task** — see `HUMAN_TASKS.md` and issue #203.
