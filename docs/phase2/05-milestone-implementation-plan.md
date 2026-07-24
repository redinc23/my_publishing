# 05. Milestone Implementation Plan

Source baseline: `docs/phase2/_sources/litstream_phase2_sec04.md`

This file is the command-level execution plan for milestones `M0` through `M7b`. Record all output links in `14-evidence-and-signoff-log.md`.

## Canonical Execution Variables (Use In All Command Templates)

Fill **[`docs/phase2/_intake/environment.example.sh`](_intake/environment.example.sh)** → copy to **`docs/phase2/_intake/environment.local.sh`** (gitignored) and replace every `REPLACE_ME_*` value. See **[`docs/phase2/_intake/README.md`](_intake/README.md)**.

From **repository root**, the block below loads that file when present (via `git rev-parse`), then applies safe defaults.

```bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
_INTAKE_ENV="${REPO_ROOT}/docs/phase2/_intake/environment.local.sh"
if [[ -f "${_INTAKE_ENV}" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${_INTAKE_ENV}"
  set +a
fi

export REGION="${REGION:-us-central1}"
export SERVICE_NAME="${SERVICE_NAME:-mangu-publishers}"
export AR_REPO="${AR_REPO:-web-images}"

export PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID in docs/phase2/_intake/environment.local.sh (copy from environment.example.sh)}"
export CUSTOM_DOMAIN="${CUSTOM_DOMAIN:?Set CUSTOM_DOMAIN in docs/phase2/_intake/environment.local.sh}"
export BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID:?Set BILLING_ACCOUNT_ID in docs/phase2/_intake/environment.local.sh}"
export RELEASE_SHA="$(git rev-parse --short HEAD)"
export KNOWN_GOOD_REVISION="${KNOWN_GOOD_REVISION:?Set KNOWN_GOOD_REVISION in docs/phase2/_intake/environment.local.sh}"
export SAMPLE_BOOK_SLUG="${SAMPLE_BOOK_SLUG:?Set SAMPLE_BOOK_SLUG in docs/phase2/_intake/environment.local.sh}"
export SAMPLE_AUTHOR_SLUG="${SAMPLE_AUTHOR_SLUG:?Set SAMPLE_AUTHOR_SLUG in docs/phase2/_intake/environment.local.sh}"
export SAMPLE_CATEGORY_SLUG="${SAMPLE_CATEGORY_SLUG:?Set SAMPLE_CATEGORY_SLUG in docs/phase2/_intake/environment.local.sh}"

# Next.js standalone runtime port (Cloud Run deploy uses --port 3000)
export PORT="${PORT:-3000}"

# Optional — set in environment.local.sh when running selected P0 probes / CI examples.
export BUILD_ID="${BUILD_ID:-}"
export SAMPLE_HASHED_JS_BASENAME="${SAMPLE_HASHED_JS_BASENAME:-}"
export P0_8_SAMPLE_ROUTE="${P0_8_SAMPLE_ROUTE:-}"
export SENTRY_PROJECT_SLUG="${SENTRY_PROJECT_SLUG:-}"
export SENTRY_EVIDENCE_URL="${SENTRY_EVIDENCE_URL:-}"

# Optional runtime secrets — managed in Secret Manager, never committed.
# export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
# export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"
# export RESEND_API_KEY="${RESEND_API_KEY:-}"
```

## Global Execution Template (Use For Every Milestone)

### Prerequisites

- Named owner and approver assigned in `12-ownership-raci.md`.
- Current milestone dependencies complete.
- Rollback owner available and reachable.
- Variable block above satisfied (`docs/phase2/_intake/environment.local.sh` populated, or exports set in shell).

### Command Block Template

```bash
set -euo pipefail
git status -sb
# run milestone-specific commands from this document
# capture command output and links in 14-evidence-and-signoff-log.md
```

### Evidence Required

- command output snapshot
- changed file list
- service/build links (if cloud step)
- pass/fail decision with owner name

### Rollback Trigger

- Any P0 regression, unresolved Sev1 issue, or failed validation gate.

## Canonical 14-Step Pipeline Order (M5)

Use this table as the source of truth for sequencing checks in `P0-2` and `P0-7` (`06-acceptance-and-test-protocol.md`).

