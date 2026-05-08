# 06. Acceptance Criteria And Test Protocol

Source baseline: `docs/phase2/_sources/litstream_phase2_sec05.md`

This document is the release gate for Phase 2. Every P0 test requires command evidence and owner signoff recorded in `14-evidence-and-signoff-log.md`.

Use canonical variables from `05-milestone-implementation-plan.md` for all command templates (loads [`docs/phase2/_intake/environment.local.sh`](_intake/environment.local.sh) when present).

Optional probes (`SAMPLE_HASHED_JS_BASENAME`, `P0_8_SAMPLE_ROUTE`, `SENTRY_*`) are documented in [`docs/phase2/_intake/environment.example.sh`](_intake/environment.example.sh).

## P0 Test Inventory

| ID | Requirement | Evidence Type |
|---|---|---|
| P0-1 | No secret leakage | grep scans, runtime env inspection, layer inspection, logging checks |
| P0-2 | Build before Docker | step ordering verification, `.next/standalone/` verification |
| P0-3 | Next.js route serving | route probes and direct URL checks |
| P0-4 | Security header enforcement | response header inspection |
| P0-5 | Health and liveness | `/api/health` success and uptime checks |
| P0-6 | Cloud Run deployment config | service describe checks for memory/scaling/gen2 |
| P0-7 | CI security gates | audit and vulnerability gate behavior |
| P0-8 | Content update automation | webhook publish-to-deploy verification |
| P0-9 | Observability and cost controls | alert and budget configuration checks |

## P0-1 No Secret Leakage

### Required Checks

- Bundle scan for `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` must be empty.
- Base64/high-entropy token pattern checks in assets.
- Cloud Run env inspection shows no plaintext server secret vars.
- Docker layer text inspection shows no secret material.
- Cloud Build log query shows no token exposure.
- `NEXT_PUBLIC_*` variables must not contain secret material.

### Pass Condition

All secret checks return no findings, and evidence contains only redacted token references (`prefix...suffix`, never full token value).

### Command Template

Under `set -euo pipefail`, never append `|| true` to checks that must fail the script when a leak exists.

```bash
set -euo pipefail

# Scan Next.js output directories for server secrets
if rg -q -n 'SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY' .next/standalone/ .next/static/ 2>/dev/null; then
  echo "FAIL: secret strings found under Next.js output"
  exit 1
fi
echo "PASS: no secret strings under Next.js output"

# Scan for NEXT_PUBLIC_* variables that should NOT contain secrets
if rg -q -n 'NEXT_PUBLIC_(SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY)' .next/standalone/ .next/static/ 2>/dev/null; then
  echo "FAIL: secret material found in NEXT_PUBLIC_ variables"
  exit 1
fi
echo "PASS: no secret material in NEXT_PUBLIC_ variables"

# Runtime env must not contain plaintext secret vars (PIPESTATUS-safe)
_RUNYAML="$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format=yaml)"
if printf '%s\n' "${_RUNYAML}" | rg -q 'SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY'; then
  echo "FAIL: secret vars referenced in Cloud Run service YAML (should use --set-secrets)"
  exit 1
fi
echo "PASS: secret vars absent from Cloud Run describe YAML"

# Optional: actual token substring scan — set TOKEN_VALUE from Secret Manager without printing it
# if printf '%s' "${TOKEN_VALUE:-}" | rg -q . && rg -Fqs "${TOKEN_VALUE}" .next/standalone/ cloudbuild.yaml; then exit 1; fi

# Log checks (investigate any hits; empty result expected)
gcloud logging read 'resource.type="build" AND textPayload:"SUPABASE_SERVICE_ROLE_KEY"' --project="${PROJECT_ID}" --limit=20
gcloud logging read 'resource.type="build" AND textPayload:"STRIPE_SECRET_KEY"' --project="${PROJECT_ID}" --limit=20
gcloud logging read 'resource.type="build" AND textPayload:"RESEND_API_KEY"' --project="${PROJECT_ID}" --limit=20
```

### Evidence Required

- command output showing empty matches
- runtime env output excerpt
- log query result link
- redaction proof for any token-related evidence (`xxxxxx...yyyy`)

## P0-2 Build Before Docker

### Required Checks

- `npm ci` and `npm run build` steps precede Docker build in `cloudbuild.yaml`; secret audit precedes container image build.
- Image is pushed to Artifact Registry **before** the vulnerability scan step (canonical steps in `05-milestone-implementation-plan.md`).
- Dockerfile does not perform app build steps if CI produces `.next/standalone/`.
- `.next/standalone/server.js` presence check is enforced before image finalization.

### Pass Condition

Docker image is a pure runtime package of the prebuilt Next.js standalone artifacts.

### Command Template

```bash
set -euo pipefail

rg -n 'npm run build|npm ci|audit|vulnerability|docker push|artifactregistry|deploy|cloud run' cloudbuild.yaml

if [[ ! -f ".next/standalone/server.js" ]]; then
  echo "FAIL: .next/standalone/server.js missing — build must complete before docker image"
  exit 1
fi
echo "PASS: .next/standalone/server.js exists"
```

### Evidence Required

- step-order proof from `cloudbuild.yaml`
- `.next/standalone/server.js` existence proof

