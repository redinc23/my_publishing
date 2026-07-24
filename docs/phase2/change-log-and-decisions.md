# Change Log And Decisions

This file records normalization decisions made while consolidating the Phase 2 source corpus.

## Consolidation Scope

Sources consolidated:

- `litstream_phase2_sec00.md` through `litstream_phase2_sec08.md`
- `litstream_phase2.agent.final.md`
- `litstream_phase2.agent.outline.md`
- `plan.md`

> **Note on provenance:** The `_sources` files retain their original filenames for traceability. Canonical documentation reflects the Next.js 14 standalone runtime, Node.js server, port 3000, and `.next/standalone/` build output. Legacy references to nginx, Vite, `dist/`, port 8080, and Sanity CMS appear only in `_sources` originals.

## Trace Matrix

| Canonical Doc                         | Primary Source | Secondary Source Support                        |
| ------------------------------------- | -------------- | ----------------------------------------------- |
| `01-executive-summary.md`             | `sec00`        | `agent.final` summary sections                  |
| `02-business-requirements.md`         | `sec01`        | `agent.final` section 1                         |
| `03-functional-requirements.md`       | `sec02`        | `agent.final` section 2                         |
| `04-architecture-decisions.md`        | `sec03`        | `agent.final` section 3                         |
| `05-milestone-implementation-plan.md` | `sec04`        | `agent.final` section 4                         |
| `06-acceptance-and-test-protocol.md`  | `sec05`        | `agent.final` section 5                         |
| `07-operational-runbook.md`           | `sec06`        | `agent.final` section 6                         |
| `08-risk-and-troubleshooting.md`      | `sec07`        | `agent.final` section 7                         |
| `09-appendices.md`                    | `sec08`        | `agent.final` section 8                         |
| `10-agent-execution-playbook.md`      | synthesized    | `sec04`-`sec07`, `agent.final`, `agent.outline` |

## Conflict Reconciliation Decisions

### Decision 0: Phase 2 Runtime Normalization

- **Decision:** Normalize Phase 2 technical assumptions from static-nginx (Vite, `dist/`, port 8080, Sanity CMS) to Next.js 14 standalone runtime (Node.js, `.next/standalone/`, port 3000, Supabase/Stripe/Resend).
- **Why:** The actual application `mangu-publishers` is a Next.js 14 app using Supabase, Stripe, and Resend. The original docs were written for a fictional Vite/Nginx static site.
- **Consequence:** All build, deploy, security, and operational documentation updated to reflect Next.js standalone output, Node.js runtime, port 3000, and Supabase/Stripe/Resend secrets.
- **Date:** 2026-05-08

### Decision 1: Next.js Version Pinning

- **Observed conflict:** legacy sources reference `nginx:1.29-alpine` vs `nginx:1.27-alpine`.
- **Canonical decision:** the runtime is now Node.js (Next.js 14 standalone). Pin to the latest patched Node.js 20.x LTS base image at implementation time after CVE review.
- **Implementation note:** the Dockerfile uses a Node.js base image, builds the Next.js app, and produces `.next/standalone/` output; no nginx is involved.

### Decision 2: Cloud Run Memory Floor

- **Observed conflict lineage:** legacy mention of `256Mi` appears in risk/troubleshooting context.
- **Canonical decision:** deployment baseline is `--memory=512Mi` for gen2 compatibility.
- **Rationale:** corpus ADRs and deployment constraints consistently normalize to `512Mi`.

### Decision 3: Secret Variable Name

- **Observed legacy pattern:** `VITE_SANITY_API_READ_TOKEN`.
- **Canonical decision:** server secrets use plain names with no `NEXT_PUBLIC_` prefix — `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`.
- **Rationale:** `NEXT_PUBLIC_*` variables are baked into the client bundle at build time; server secrets must never be exposed to the browser. Public variables such as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are safe to set as build-time env vars because they are intended for client use.

### Decision 4: Document Ownership Boundaries

