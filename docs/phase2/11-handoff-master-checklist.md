# 11. Handoff Master Checklist

Use this checklist to determine if Phase 2 is handoff-ready. A handoff is complete only when every required item is marked done and evidence is linked in `14-evidence-and-signoff-log.md`.

## Handoff Gate Rules

- No critical or unknown risk may remain open.
- Every milestone (`M0`-`M7b`) must have validation evidence.
- Every P0 test (`P0-1`-`P0-9`) must pass with traceable artifacts.
- GO/NO-GO must be signed by required approvers.
- Any blank named owner field in `12`, any **PENDING** cells in Sections B–F below, or literal italic worksheet placeholders that were not replaced with real names in `12` Role Directory is automatic `NO-GO`.

## Section A: Documentation Completeness

| Check | Required | Evidence Link |
|---|---|---|
| `README.md` routes plan/execute/handoff/operate paths | Yes | |
| `05-milestone-implementation-plan.md` has command and rollback blocks | Yes | |
| `06-acceptance-and-test-protocol.md` has executable P0 templates | Yes | |
| `07-operational-runbook.md` has escalation and SLAs | Yes | |
| `08-risk-and-troubleshooting.md` has active risk owner mapping | Yes | |
| `10-agent-execution-playbook.md` has checkpoint protocol | Yes | |

## Section B: Milestone Completion

| Milestone | Owner | Status | Evidence Link |
|---|---|---|---|
| M0 Pre-Flight Setup | PENDING *(Primary accountable — align with `12` milestone RACI)* | TODO | PENDING *(URL)* |
| M1 Local Security Hardening | PENDING *(Primary accountable)* | TODO | PENDING *(URL)* |
| M2 Build Pipeline Scripts | PENDING *(Primary accountable)* | TODO | PENDING *(URL)* |
| M3 Runtime Container | PENDING *(Primary accountable)* | TODO | PENDING *(URL)* |
| M4 GCP Foundation | PENDING *(Primary accountable)* | TODO | PENDING *(URL)* |
| M5 Cloud Build End-to-End | PENDING *(Primary accountable)* | TODO | PENDING *(URL)* |
| M6 Firebase Hosting + Domain | PENDING *(Primary accountable)* | TODO | PENDING *(URL)* |
| M7a Pre-Cutover Guardrails | PENDING *(Primary accountable)* | TODO | PENDING *(URL)* |
| M7b Post-Cutover Stabilization | PENDING *(Primary accountable)* | TODO | PENDING *(URL)* |

## Section C: P0 Acceptance Readiness

| P0 ID | Pass/Fail | Owner | Evidence Link |
|---|---|---|---|
| P0-1 Secret Leakage | PENDING | PENDING *(Owner — align with `12` P0 RACI)* | PENDING *(URL)* |
| P0-2 Build Before Docker | PENDING | PENDING | PENDING *(URL)* |
| P0-3 Deep-Link Routing | PENDING | PENDING | PENDING *(URL)* |
| P0-4 Security Headers | PENDING | PENDING | PENDING *(URL)* |
| P0-5 Health Checks | PENDING | PENDING | PENDING *(URL)* |
| P0-6 Cloud Run Config | PENDING | PENDING | PENDING *(URL)* |
| P0-7 CI Security Gates | PENDING | PENDING | PENDING *(URL)* |
| P0-8 Content Rebuild Automation | PENDING | PENDING | PENDING *(URL)* |
| P0-9 Observability + Cost Controls | PENDING | PENDING | PENDING *(URL)* |

## Section D: Cutover Readiness

| Check | Required | Status | Evidence Link |
|---|---|---|---|
| T-24h checklist complete | Yes | PENDING | PENDING *(URL)* |
| T-2h checklist complete | Yes | PENDING | PENDING *(URL)* |
| T-30m checklist complete | Yes | PENDING | PENDING *(URL)* |
| Rollback owner on-call and reachable | Yes | PENDING | PENDING *(URL)* |
| Rollback prerecord fields complete per `07-operational-runbook.md` | Yes | PENDING | PENDING *(URL)* |
| Communications templates pre-filled | Yes | PENDING | PENDING *(URL)* |

## Section E: Ownership And Escalation

| Check | Required | Status | Evidence Link |
|---|---|---|---|
| RACI populated in `12-ownership-raci.md` | Yes | PENDING | PENDING *(URL)* |
| Incident severity matrix acknowledged | Yes | PENDING | PENDING *(URL)* |
| Escalation contacts verified and tested | Yes | PENDING | PENDING *(URL)* |

## Section F: Formal Signoff

| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Engineering Lead | PENDING *(must match `12` Primary)* | GO / NO-GO | PENDING *(UTC)* | |
| Platform Lead | PENDING *(must match `12` Primary)* | GO / NO-GO | PENDING *(UTC)* | |
| Security Lead | PENDING *(must match `12` Primary)* | GO / NO-GO | PENDING *(UTC)* | |
| Product/Business Owner | PENDING *(must match `12` Primary)* | GO / NO-GO | PENDING *(UTC)* | |

## Final Decision

- **GO** only if all required rows are complete and all approvers sign GO.
- **NO-GO** if any required item is incomplete, any named owner field is blank in `12`, any **PENDING** cells remain in Sections B–F above, any approver blocks release, or worksheet placeholders in `12` were not replaced with real names.
