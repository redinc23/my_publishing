# Production Recovery Operator Instructions

Use this runbook to recover and validate production for Mangu Publishers.

## Give the Agent Access (start here)

**One-time setup** (browser logins — do once):

```bash
cd /Users/city/my_publishing_recovery_20260529
gcloud auth login
gcloud auth application-default login
supabase login
stripe login
gcloud config set project delta-wonder-488420-i3
gcloud config set run/region us-central1
supabase link --project-ref tkzvikozrcynhwsqtkqp
cp .env.local.example .env.local   # fill values from dashboards; never commit
# Or run the guided wizard instead:
# ./scripts/setup-env-interactive.sh
# If pasted secret input looks "encrypted"/invisible, rerun with --show-input.
# ./scripts/setup-env-interactive.sh --show-input
```

In Cursor chat, approve **Supabase MCP auth** when the agent requests it.

**Every time after that** — one command proves the agent can check everything:

```bash
./scripts/bootstrap-operator-access.sh
```

Optional: push local secrets to GCP before verify:

```bash
./scripts/bootstrap-operator-access.sh --sync-secrets
```

If output shows **ALL CHECKS PASSED**, tell the agent: *bootstrap passed — go verify production*.

---

Environment this document targets:
- GCP project: `delta-wonder-488420-i3`
- Cloud Run service: `mangu-publishers`
- Region: `us-central1`
- Supabase project ref: `tkzvikozrcynhwsqtkqp`
- Production domain: `https://mangu-publishers.com`
- Webhook route in app code: `/api/webhook` (verified from `app/api/webhook/route.ts`)

## Do These In Order

1. [BLOCKING] Verify access, local tooling, and repo state.
2. [BLOCKING] Complete one-time auth (`gcloud`, `supabase`, `stripe`).
3. [BLOCKING] Verify required GCP secrets and health checks.
4. [BLOCKING] Configure Stripe production webhook endpoint and capture secret.
5. [BLOCKING] Deploy using Cloud Build from this repo.
6. [BLOCKING] Run smoke tests against Cloud Run URL and production domain.
7. [NON-BLOCKING] Confirm observability and capture evidence for handoff.

## What You Must Have First

- [BLOCKING] Google Cloud permissions in project `delta-wonder-488420-i3`:
  - Cloud Run Admin (or equivalent deploy permission)
  - Cloud Build Editor/Viewer
  - Secret Manager Secret Accessor/Admin
  - Service Account User (if deploy uses dedicated SA)
- [BLOCKING] Supabase permissions for project `tkzvikozrcynhwsqtkqp`:
  - Access to SQL editor or CLI-linked migrations
  - Ability to view tables `orders`, `webhook_events`, `analytics_events`
- [BLOCKING] Stripe production dashboard access with webhook edit rights.
- [BLOCKING] Local tools installed:
  - `gcloud` (authenticated)
  - `node` 20.x and `npm`
  - `curl`, `jq`
  - `supabase` CLI
  - `stripe` CLI
- [NON-BLOCKING] Optional monitoring access:
  - Cloud Logging / Error Reporting
  - Stripe webhook event logs
  - Supabase logs/query inspector

Quick check:

```bash
gcloud --version
node --version
npm --version
supabase --version
stripe --version
```

Success indicator: all commands return versions, no "command not found".

## One-Time Auth/Setup (gcloud, Supabase, Stripe manual gate)

### 1) GCloud auth and project targeting [BLOCKING]

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project delta-wonder-488420-i3
gcloud config set run/region us-central1
gcloud config list --format='text(core.project,run.region)'
```

Success indicator: project shows `delta-wonder-488420-i3`; region shows `us-central1`.

### 2) Supabase auth and link [BLOCKING]

```bash
supabase login
supabase link --project-ref tkzvikozrcynhwsqtkqp
supabase projects list | rg tkzvikozrcynhwsqtkqp
```

Success indicator: linked project ref appears and no auth error.

### 3) Stripe manual gate (human confirmation) [BLOCKING]

- Confirm you are in **Live mode** (not Test mode).
- Confirm you can edit webhook endpoints for the account owning `https://mangu-publishers.com`.

Success indicator: Stripe dashboard shows Live mode toggle active and webhook UI editable.

## Step-By-Step Sequence (exact commands + success indicators)

### Step 1 - Verify repo and baseline checks [BLOCKING]

