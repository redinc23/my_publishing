# 07. Operational Runbook

Source baseline: `docs/phase2/_sources/litstream_phase2_sec06.md`

Use this runbook with `12-ownership-raci.md` for ownership and `14-evidence-and-signoff-log.md` for incident evidence records.

Use canonical variables from `05-milestone-implementation-plan.md` when running templates.

## Operator Quick Paths

- Build failing in CI: go to "Cloud Build Verification" then "Failure Triage"
- Service degraded: go to "Cloud Run Health Checks" then "Rollback Procedure"
- Content not updating: go to "Webhook and Rebuild Diagnostics" (verify Supabase/webhook path and Next.js ISR revalidation)
- Cost spike: go to "Cost and Scale Triage"

## Incident Severity Matrix And SLAs

| Severity | Definition | Initial Response SLA | Update Cadence | Typical Owner |
|---|---|---|---|---|
| Sev1 | Production unavailable or security compromise risk | 10 min | 15 min | On-call Operator + Platform + Security |
| Sev2 | Major degradation with user impact | 20 min | 30 min | On-call Operator + Platform |
| Sev3 | Partial degradation or internal blocking issue | 60 min | 2 hr | Platform Engineer |

## Escalation Ladder

1. On-call Operator acknowledges and classifies severity.
2. Page Platform Engineer for Sev1/Sev2 immediately.
3. Page Security Lead immediately for suspected secret/security event.
4. Notify Engineering Lead if not stabilized within SLA window.
5. Notify Product/Business Owner for Sev1 or rollback decisions.

## Cloud Build Verification

### Standard Procedure

1. Identify latest build tied to target commit.
2. Confirm step progression and gate behavior.
3. Verify secret-consuming step scope is correct.
4. Verify deploy step completed and revision created.

### Failure Triage

- Secret audit failure -> treat as security incident until disproven.
- Vulnerability gate failure -> patch base image/dependencies and rerun.
- Deploy step rejection -> verify Cloud Run flags and IAM.

### CI Gate Failure Decision Rule

Failed secret audit, vulnerability gate, integrity gate, or post-deploy health gate **blocks** release.

Allowed outcomes:

1. **Fix and rerun** — record remediation commit or image digest; attach passing build evidence.
2. **Documented exception** — only **Security Lead + Engineering Lead** approve a time-bounded exception (CVE ID, severity, exploitability, compensating control, expiry, owner).
3. **NO-GO** — no gate bypass during launch window without approved exception in `14-evidence-and-signoff-log.md`.

### CI Triage Commands (Template)

```bash
set -euo pipefail
gcloud builds list --project="${PROJECT_ID}" --region="${REGION}" --limit=10
_build="${BUILD_ID:-$(gcloud builds list --project="${PROJECT_ID}" --region="${REGION}" --limit=1 --format='value(id)')}"
gcloud builds log "${_build}" --project="${PROJECT_ID}" --region="${REGION}"
rg -n "audit-secrets|audit:secrets|vulnerability|deploy-run|CLOUD_LOGGING_ONLY" cloudbuild.yaml
```

## Cloud Run Health Checks

### Baseline Checks

- Custom domain `https://${CUSTOM_DOMAIN}/` returns HTTP 200 (production entrypoint).
- `/api/health` returns HTTP 200 on the same hostname customers use.
- Current revision is serving expected traffic.
- Memory, latency, and instance metrics are stable.

### Configuration Checks

- Runtime memory remains `512Mi`.
- Runtime port remains `3000`.
- Execution environment remains gen2.

### Runtime Verification Commands (Template)

```bash
set -euo pipefail
gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format=yaml
curl -fsS -i "https://${CUSTOM_DOMAIN}/api/health"
```

## Rollback Procedure

### Prerecorded Requirements (Must Exist Before Cutover)

Record these in `14-evidence-and-signoff-log.md` prior to launch:

1. `KNOWN_GOOD_REVISION` ID and verification timestamp.
2. Last successful build ID for the known-good revision.
3. Rollback operator name and backup operator name.
4. Validation routes:
   - `https://${CUSTOM_DOMAIN}/api/health`
   - `https://${CUSTOM_DOMAIN}/`
   - `https://${CUSTOM_DOMAIN}/books/${SAMPLE_BOOK_SLUG}`
   - `https://${CUSTOM_DOMAIN}/authors/${SAMPLE_AUTHOR_SLUG}`
5. Current release revision ID and start timestamp.

If any prerecorded field is missing, cutover is automatically `NO-GO`.

### Trigger Thresholds (Canonical)

Aligned with Cloud Monitoring alert policies — see `change-log-and-decisions.md` Decision 7.

Trigger rollback when **any** condition holds:

- **5xx error rate** exceeds **5%** over a **5-minute** alignment period (consecutive periods = sustained incident).
- **p99 request latency** exceeds **2000 ms** over **5** consecutive minutes.
- **Memory utilization** exceeds **85%** of the **512Mi** limit over **5** consecutive minutes.
- **Instance count** reaches **≥ 8** concurrent instances (80% of `maxScale=10`) **sustained for 10 consecutive minutes**, indicating saturation or runaway traffic.
- **3** consecutive `/api/health` failures at **1-minute** intervals on `${CUSTOM_DOMAIN}`.
- Any failed **P0** recheck during a launch window.
- Any confirmed secret exposure or security-control regression.

### Deterministic Rollback Sequence

