# ADR-001: Canonical Production Platform and DNS Authority

| Field | Value |
| --- | --- |
| **Status** | **PROPOSED** — decision and signature due in Phase 6 (P0-003) |
| **Created** | 2026-07-18 (Phase 1 / P0-019) |
| **Deciders** | Platform, Release Manager, Engineering |
| **Hard gate** | G9 (ADR signed + monitors on canonical origin) |

## Context

Two production surfaces exist in project history:

- **Cloud Run** — declared canonical in `docs/CANONICAL_PRODUCTION.md` (GCP project `delta-wonder-488420-i3`, region `us-central1`, service `mangu-publishers`; deploy path `cloudbuild.yaml` via `scripts/gcloud-build-submit.sh`). VERIFIED as a repo claim.
- **Vercel** — `www.mangu-publishers.com` was observed served by Vercel on 2026-07-09 (`server: Vercel`), with apex `mangu-publishers.com` showing a TLS SAN mismatch and readiness `degraded` / Stripe warn (REPORTED, `docs/OPERATOR_QA_LOG.md` — stale, re-verify per CCR-017).

Exactly one platform must own the canonical origin for `mangu-publishers.com` / `www.mangu-publishers.com`. Monitors (P0-007), the Stripe webhook (G8), DNS/TLS (Phase 15), and the rollback target (G11) all derive from this decision. A split-brain deployment invalidates exact-SHA evidence (CCR-005).

## Options

| Option | Description | Consequence sketch |
| --- | --- | --- |
| **A — Cloud Run canonical** | Route apex + www to Cloud Run; Vercel retired or preview-only | Matches `docs/CANONICAL_PRODUCTION.md`, `cloudbuild.yaml`, Appendix G scripts; requires GCP secret promotion (Phase 11) and DNS cutover (Phase 15) |
| **B — Vercel canonical** | Keep Vercel serving; retire Cloud Run | Conflicts with existing runbooks/scripts; full rewrite of deploy + secret path |
| **C — Documented split** | Different surfaces per host | Rejected unless explicitly justified — violates single-authority and exact-SHA principles for launch |

## Decision

**PENDING — Phase 6.** To be recorded here with dashboard object IDs, revision IDs, and DNS/TLS evidence, then status → ACCEPTED with signatures.

## Consequences (to complete at decision time)

- Deploy runbook and scripts (P0-020) parameterized to the chosen platform.
- Health-check and Lighthouse monitors retargeted (P0-007).
- Conflicting deployment docs marked superseded and linked here.
- Rollback target + command recorded (CCR-012, G11).

## Signature Block (Phase 6)

| Role | Name | Decision | UTC |
| --- | --- | --- | --- |
| Platform | ____ | ____ | ____ |
| Release Manager | ____ | ____ | ____ |
| Engineering | ____ | ____ | ____ |