```bash
cd /Users/city/my_publishing_recovery_20260529
git status --short
npm ci
npm run lint
npm run type-check
```

Success indicator:
- working tree status understood
- `npm ci`, lint, and type-check all exit 0.

### Step 2 - Validate required runtime secrets in GCP [BLOCKING]

Use the repo verification script:

```bash
cd /Users/city/my_publishing_recovery_20260529
PROJECT_ID=delta-wonder-488420-i3 REGION=us-central1 SERVICE_NAME=mangu-publishers ./scripts/verify-gcp-production.sh
```

Success indicator:
- required secrets reported as `OK`:
  - `supabase-service-role-key`
  - `stripe-secret-key`
  - `stripe-webhook-secret`
- health checks on `/api/live` and `/api/health` return success.

### Step 3 - Sync missing secrets if needed [BLOCKING if missing]

Run only if Step 2 reports missing required secrets:

```bash
cd /Users/city/my_publishing_recovery_20260529
./scripts/sync-gcp-secrets-from-env.sh
```

Success indicator: rerunning Step 2 shows no required secrets missing.

### Step 4 - Configure Stripe webhook in dashboard [BLOCKING]

Complete the manual Stripe section below, then verify endpoint status is healthy.

Success indicator: endpoint `https://mangu-publishers.com/api/webhook` is enabled, events selected, signing secret copied to GCP secret `stripe-webhook-secret`.

### Step 5 - Deploy via Cloud Build config [BLOCKING]

```bash
cd /Users/city/my_publishing_recovery_20260529
gcloud builds submit \
  --config cloudbuild.yaml \
  --project delta-wonder-488420-i3 \
  --substitutions=_REGION=us-central1,_SERVICE_NAME=mangu-publishers
```

Success indicator:
- Cloud Build finishes with `SUCCESS`
- deploy step updates Cloud Run service `mangu-publishers`
- verify step returns service YAML without errors.

### Step 6 - Check deployed service revision [BLOCKING]

```bash
gcloud run services describe mangu-publishers \
  --project delta-wonder-488420-i3 \
  --region us-central1 \
  --format='table(status.latestReadyRevisionName,status.url,status.conditions[0].status)'
```

Success indicator:
- `latestReadyRevisionName` populated
- condition status is `True`
- URL present.

### Step 7 - Smoke tests (Cloud Run URL + custom domain) [BLOCKING]

```bash
SERVICE_URL="$(gcloud run services describe mangu-publishers --project delta-wonder-488420-i3 --region us-central1 --format='value(status.url)')"
echo "$SERVICE_URL"
curl -i "$SERVICE_URL/api/live"
curl -i "$SERVICE_URL/api/health"
curl -i https://mangu-publishers.com/api/live
curl -i https://mangu-publishers.com/api/health
```

Success indicator:
- all four HTTP calls return `200` or expected healthy JSON payload.

### Step 8 - Post-deploy confidence checks [NON-BLOCKING]

```bash
gcloud builds list --project delta-wonder-488420-i3 --region us-central1 --limit=5 --format='table(id,status,createTime)'
gcloud run revisions list --service mangu-publishers --region us-central1 --project delta-wonder-488420-i3 --limit=3 --format='table(name,status.conditions[0].status,createTime)'
```

Success indicator: latest build and latest revision both healthy.

## Manual Actions in Stripe Dashboard

1. [BLOCKING] Go to **Developers -> Webhooks** in Live mode.
2. [BLOCKING] Add or edit endpoint URL: `https://mangu-publishers.com/api/webhook`.
3. [BLOCKING] Subscribe endpoint to events handled by code:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
   - `payment_intent.payment_failed`
4. [BLOCKING] Reveal signing secret (`whsec_...`) for that endpoint.
5. [BLOCKING] Update GCP Secret Manager value for `stripe-webhook-secret` with the new secret.
6. [BLOCKING] Send a test webhook event from Stripe dashboard and confirm 2xx delivery.
7. [NON-BLOCKING] Review event retries tab and ensure no persistent failures.

## Deploy and Smoke-Test Commands

