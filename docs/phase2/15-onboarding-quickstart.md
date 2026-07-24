# 15. Onboarding Quickstart (60 Minutes)

Purpose: make a new operator productive and safe within one hour.

## Outcome By Minute 60

- Understand system architecture and critical constraints.
- Locate all execution, acceptance, and incident documents.
- Run safe read-only checks.
- Know escalation and rollback ownership.

## 0-10 Minutes: Orientation

Read in order:

1. `README.md`
2. `01-executive-summary.md`
3. `04-architecture-decisions.md`

Focus on:

- Next.js standalone runtime model
- secret boundaries
- launch gate expectations

## 10-25 Minutes: Execution Path

Read:

1. `05-milestone-implementation-plan.md`
2. `06-acceptance-and-test-protocol.md`

Task:

- Identify current milestone status.
- Confirm `M0` pre-flight and `M7a/M7b` status in `05-milestone-implementation-plan.md`.
- Identify which P0 checks are still pending.

## 25-40 Minutes: Operations And Risk

Read:

1. `07-operational-runbook.md`
2. `08-risk-and-troubleshooting.md`
3. `12-ownership-raci.md`

Task:

- Confirm escalation path for Sev1/Sev2.
- Confirm rollback owner and communication path.

## 40-55 Minutes: Handoff Controls

Read:

1. `11-handoff-master-checklist.md`
2. `13-cutover-day-runbook.md`
3. `14-evidence-and-signoff-log.md`

Task:

- Verify current handoff completion state.
- Verify `12-ownership-raci.md` Role Directory uses real names (not italic worksheet stubs) and `11`/`14` have no blocking **PENDING** cells where evidence is required.
- Confirm GO/NO-GO dependencies.

## 55-60 Minutes: First Safe Actions

- Copy [`docs/phase2/_intake/environment.example.sh`](docs/phase2/_intake/environment.example.sh) to `docs/phase2/_intake/environment.local.sh` (gitignored) and fill non-secret identifiers so templates in `05`/`06`/`07` resolve cleanly.
- Update `14-evidence-and-signoff-log.md` with a timestamped status snapshot.
- Confirm if any critical evidence links are missing.
- If production issue exists, execute the "Operator Quick Paths" from `07`.

## First Day Guardrails

- Do not bypass P0 gates.
- Do not approve cutover without explicit signoff.
- Do not perform irreversible changes without backup/rollback plan.

## Escalate Immediately If

- secrets (Supabase, Stripe, Resend keys) appear in logs/bundles/runtime env,
- `/api/health` checks fail repeatedly,
- deployment flags drift from baseline (port 3000, Next.js standalone build),
- rollback path is unclear.
