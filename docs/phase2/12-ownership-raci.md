# 12. Ownership RACI

Populate named owners before execution. Do not leave role-only entries for handoff decisions.

`NO-GO` rule: any blank named owner in this document blocks cutover and handoff approval. Italic worksheet hints such as _(worksheet: …)_ are **not** acceptable at signoff — replace them with real names and working contact paths.

Populate **before cutover** using your Drive worksheet (or equivalent roster). Primary cells must contain **real names**, not role titles alone. Keep identifiers aligned with [`docs/phase2/_intake/environment.example.sh`](_intake/environment.example.sh) / `environment.local.sh` where applicable — **never paste secrets** into this table.

| Role                   | Primary                                 | Backup                                 | Contact Path                            |
| ---------------------- | --------------------------------------- | -------------------------------------- | --------------------------------------- |
| Engineering Lead       | _(worksheet: Engineering Lead Primary)_ | _(worksheet: Engineering Lead Backup)_ | _(Slack handle / email / paging alias)_ |
| Platform Engineer      | _(worksheet: Platform Primary)_         | _(worksheet: Platform Backup)_         | _(contact path)_                        |
| Security Lead          | _(worksheet: Security Primary)_         | _(worksheet: Security Backup)_         | _(contact path)_                        |
| On-Call Operator       | _(worksheet: On-call Primary)_          | _(worksheet: On-call Backup)_          | _(PagerDuty / escalation path)_         |
| Product/Business Owner | _(worksheet: Product Primary)_          | _(worksheet: Product Backup)_          | _(contact path)_                        |

## Milestone RACI

Legend: `R` Responsible, `A` Accountable (exactly one per row), `C` Consulted, `I` Informed.

Rule: **each milestone row has exactly one `A`.** No `A/R` combined cells — use separate columns.

| Milestone                      | Eng Lead | Platform | Security | Operator | Product |
| ------------------------------ | -------- | -------- | -------- | -------- | ------- |
| M0 Pre-Flight Setup            | A        | C        | C        | R        | I       |
| M1 Local Security Hardening    | R        | C        | A        | I        | I       |
| M2 Build Pipeline Scripts      | A        | C        | C        | I        | I       |
| M3 Runtime Container           | R        | A        | C        | I        | I       |
| M4 GCP Foundation              | C        | A        | C        | I        | I       |
| M5 Cloud Build End-to-End      | R        | A        | C        | C        | I       |
| M6 Hosting + Domain Cutover    | R        | A        | C        | R        | C       |
| M7a Pre-Cutover Guardrails     | C        | A        | R        | R        | I       |
| M7b Post-Cutover Stabilization | R        | A        | C        | R        | I       |

## P0 Acceptance RACI

Rule: **each P0 row has exactly one `A`.**

| P0 ID                           | Eng Lead | Platform | Security | Operator | Product |
| ------------------------------- | -------- | -------- | -------- | -------- | ------- |
| P0-1 Secret Leakage             | R        | R        | A        | I        | I       |
| P0-2 Build Before Docker        | A        | R        | C        | I        | I       |
| P0-3 Deep-Link Routing          | A        | C        | I        | R        | I       |
| P0-4 Security Headers           | R        | A        | C        | I        | I       |
| P0-5 Health Checks              | I        | A        | I        | R        | I       |
| P0-6 Cloud Run Config           | R        | A        | C        | I        | I       |
| P0-7 CI Security Gates          | R        | A        | C        | I        | I       |
| P0-8 Content Rebuild Automation | R        | A        | C        | R        | I       |
| P0-9 Observability + Cost       | R        | A        | C        | R        | C       |

## Cutover Decision RACI

| Decision                  | Accountable      | Required Consulted           | Informed          |
| ------------------------- | ---------------- | ---------------------------- | ----------------- |
| Start cutover             | Platform Lead    | Eng Lead, Security Lead      | Product           |
| Trigger rollback          | Platform Lead    | On-call Operator, Eng Lead   | Product, Security |
| Declare GO-LIVE stable    | Engineering Lead | Platform, Security, Operator | Product           |
| Declare incident severity | On-call Operator | Platform, Security           | Product, Eng Lead |

All named roles used above must match the Role Directory names exactly.

## Escalation Ownership

| Severity | Initial Owner     | Escalate If Unresolved         | Escalation Time |
| -------- | ----------------- | ------------------------------ | --------------- |
| Sev1     | On-call Operator  | Platform + Security + Eng Lead | 10 min          |
| Sev2     | On-call Operator  | Platform + Eng Lead            | 20 min          |
| Sev3     | Platform Engineer | Eng Lead                       | 60 min          |
