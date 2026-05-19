# Canonical Production Target

**Decision (2026-05-19):** **Google Cloud Run** via [cloudbuild.yaml](../cloudbuild.yaml) is the authoritative production deployment path for MANGU Publishers.

## Rationale

| Criterion | Cloud Run | Vercel (ci.yml) | AWS Amplify |
|-----------|-----------|-----------------|-------------|
| Documented in README / QUICK_START | Primary | Secondary | Legacy |
| Full pipeline (lint, test, secret audit, Docker) | Yes | Partial (build only on host) | No tests in amplify.yml |
| Secret Manager integration | Yes | Vercel env UI | Amplify env |
| Service name alignment | `mangu-publishers` | Separate project | Different stack |

## What this means operationally

1. **Release:** Merge to `main` → trigger Cloud Build (or manual `gcloud builds submit`) → Cloud Run revision.
2. **Secrets:** GCP Secret Manager names must match `cloudbuild.yaml` `--set-secrets`. Use `./scripts/sync-gcp-secrets-from-env.sh` after `gcloud auth login`.
3. **Verify:** `./scripts/verify-gcp-production.sh` (health on `/api/health`).
4. **Vercel:** GitHub `deploy` job runs only when `VERCEL_TOKEN` is configured; treat as preview/staging, not primary prod.
5. **Amplify:** [amplify.yml](../amplify.yml) and [AMPLIFY_READY.md](../AMPLIFY_READY.md) are retained for reference only—do not use for new releases without explicit decision.

## Related issues

- Closes tracking for [#70 — Decide canonical production target](https://github.com/redinc23/my_publishing/issues/70).

## Operator scripts

| Script | Purpose |
|--------|---------|
| [scripts/verify-gcp-production.sh](../scripts/verify-gcp-production.sh) | Secret + Cloud Run health check |
| [scripts/sync-gcp-secrets-from-env.sh](../scripts/sync-gcp-secrets-from-env.sh) | Push `.env.local` server secrets to GCP |
| [scripts/bundle-migrations.sh](../scripts/bundle-migrations.sh) | Single SQL bundle for Supabase |