## P0-3 Routing And Deep-Link Behavior

### Required Checks

- Root route and representative dynamic routes return HTTP 200.
- Direct navigation to deep link succeeds without app bootstrapping errors.
- Next.js handles routing natively; no SPA fallback configuration is needed.

### Command Template

```bash
set -euo pipefail
curl -fsS -i "https://${CUSTOM_DOMAIN}/"
curl -fsS -i "https://${CUSTOM_DOMAIN}/books/${SAMPLE_BOOK_SLUG}"
curl -fsS -i "https://${CUSTOM_DOMAIN}/authors/${SAMPLE_AUTHOR_SLUG}"
curl -fsS -i "https://${CUSTOM_DOMAIN}/categories/${SAMPLE_CATEGORY_SLUG}"
```

### Evidence Required

- response status lines
- representative route URLs tested

## P0-4 Security Headers

### Required Headers

- Standard Next.js security headers present (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, etc.).
- CSP configured via Next.js `next/headers` or `next.config.js`.

### Command Template

```bash
set -euo pipefail
curl -fsS -I "https://${CUSTOM_DOMAIN}/"
```

### Evidence Required

- header output with security headers

## P0-5 Health Checks

- `/api/health` returns 200 from deployed path.
- Cloud Monitoring uptime check exists and is green.

### Command Template

```bash
set -euo pipefail
curl -fsS -i "https://${CUSTOM_DOMAIN}/api/health"
```

### Evidence Required

- health endpoint response
- uptime dashboard screenshot/link

## P0-6 Cloud Run Configuration

Validate deployed service has:

- gen2 execution environment
- `memory=512Mi`
- expected scaling bounds
- port 3000
- Cloud Run default URL is disabled (`--no-default-url`) and public access is provided through the approved custom domain path.

### Command Template

```bash
set -euo pipefail
gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format=json > /tmp/mangu-publishers-run.json
jq '.spec.template.spec.containers[0].resources.limits.memory' /tmp/mangu-publishers-run.json
jq '.spec.template.metadata.annotations' /tmp/mangu-publishers-run.json
curl -fsS -I "https://${CUSTOM_DOMAIN}/api/health"
```

### Evidence Required

- memory setting proof
- execution environment/scaling proof
- port/ingress proof

## P0-7 CI Security Gates

- Secret audit step blocks if token leak detected.
- Vulnerability scan step blocks HIGH/CRITICAL CVEs per policy and runs **after** the image exists in Artifact Registry (canonical steps in `05-milestone-implementation-plan.md`).

### Command Template

```bash
set -euo pipefail
rg -n 'audit:secrets|audit-secrets|vulnerability|CRITICAL|HIGH' cloudbuild.yaml
gcloud builds list --project="${PROJECT_ID}" --region="${REGION}" --limit=10
```

### Evidence Required

- gate step definitions
- latest build gate outcome

## P0-8 Content Rebuild Automation

- Publishing content triggers rebuild flow via webhook (e.g., Supabase webhook or general CMS webhook).
- New content appears after pipeline completion.
- Trigger latency is within expected operating range:
  - publish event -> build start: `<= 10 minutes`
  - publish event -> content visible at route: `<= 20 minutes`

### Command Template

```bash
set -euo pipefail
PUBLISH_TS_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "publish_timestamp_utc=${PUBLISH_TS_UTC}"
gcloud builds list --project="${PROJECT_ID}" --region="${REGION}" --limit=5
: "${P0_8_SAMPLE_ROUTE:?Set P0_8_SAMPLE_ROUTE in docs/phase2/_intake/environment.local.sh (path after host, e.g. books/your-slug)}"
curl -fsS -i "https://${CUSTOM_DOMAIN}/${P0_8_SAMPLE_ROUTE}"
```

### Evidence Required

- publish timestamp + build start timestamp
- updated route proof
- computed latency in minutes with PASS/FAIL against thresholds

## P0-9 Observability And Cost Controls

- Sentry release tagging operational.
- Alert policies configured and routed.
- Budget thresholds configured and notifying.

### Command Template

```bash
set -euo pipefail

# Sentry: capture release + deep link from UI if CLI is unavailable.
echo "SENTRY_EVIDENCE: release=${RELEASE_SHA:-unknown}, project=${SENTRY_PROJECT_SLUG:-unset}, event_link=${SENTRY_EVIDENCE_URL:-unset}"

gcloud alpha monitoring policies list --project="${PROJECT_ID}"
gcloud monitoring uptime list --project="${PROJECT_ID}"
gcloud billing budgets list --billing-account="${BILLING_ACCOUNT_ID}"
```

### Evidence Required

- sentry event/release link
- alert policy list output including notification channels
- budget list output including threshold percentages

## Test Execution Protocol

1. Run tests in P0 order.
2. Capture evidence per test in release checklist.
3. Block launch on any P0 failure.
4. Resolve failures and rerun full impacted subset.

## Test Result Record Format

For each P0:

- `P0 ID`
- `Owner`
- `Command(s) run`
- `Result: PASS/FAIL`
- `Evidence link`
- `Follow-up (if any)`

## Release Decision

Release approval requires all P0 checks passing and no unresolved critical risk entries in `08-risk-and-troubleshooting.md`.