| Step | Stage              | Required Outcome                                                          |
| ---- | ------------------ | ------------------------------------------------------------------------- |
| 1    | setup              | checkout source                                                           |
| 2    | setup              | install dependencies (`npm ci`)                                           |
| 3    | setup              | verify lockfile integrity                                                 |
| 4    | build              | lint/typecheck (`npm run lint` or `npm run type-check` if available)      |
| 5    | build              | Next.js build (`npm run build`) producing `.next/standalone/`             |
| 6    | build              | static export/asset integrity check (`.next/standalone/` exists)          |
| 7    | security gate      | secret audit gate — scan `.next/`, source for token leakage (fail-closed) |
| 8    | security gate      | dependency audit (`npm audit` or equivalent)                              |
| 9    | container          | docker build runtime image (multi-stage Node build)                       |
| 10   | artifact/deploy    | push image with SHA tag to Artifact Registry                              |
| 11   | security gate      | vulnerability scan on pushed image (HIGH/CRITICAL fail-closed)            |
| 12   | artifact/deploy    | deploy Cloud Run (`--port 3000 --memory=512Mi --no-default-url`)          |
| 13   | post-deploy verify | smoke checks (`/api/health`, deep link, headers)                          |
| 14   | post-deploy verify | traffic shift / domain verification                                       |

Sequencing rule: vulnerability scanning runs against an image that exists in Artifact Registry (after push), not before the image is built and pushed.

## M0 Pre-Flight Setup

### Objective

Confirm access, tooling, repository state, and baseline controls.

### Commands

```bash
set -euo pipefail
node -v && npm -v
next -v
docker --version
gcloud --version
firebase --version
git status -sb
```

### Expected Output

- all CLIs available
- repository in known state

### Evidence

- tool version output
- baseline repo status snapshot

## M1 Local Security Hardening

### Objective

Eliminate secret exposure paths before infra automation.

### Commands

```bash
set -euo pipefail

# must be zero: deprecated VITE_* prefix variable names outside docs and generated source snapshots
rg -n --glob '!docs/**' --glob '!**/_sources/**' 'VITE_(SANITY|SUPABASE_SERVICE_ROLE|STRIPE_SECRET|RESEND)_' .

# must be zero: runtime secrets must not appear in client-side code
rg -n --glob 'app/**' --glob 'components/**' --glob 'lib/**' --glob 'pages/**' 'SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY' .

# verify next.config.js has output: 'standalone' for Node.js server runtime
rg -n "output:\\s*'standalone'" next.config.js next.config.ts next.config.mjs

# verify secret-audit command exists and is wired to CI gate
npm run | rg 'audit:secrets'
rg -n 'audit:secrets|audit-secrets' cloudbuild.yaml package.json

# token value handling guidance (never log full token):
# evidence may show only prefix/suffix format, example: abc123...wxyz
```

### Expected Output

- no results for deprecated VITE\_\* prefixed variable names
- no results for runtime secrets in client-side code paths
- `output: 'standalone'` present in Next.js config
- audit script exists and is referenced by CI

### Rollback/Mitigation

- rotate token if exposed
- clean git history if `.env.local` leaked

## M2 Build Pipeline Scripts

### Objective

Generate deterministic Next.js standalone output.

### Commands

```bash
set -euo pipefail
npm ci
npm run build
```

### Expected Output

- successful build chain
- `.next/standalone/` directory produced with `server.js` present

### Evidence

- build logs
- listing of generated artifacts
- smoke route check output

## M3 Runtime Container

### Objective

Package `.next/standalone/` as hardened Node.js runtime image.

### Commands

```bash
set -euo pipefail
docker build -t mangu-publishers:local .
docker run --rm -d --name mangu-publishers-local -p 3000:3000 mangu-publishers:local
curl -fsS -i http://localhost:3000/api/health
docker inspect mangu-publishers:local | rg '"User"|3000'
docker rm -f mangu-publishers-local
```

### Expected Output

- image builds successfully with `.next/standalone/` present
- `/api/health` returns 200
- runtime user is non-root and port 3000 configured

### Rollback Trigger

- image requires runtime build steps or fails hardening checks

## M4 GCP Foundation

### Objective

Provision registry, secrets, IAM, and trigger prerequisites.

### Commands (Provision Then Verify)

Run once per environment; use project defaults consistent with `cloudbuild.yaml` substitutions.

