# MANGU Production Launch Checklist

This checklist follows the single production build path:

```text
Cloud Build -> Artifact Registry -> Cloud Run service mangu-publishers
```

Use the detailed runbook in [`docs/launch/ONE_PRODUCTION_BUILD.md`](./launch/ONE_PRODUCTION_BUILD.md) and fill account/dashboard links in [`docs/launch/PRODUCTION_ACCOUNT_LINKS.md`](./launch/PRODUCTION_ACCOUNT_LINKS.md).

AWS Amplify and Vercel files remain in the repository for legacy/reference use only. They are not the production launch path.

## 1. Account workbook

- [ ] Fill [`docs/launch/PRODUCTION_ACCOUNT_LINKS.md`](./launch/PRODUCTION_ACCOUNT_LINKS.md) with dashboard hyperlinks.
- [ ] Confirm no secrets were pasted into docs.
- [ ] Confirm account owners for GitHub, GCP, Supabase, Stripe, registrar, and optional services.

## 2. Local quality gate

- [ ] Use Node 20, matching `package.json` and the Docker image.
- [ ] Run:
  ```bash
  npm ci
  ./scripts/ci-local.sh
  ```
- [ ] Confirm lint, type-check, unit tests, and production build pass.

## 3. Supabase

- [ ] Confirm production Supabase project URL and project ref.
- [ ] Apply migrations:
  ```bash
  ./scripts/bundle-migrations.sh > /tmp/mangu-all-migrations.sql
  ```
- [ ] Paste/run bundle in Supabase SQL Editor.
- [ ] Confirm required tables exist:
  - `profiles`
  - `authors`
  - `books`
  - `orders`
  - `webhook_events`
  - `analytics_events`
- [ ] Confirm storage buckets exist:
  - `book-covers`
  - `manuscripts`
  - `published-epubs`
- [ ] Create first production admin user.
- [ ] Run:
  ```bash
  npm run verify-rls
  ```

## 4. GCP secrets

- [ ] Fill `.env.local` with real production values.
- [ ] Authenticate:
  ```bash
  gcloud auth login
  gcloud config set project delta-wonder-488420-i3
  ```
- [ ] Sync secrets:
  ```bash
  ./scripts/sync-gcp-secrets-from-env.sh
  ```
- [ ] Confirm required Secret Manager entries:
  - `supabase-service-role-key`
  - `stripe-secret-key`
  - `stripe-webhook-secret`

## 5. Production deploy

- [ ] Run the canonical launch wrapper:
  ```bash
  ./deploy_master.sh
  ```
- [ ] Confirm Cloud Build passes:
  - `npm ci`
  - lint
  - type-check
  - unit tests
  - Next.js build
  - secret audit
  - Docker build/push
  - Cloud Run deploy
- [ ] Paste Cloud Build and Cloud Run links into [`docs/launch/PRODUCTION_ACCOUNT_LINKS.md`](./launch/PRODUCTION_ACCOUNT_LINKS.md).

## 6. Health checks

- [ ] Liveness:
  ```bash
  curl -i https://mangu-publishers.com/api/live
  ```
- [ ] Readiness:
  ```bash
  curl -i 'https://mangu-publishers.com/api/health?ready=1'
  ```
- [ ] Homepage:
  ```bash
  curl -I https://mangu-publishers.com/
  curl -I https://mangu-publishers.com/homepage/v_a_1.html
  ```

## 7. Stripe

- [ ] Create/update webhook endpoint:
  ```text
  https://mangu-publishers.com/api/webhook
  ```
- [ ] Select events:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `charge.refunded`
  - `payment_intent.payment_failed`
- [ ] Store new `whsec_...` value in GCP Secret Manager as `stripe-webhook-secret`.
- [ ] Redeploy with `./scripts/gcloud-build-submit.sh`.
- [ ] Complete test checkout.
- [ ] Confirm `orders` and `webhook_events` rows are created.

## 8. Manual QA

- [ ] Register new user.
- [ ] Confirm profile auto-creation.
- [ ] Login/logout.
- [ ] Password reset.
- [ ] Browse `/books`.
- [ ] Open book detail page.
- [ ] Confirm unauthenticated users are redirected from protected pages.
- [ ] Confirm non-admin users cannot access `/admin`.
- [ ] Confirm admin can access `/admin/health`.
- [ ] Confirm author route access for author/admin roles.
- [ ] Confirm partner route access for partner/admin roles.
- [ ] Confirm Stripe checkout and webhook behavior.

## 9. Go/no-go

Production is **GO** only if all previous sections pass.

Production is **NO-GO** if any of these fail:

- `npm ci`
- `./scripts/ci-local.sh`
- Cloud Build
- `/api/live`
- `/api/health?ready=1`
- Supabase migrations/RLS
- Stripe webhook
- Admin/auth manual QA

