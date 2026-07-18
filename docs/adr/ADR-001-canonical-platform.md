# ADR-001: Canonical Production Platform and DNS Authority

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| **Status**    | **RECOMMENDED (Option A — Cloud Run)** — awaiting Phase 6 signatures for ACCEPTED (P0-003/G9) |
| **Created**   | 2026-07-18 (Phase 1 / P0-019)                                                                 |
| **Updated**   | 2026-07-18 (Phase 6 agent draft)                                                              |
| **Deciders**  | Platform, Release Manager, Engineering                                                        |
| **Hard gate** | G9 (ADR signed + monitors on canonical origin)                                                |

## Context

Two production surfaces exist in project history:

- **Cloud Run** — declared canonical in `docs/CANONICAL_PRODUCTION.md` (GCP project `delta-wonder-488420-i3`, region `us-central1`, service `mangu-publishers`; deploy path `cloudbuild.yaml` via `scripts/gcloud-build-submit.sh`). VERIFIED as a repo claim.
- **Vercel** — `www.mangu-publishers.com` still served by Vercel (`server: Vercel`, re-verified 2026-07-18). Preview host `manguprojectz.vercel.app` returns readiness `ready:false` (missing Stripe env). Apex `mangu-publishers.com` is served by **Google Frontend** / Cloud Run and returns readiness `ready:true` (all critical checks pass) — VERIFIED 2026-07-18.

Exactly one platform must own the canonical origin for `mangu-publishers.com` / `www.mangu-publishers.com`. Monitors (P0-007), the Stripe webhook (G8), DNS/TLS (Phase 15), and the rollback target (G11) all derive from this decision. A split-brain deployment invalidates exact-SHA evidence (CCR-005).

## Options

| Option                      | Description                                                   | Consequence sketch                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Cloud Run canonical** | Route apex + www to Cloud Run; Vercel retired or preview-only | Matches `docs/CANONICAL_PRODUCTION.md`, `cloudbuild.yaml`, Appendix G scripts; requires GCP secret promotion (Phase 11) and DNS cutover (Phase 15) |
| **B — Vercel canonical**    | Keep Vercel serving; retire Cloud Run                         | Conflicts with existing runbooks/scripts; full rewrite of deploy + secret path; current Vercel surface is not readiness-green                      |
| **C — Documented split**    | Different surfaces per host                                   | Rejected unless explicitly justified — violates single-authority and exact-SHA principles for launch                                               |

## Decision (RECOMMENDED — not yet ACCEPTED)

**Option A — Cloud Run is the sole canonical production platform.**

| Item                     | Value                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Platform                 | Google Cloud Run                                                                         |
| GCP project              | `delta-wonder-488420-i3`                                                                 |
| Region                   | `us-central1`                                                                            |
| Service                  | `mangu-publishers`                                                                       |
| Canonical origin         | `https://mangu-publishers.com` (apex; currently Cloud Run / Google Frontend)             |
| `www` cutover            | Phase 15 — point `www.mangu-publishers.com` at the same Cloud Run service; retire Vercel |
| Deploy path              | `./scripts/gcloud-build-submit.sh` → `cloudbuild.yaml`                                   |
| Stripe webhook           | `https://mangu-publishers.com/api/webhook`                                               |
| Monitor / Lighthouse URL | `https://mangu-publishers.com` (P0-007)                                                  |
| Vercel                   | Preview / non-canonical only; not a GO evidence target                                   |

**G9 stays FALSE** until this ADR status → **ACCEPTED** with the signature block below completed.

## Consequences

- Deploy runbooks and scripts (P0-020) remain parameterized to Cloud Run — no rewrite.
- Health-check and Lighthouse monitors retargeted to `https://mangu-publishers.com` (P0-007).
- Conflicting deployment docs marked **SUPERSEDED** and linked here:
  - `docs/AWS_AMPLIFY_DEPLOYMENT.md`, `docs/AWS_AMPLIFY_QUICK_START.md` — legacy Amplify
  - Vercel standalone deploy workflow already retired (PR #144); preview host is not canonical
- `docs/CANONICAL_PRODUCTION.md` remains the operational checklist; this ADR is the signed authority once ACCEPTED.
- Rollback target + command recorded below (CCR-012, G11 rehearsal still Phase 14).

## Rollback (CCR-012)

If a Cloud Run revision is bad after a production deploy:

```bash
# List recent revisions, then route 100% traffic to the last known-good revision:
gcloud run services update-traffic mangu-publishers \
  --region us-central1 \
  --to-revisions=<KNOWN_GOOD_REVISION>=100
```

Record the known-good revision ID in `docs/OPERATOR_QA_LOG.md` at Phase 14 (G11). Do **not** fail over to Vercel for GO evidence — that restores split-brain.

## Live evidence snapshot (agent, 2026-07-18 UTC — DOC-ONLY until operator re-verifies)

| Target                                      | Observation                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `https://mangu-publishers.com/`             | HTTP 200; `server: Google Frontend`; `x-cloud-trace-context` present                         |
| `…/api/health`                              | HTTP 200; `probe: startup`; `status: ok`                                                     |
| `…/api/live`                                | HTTP 200; `status: alive`                                                                    |
| `…/api/health?ready=1`                      | HTTP 200; `ready: true`; environment/database/auth/migrations/stripe all `pass`              |
| `https://www.mangu-publishers.com/`         | HTTP 200; `server: Vercel` — **non-canonical until Phase 15 cutover**                        |
| `https://manguprojectz.vercel.app/…ready=1` | HTTP 200 body with `ready: false` (missing Stripe env) — **not a production monitor target** |

## Signature Block (Phase 6 — required for ACCEPTED / G9)

| Role            | Name     | Decision (Accept A / Reject) | UTC      |
| --------------- | -------- | ---------------------------- | -------- |
| Platform        | \_\_\_\_ | \_\_\_\_                     | \_\_\_\_ |
| Release Manager | \_\_\_\_ | \_\_\_\_                     | \_\_\_\_ |
| Engineering     | \_\_\_\_ | \_\_\_\_                     | \_\_\_\_ |

After signing: set **Status** → **ACCEPTED**, append a QA-log row with signers + UTC, and refresh `docs/NEXT_GO.md` G9.