```bash
set -euo pipefail

gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  run.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudbilling.googleapis.com \
  ondemandscanning.googleapis.com \
  iamcredentials.googleapis.com \
  firebase.googleapis.com \
  developerconnect.googleapis.com \
  --project="${PROJECT_ID}"

gcloud artifacts repositories describe "${AR_REPO}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  || gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}"

# Secret Manager: create versions for runtime secrets (run locally with redacted audit trail).
# printf '%s' "${SUPABASE_SERVICE_ROLE_KEY:?}" | gcloud secrets versions add supabase-service-role-key --data-file=- --project="${PROJECT_ID}"
# printf '%s' "${STRIPE_SECRET_KEY:?}" | gcloud secrets versions add stripe-secret-key --data-file=- --project="${PROJECT_ID}"
# printf '%s' "${RESEND_API_KEY:?}" | gcloud secrets versions add resend-api-key --data-file=- --project="${PROJECT_ID}"

# Cloud Build SA IAM: grant roles per org standard (Artifact Registry Writer, Run Admin, Secret Accessor, etc.).
# Use IAM Policy Troubleshooter if builds fail with permission errors.

gcloud builds triggers list --region="${REGION}" --project="${PROJECT_ID}"
```

### Verification Commands

```bash
set -euo pipefail
gcloud artifacts repositories list --location="${REGION}" --project="${PROJECT_ID}"
gcloud secrets list --project="${PROJECT_ID}"
gcloud projects get-iam-policy "${PROJECT_ID}" --format=json
gcloud builds triggers list --region="${REGION}" --project="${PROJECT_ID}"
```

### Expected Output

- required resources and bindings exist
- trigger discoverable and enabled

### Evidence

- gcloud list/describe outputs per resource

## M5 Cloud Build End-To-End

### Objective

Deploy from `main` through gated 14-step pipeline.

### Commands (Template)

```bash
set -euo pipefail
gcloud builds submit --project="${PROJECT_ID}" --region="${REGION}" --config=cloudbuild.yaml --substitutions=SHORT_SHA="${RELEASE_SHA}"
gcloud builds list --project="${PROJECT_ID}" --region="${REGION}" --limit=5
gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(spec.template.spec.containers[0].resources.limits.memory,spec.template.metadata.annotations.run.googleapis.com/execution-environment,status.url)'
curl -fsS -i "https://${CUSTOM_DOMAIN}/api/health"
```

### Expected Output

- build completes all 14 steps in canonical order
- deploy step uses `--port 3000 --memory=512Mi` and `--no-default-url`
- service healthy

### Rollback Trigger

- secret audit fail
- vulnerability gate fail
- post-deploy health check fail

## M6 Firebase Hosting And Domain

### Objective

Enable public custom-domain HTTPS entrypoint.

### Commands (Template)

```bash
set -euo pipefail
firebase deploy --only hosting
curl -fsS -I "https://${CUSTOM_DOMAIN}"
curl -fsS -I "https://${CUSTOM_DOMAIN}/api/health"
curl -fsS -I "https://${CUSTOM_DOMAIN}/books/${SAMPLE_BOOK_SLUG}"
```

### Expected Output

- TLS active
- route and deep-link responses valid
- rewrite behavior correct

### Evidence

- domain header output
- deep-link checks

## M7a Pre-Cutover Guardrails

### Objective

Confirm observability and cost controls are fully configured before launch.

### Commands (Template)

```bash
set -euo pipefail
gcloud monitoring uptime list --project="${PROJECT_ID}"
gcloud alpha monitoring policies list --project="${PROJECT_ID}"
gcloud billing budgets list --billing-account="${BILLING_ACCOUNT_ID}"
```

### Expected Output

- uptime checks present for production domain
- alert policies enabled and notification channels attached
- budget alerts configured at required thresholds

### Evidence

- uptime check list output
- alert policy IDs and notification channel references
- budget IDs and threshold settings

## M7b Post-Cutover Stabilization

### Objective

Validate day-2 operational behavior after live traffic cutover.

### Commands (Template)

```bash
set -euo pipefail
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="'"${SERVICE_NAME}"'" AND severity>=ERROR' --project="${PROJECT_ID}" --limit=50
gcloud builds list --project="${PROJECT_ID}" --region="${REGION}" --limit=10
curl -fsS -i "https://${CUSTOM_DOMAIN}/api/health"
```

### Expected Output

- no untriaged error spikes
- content rebuild pipeline events observed
- post-cutover health checks stable

### Evidence

- error-log query output
- build history showing webhook-triggered jobs
- health check output during stabilization window

## Milestone Gates

- Gate A: `M0` + `M1` + `M2` complete before containerization promotion.
- Gate B: `M3` + `M4` complete before CI/CD deployment.
- Gate C: `M5` + all P0 acceptance checks complete before public cutover.
- Gate D: `M6` + `M7a` complete before GO-LIVE decision.
- Gate E: `M7b` complete before steady-state handoff signoff.