```bash
cd /Users/city/my_publishing_recovery_20260529
export PROJECT_ID="delta-wonder-488420-i3"
export REGION="us-central1"
export SERVICE_NAME="mangu-publishers"
export PROD_DOMAIN="https://mangu-publishers.com"

PROJECT_ID="$PROJECT_ID" REGION="$REGION" SERVICE_NAME="$SERVICE_NAME" ./scripts/verify-gcp-production.sh

gcloud builds submit --config cloudbuild.yaml --project "$PROJECT_ID" --substitutions=_REGION="$REGION",_SERVICE_NAME="$SERVICE_NAME"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
curl -fsS "$SERVICE_URL/api/live" && echo "Cloud Run live OK"
curl -fsS "$SERVICE_URL/api/health" && echo "Cloud Run health OK"
curl -fsS "$PROD_DOMAIN/api/live" && echo "Domain live OK"
curl -fsS "$PROD_DOMAIN/api/health" && echo "Domain health OK"
```

Success indicator: script and all `curl` commands succeed without error.

## Go/No-Go Checklist

- [ ] [BLOCKING] GCloud auth is valid and project/region set correctly.
- [ ] [BLOCKING] Supabase linked to `tkzvikozrcynhwsqtkqp`.
- [ ] [BLOCKING] Stripe webhook endpoint exists at `/api/webhook` on prod domain.
- [ ] [BLOCKING] `stripe-webhook-secret` in GCP matches current Stripe endpoint secret.
- [ ] [BLOCKING] Cloud Build deployment is successful (`SUCCESS`).
- [ ] [BLOCKING] `/api/live` and `/api/health` pass via Cloud Run URL and custom domain.
- [ ] [BLOCKING] No critical errors in Cloud Run logs after smoke test.
- [ ] [NON-BLOCKING] Optional secrets (`resend-api-key`, `openai-api-key`) present if features needed.
- [ ] [NON-BLOCKING] Evidence (build ID, revision, timestamps) captured in handoff template.

Go decision: all BLOCKING items checked.
No-Go decision: any BLOCKING item unchecked.

## Common Failure Messages and What To Do

- `ERROR: gcloud credentials are not valid for non-interactive use.`
  - Run `gcloud auth login` and `gcloud auth application-default login`, then retry.
- `MISSING stripe-webhook-secret` (or other required secret)
  - Create/update secret in Secret Manager, then rerun `./scripts/verify-gcp-production.sh`.
- `Webhook signature verification failed`
  - Stripe signing secret and GCP `stripe-webhook-secret` do not match; rotate/update secret and redeploy.
- `Missing signature` from `/api/webhook`
  - Request did not include Stripe signature header; test with Stripe delivery, not raw curl.
- Cloud Build step fails on lint/type-check
  - Fix code issues locally (`npm run lint`, `npm run type-check`) before re-deploy.
- `/api/health` or `/api/live` returns non-2xx
  - Check Cloud Run logs, confirm service revision is ready, verify required secrets and env vars are present.
- Stripe shows webhook delivery retries (4xx/5xx)
  - Open failed event payload in Stripe, compare timestamp with Cloud Run logs, fix root cause then replay event.

## Final Handoff Template to Fill In

Copy this and complete before handoff:

```text
Production Recovery Handoff - Mangu Publishers

Date/Time (UTC):
Operator:

Project:
- GCP Project ID: delta-wonder-488420-i3
- Cloud Run Service: mangu-publishers
- Region: us-central1
- Supabase Ref: tkzvikozrcynhwsqtkqp
- Domain: https://mangu-publishers.com

Deployment Evidence:
- Cloud Build ID:
- Cloud Build Result (SUCCESS/FAIL):
- Latest Ready Revision:
- Cloud Run URL:

Smoke Test Results:
- Cloud Run /api/live:
- Cloud Run /api/health:
- Domain /api/live:
- Domain /api/health:

Stripe Webhook:
- Endpoint URL: https://mangu-publishers.com/api/webhook
- Required events configured: yes/no
- Last test delivery ID:
- Last delivery result:

Known Risks / Follow-ups:
1.
2.

Go/No-Go Decision:
- Decision:
- Approved by:
```

## If You Only Do 5 Things Now

1. [BLOCKING] Authenticate and set GCP project/region correctly.
2. [BLOCKING] Run `./scripts/verify-gcp-production.sh` and fix any missing required secrets.
3. [BLOCKING] Verify Stripe webhook endpoint is `https://mangu-publishers.com/api/webhook` and secret is current.
4. [BLOCKING] Deploy with `gcloud builds submit --config cloudbuild.yaml ...`.
5. [BLOCKING] Prove `/api/live` and `/api/health` work on both Cloud Run URL and production domain.