- **Issue:** overlap across architecture, implementation, and acceptance sections.
- **Canonical decision:** each target doc owns one functional domain; cross-links handle reuse.
- **Rationale:** reduce drift and duplicated updates.

### Decision 5: Canonical `P0-1`…`P0-9` vs Legacy `_sources` Numbering

Legacy prose (especially `litstream_phase2.agent.final.md` / `litstream_phase2_sec05.md`) used **seven** tests `P0-1`…`P0-7` plus **`CVE-GATE`** and **`WEBHOOK`**. Canonical Phase 2 uses **`P0-1`…`P0-9`** in [`06-acceptance-and-test-protocol.md`](06-acceptance-and-test-protocol.md). Executable templates and RACI always reference the canonical IDs.

| Legacy label | What it meant                                                   | Canonical ID(s)                                                                                  |
| ------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| P0-1         | No secret leakage (bundle, layers, runtime, logs)               | **P0-1**                                                                                         |
| P0-2         | `.next/standalone/` before Docker; no Dockerfile fallback build | **P0-2**                                                                                         |
| P0-3         | Next.js standalone runtime, `/api/health`, CSP                  | **P0-4** (headers/CSP), **P0-5** (`/api/health`), **P0-6** (revision/service alignment)          |
| P0-4         | GitHub `main` → Developer Connect → build starts                | **P0-7** (CI integrity and gates; trigger health is part of the secured pipeline)                |
| P0-5         | Firebase Hosting → Cloud Run, HTTPS, deep routes                | **P0-3** (deep links / SPA routing), **P0-5** (health), **P0-6** (service URL / routing targets) |
| P0-6         | Cloud Run memory, scaling, gen2                                 | **P0-6**                                                                                         |
| P0-7         | Immutable cache, `.map` 404, security headers                   | **P0-3**, **P0-4**                                                                               |
| CVE-GATE     | Vulnerability scan blocks HIGH/CRITICAL                         | **P0-7**                                                                                         |
| WEBHOOK      | Publish → signed webhook → rebuild latency                      | **P0-8**                                                                                         |

Observability (Sentry, uptime checks, alert policies, budgets, cleanup) was partly implicit in legacy prose; canonical coverage is **P0-9**.

### Decision 7: Canonical Monitoring, Rollback, And Abort Thresholds

Single baseline for Cloud Monitoring alert policies, rollback triggers in [`07-operational-runbook.md`](07-operational-runbook.md), and abort triggers in [`13-cutover-day-runbook.md`](13-cutover-day-runbook.md):

| Signal              | Threshold                      | Window / notes                                                           |
| ------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| 5xx error rate      | **> 5%**                       | **5** consecutive minutes (treat repeated windows as sustained incident) |
| p99 request latency | **> 2000 ms**                  | **5** consecutive minutes                                                |
| Memory utilization  | **> 85%** of **512Mi** limit   | **5** consecutive minutes                                                |
| Instance count      | **≥ 8** (80% of `maxScale=10`) | **10** consecutive minutes                                               |
| `/api/health`       | **3** consecutive failures     | **1-minute** probe interval on `${CUSTOM_DOMAIN}`                        |

**Rationale:** aligns rollback and cutover abort semantics with observable SLO-style signals for a small Next.js standalone site on Cloud Run (cost-conscious `maxScale=10`), catches saturation early via instance count, and pairs user-visible latency/error spikes with health probe failure. Health checks and budgets are elaborated under **P0-9** in `06`.

## Normalization Rules Applied

- Heading structure normalized to predictable navigation format.
- Repeated control statements collapsed into canonical location.
- Launch gate checks consolidated in acceptance protocol.
- Incident and remediation actions centralized in runbook and risk docs.

## Remaining Open Item

- `litstream_phase2_planning_document.docx` is ingested into `_sources`; if its prose diverges from markdown sources, update canonical docs by preserving markdown corpus decisions unless explicit product/engineering owner override is provided.
