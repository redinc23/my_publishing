# 13. Cutover Day Runbook

This runbook is a time-sequenced launch guide. Use with `11-handoff-master-checklist.md`, `12-ownership-raci.md`, and `14-evidence-and-signoff-log.md`.

Use canonical variables from `05-milestone-implementation-plan.md`.

## Preconditions

- All M0-M7a milestone gates are complete.
- All P0 tests pass and evidence is recorded.
- GO/NO-GO participants are available on launch window.
- Rollback prerecord fields from `07-operational-runbook.md` are complete.

## T-24 Hours

### Actions

1. Confirm release scope and commit SHA.
2. Confirm production change freeze boundaries.
3. Re-run critical P0 checks (`P0-1`, `P0-3`, `P0-5`, `P0-6`), including `/api/health` baseline verification.
4. Verify rollback target revision exists and is healthy (`/api/health` returns HTTP 200).
5. Pre-stage communication messages.
6. Confirm `M7a` evidence is complete in `14-evidence-and-signoff-log.md`.

### Evidence

- Build and service links
- P0 output snippets
- rollback revision ID
- named rollback owner and backup

## T-2 Hours

### Actions

1. Confirm on-call and escalation roster.
2. Validate Cloud Monitoring dashboards and alert routes.
3. Verify DNS and certificate status.
4. Reconfirm deploy flags and target environment settings.
5. Freeze non-launch changes.
6. Confirm rollback command operator assignment.

### Evidence

- alert policy screenshots/links
- DNS/cert status output
- final deploy configuration snapshot

## T-30 Minutes

### Actions

1. Run final smoke checks against candidate revision.
2. Validate `/api/health` and deep-link behavior.
3. Confirm communication channel is active.
4. Record final GO/NO-GO votes.

### Go/No-Go Rule

- Any unresolved P0 failure => NO-GO.
- Any unresolved Sev1 risk => NO-GO.
- Any blank named owner field in `12`, any literal **PENDING** cells in `11`/`14` that should contain names or evidence URLs, or italic worksheet placeholders still unreplaced in `12` => NO-GO.

## Go-Live Window

### Actions

1. Execute cutover/deploy step.
2. Verify production domain over HTTPS.
3. Verify route and asset behavior.
4. Watch logs, error rate, and latency in real time.

### Immediate Abort Triggers

- `3` consecutive `/api/health` failures at `1-minute` intervals on `${CUSTOM_DOMAIN}`
- **5xx rate greater than 5%** over **5** consecutive minutes
- **p99 latency greater than 2000 ms** over **5** consecutive minutes
- **Memory utilization greater than 85%** of **512Mi** over **5** consecutive minutes
- **Concurrent instances ≥ 8** (80% of `maxScale=10`) sustained **10** minutes
- Security control regression or suspected secret exposure
- Any failed **P0** recheck executed during the launch window (`06` protocol)

If triggered, execute deterministic rollback sequence from `07-operational-runbook.md` and log all rollback evidence in `14-evidence-and-signoff-log.md`.

## +30 Minutes

### Actions

1. Re-run high-priority smoke checks.
2. Confirm alert noise is normal.
3. Confirm no secret leakage indicators.
4. Confirm post-cutover `M7b` stabilization checklist started.

## +24 Hours

### Actions

1. Review overnight incidents/alerts.
2. Confirm content webhook update path (Supabase or generic CMS webhook).
3. Publish cutover outcome report and residual risks.

### Webhook Latency SLO (P0-8)

- publish event -> build start: `<= 10 minutes`
- publish event -> updated route visible: `<= 20 minutes`
- If either threshold is missed twice in a 24-hour window, open incident and mark `P0-8` as failed until corrected.

## Communication Templates

### Launch Start

`Cutover start: REQUIRED_TIME_UTC. Scope: REQUIRED_RELEASE_SHA. Rollback owner: REQUIRED_OWNER_NAME.`

### Launch Success

`Go-live complete: REQUIRED_TIME_UTC. Health/status: green. Monitoring active.`

### Incident During Cutover

`Incident detected: REQUIRED_SUMMARY. Severity: REQUIRED_SEVERITY. Mitigation in progress. Next update in REQUIRED_MINUTES.`

### Rollback Executed

`Rollback executed to revision REQUIRED_REVISION_ID. Service stabilizing checks in progress (07 validation V1-V4 running).`