1. Declare rollback intent in incident channel with severity and owner.
2. Freeze forward deploy actions and assign one command operator.
3. Shift traffic to `KNOWN_GOOD_REVISION` (100%).
4. Run validation sequence `V1 -> V4` below.
5. If any validation fails, escalate Sev1 and continue incident response.
6. If all validations pass, publish rollback-complete notice.
7. Open post-incident follow-up with root cause and corrective action.

### Validation Sequence (V1 -> V4)

- `V1`: `/api/health` returns HTTP 200.
- `V2`: root route returns HTTP 200.
- `V3`: representative deep-link route returns HTTP 200.
- `V4`: error rate and latency recover **below** canonical alert thresholds for **10** consecutive minutes (document metric snapshots in evidence log).

### Rollback Command Template

```bash
set -euo pipefail
gcloud run revisions list --service="${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}"
gcloud run services update-traffic "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --to-revisions="${KNOWN_GOOD_REVISION}=100"
curl -fsS -i "https://${CUSTOM_DOMAIN}/api/health"                     # V1
curl -fsS -i "https://${CUSTOM_DOMAIN}/"                            # V2
curl -fsS -i "https://${CUSTOM_DOMAIN}/books/${SAMPLE_BOOK_SLUG}"   # V3
```

### Rollback Evidence Requirements

- rollback declaration message link
- exact command transcript used for traffic shift
- V1/V2/V3 command outputs
- metric evidence showing V4 threshold recovery
- final incident status and assigned follow-up owner

## Webhook And Rebuild Diagnostics

1. Confirm webhook delivery and signature validation.
2. Confirm trigger invocation and build creation.
3. Confirm build reached deploy stage.
4. Confirm new revision serves updated content.

If rebuild events do not appear, verify webhook secret alignment and trigger permissions.

### Webhook Diagnostics Commands (Template)

```bash
set -euo pipefail
gcloud builds triggers list --project="${PROJECT_ID}" --region="${REGION}"
gcloud builds list --project="${PROJECT_ID}" --region="${REGION}" --limit=20
```

## Security Operations

### Runtime Secret Rotation (Quarterly Or Incident-Driven)

Rotate the following secrets via Google Secret Manager. Rotate one secret at a time and verify stability before proceeding to the next.

**Secrets managed:**
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`

**Public environment variables (non-secret, but version-locked):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

1. Generate or retrieve the new secret value from the respective provider dashboard (minimal required scope).
2. Add new Secret Manager version for the target secret, e.g.:
   `printf '%s' 'NEW_SECRET' | gcloud secrets versions add supabase-service-role-key --data-file=- --project="${PROJECT_ID}"`
3. Run a **test Cloud Build** (`npm ci` and `npm run build`); confirm the build succeeds, the standalone output (`.next/standalone/`) is produced, and downstream deploy steps remain green.
4. Keep old secret version enabled for **24h** overlap; monitor for auth errors.
5. Disable old secret version after stable window; document rotation evidence in `14-evidence-and-signoff-log.md`.
6. After **7 days**, verify old secret version cannot authenticate (confirm disable/revocation).

Repeat for `STRIPE_SECRET_KEY` and `RESEND_API_KEY`.

### Secret Exposure Response (Suspected Leak)

Treat as **Sev1** until Security Lead downgrades.

1. Stop forward deployments and freeze scope changes.
2. Page Security Lead + Platform Lead (`12-ownership-raci.md`).
3. Rotate affected secret immediately in Google Secret Manager; revoke suspected credential at the provider.
4. Re-scan `.next/standalone/`, image layers, Cloud Run env, Build logs (Cloud Logging only), git history for secret strings.
5. Do **not** resume release until **P0-1** passes post-rotation.

### Hygiene

- Verify logs do not contain credential material (sample queries in `06` P0-1).
- Audit IAM bindings quarterly (`gcloud projects get-iam-policy "${PROJECT_ID}"`).

## Cost And Scale Triage

```bash
set -euo pipefail
gcloud billing budgets list --billing-account="${BILLING_ACCOUNT_ID}"
gcloud monitoring metrics-descriptors list --project="${PROJECT_ID}" --filter='metric.type=run.googleapis.com/request_count' --limit=5
gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(spec.template.metadata.annotations.autoscaling.knative.dev/maxScale)'
```

- Confirm billing alerts fired vs sustained spend (see `06` P0-9).
- If instances peg near `maxScale`, investigate traffic spikes, cache hit rate, and upstream abuse.
- Run Artifact Registry / tag pruning per ops script policy after major releases.

## Incident Documentation Standard

Each production incident should capture:

- timeline,
- impact scope,
- root cause,
- immediate mitigation,
- permanent prevention actions,
- owners and due dates.

## Communication Templates

### Incident Open

`[SEV1|SEV2|SEV3] Incident opened at REQUIRED_TIME_UTC. Impact: REQUIRED_SUMMARY. Owner: REQUIRED_OWNER_NAME. Next update in REQUIRED_MINUTES.`

### Incident Update

`[SEV1|SEV2|SEV3] Update at REQUIRED_TIME_UTC. Current status: REQUIRED_STATUS. Mitigation: REQUIRED_ACTION. ETA: REQUIRED_ETA.`

### Incident Resolved

`[SEV1|SEV2|SEV3] Resolved at REQUIRED_TIME_UTC. Root cause: REQUIRED_SUMMARY. Follow-up: REQUIRED_TICKET_OR_LINK.`

### Rollback Notice

`Rollback executed to REQUIRED_REVISION_ID at REQUIRED_TIME_UTC. Validation checks running.`
