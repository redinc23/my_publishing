# 02. Business Requirements

Source baseline: `docs/phase2/_sources/litstream_phase2_sec01.md`

## Product Overview

Mangu Publishers is a publishing platform for books, authors, and categories. Phase 2 business intent is to make the current implementation reliably publishable and operable in production with strong security boundaries and predictable deployment behavior.

Business architecture intent:

- Backend data and auth stay in Supabase.
- Public site delivery uses Next.js 14 with SSR/SSG/static generation for reliability, performance, and SEO.
- Deployments are CI/CD-driven from `main`.
- Security controls are mandatory gates, not optional checks.

## Business Goals

1. Launch a production site on a custom domain with HTTPS.
2. Enforce fully automated CI/CD from source control to deployment.
3. Ensure zero secret leakage to browser, runtime, image layers, or logs.
4. Ensure content/backend updates can trigger automated rebuilds in near real time.
5. Ensure operator visibility with alerting, health checks, and budget controls.

## In-Scope Business Outcomes

- Secure content and backend integration build process.
- Deterministic Next.js build producing `.next/standalone/`.
- Hardened Node.js runtime container and Cloud Run deployment.
- Firebase Hosting front door and custom domain cutover.
- Operational standards for rollback, incident response, and guardrails.

## Out Of Scope (Phase 2)

- Re-architecture into runtime-only SPA without Next.js benefits.
- Feature-level product redesign unrelated to deployment hardening.
- Multi-region failover architecture beyond documented current-region model.
- Non-essential platform migration not required for launch.

## Business Constraints

- Security first: secret handling policies are P0 release gates.
- Deployment confidence over velocity: deterministic pipeline beats ad hoc deploys.
- Operational simplicity: low moving parts at runtime.
- Cost discipline: Node.js serving + Cloud Run scaling + budget alerts.

## Stakeholders And Ownership

- Product/Business owner: accepts launch readiness.
- Engineering lead: accountable for technical implementation quality.
- Platform engineer: accountable for cloud infrastructure and deploy pipeline.
- Security lead: accountable for secret exposure controls and incident response.
- On-call operator: accountable for day-2 health, rollback, and alert response.

## Milestone-Level Business Deliverables

| Milestone | Business Deliverable                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| M1        | Secret exposure risk materially reduced before infra rollout                                                         |
| M2        | Repeatable build process that transforms Supabase data and Next.js source into deployable `.next/standalone/` output |
| M3        | Runtime artifact that can be promoted with minimal security surface                                                  |
| M4        | Cloud foundation ready for controlled CI/CD                                                                          |
| M5        | End-to-end automated deployment from git push                                                                        |
| M6        | Public launch path complete with domain and TLS                                                                      |
| M7a       | Pre-cutover observability, alerting, and budget guardrails                                                           |
| M7b       | Post-cutover stabilization and webhook-driven operations validated                                                   |

## Definition Of Done (Acceptance Criteria Map)

Phase 2 is complete when **all rows** below are satisfied. `Canonical P0` refers to [`06-acceptance-and-test-protocol.md`](06-acceptance-and-test-protocol.md). Legacy source docs (`_sources/litstream_phase2.agent.final.md`) used different P0 numbering; see `change-log-and-decisions.md` Decision 5.

|   # | Acceptance criterion                                                          | Canonical P0 | Verification method (summary)                                      |
| --: | ----------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
|   1 | Push to `main` triggers Cloud Build; pipeline completes green                 | P0-7         | `gcloud builds triggers` + build history; all canonical steps pass |
|   2 | Production site loads over HTTPS                                              | P0-5, P0-6   | `curl -sI` to `${CUSTOM_DOMAIN}` returns success                   |
|   3 | `/api/health` returns HTTP 200                                                | P0-5         | `curl` to `/api/health` returns `200`                              |
|   4 | Deep links load without server-side 404                                       | P0-3         | `curl` deep routes + SPA fallback behavior                         |
|   5 | No server secret strings under `.next/standalone/`                            | P0-1         | `rg` over full `.next/standalone/`                                 |
|   6 | Cloud Run runtime YAML shows no server secret env vars (uses `--set-secrets`) | P0-1         | `gcloud run services describe`                                     |
|   7 | Next.js static assets have appropriate `Cache-Control` headers                | P0-4         | `curl -sI` on static asset URLs                                    |
|   8 | Source maps and build artifacts are not publicly exposed                      | P0-4         | `curl -sI` on `.map` URLs + build output review                    |
|   9 | CSP blocks unauthorized API access                                            | P0-4         | response headers                                                   |
|  10 | Container runs as non-root UID 1001                                           | P0-2, P0-6   | image inspect + Cloud Run revision spec                            |
|  11 | Supabase/webhook triggers rebuild within SLO                                  | P0-8         | event timestamp vs build start (see `06`)                          |
|  12 | Sentry receives events/releases tagged with git SHA                           | P0-9         | Sentry UI/API evidence                                             |
|  13 | Cloud Monitoring uptime check on `/api/health` green                          | P0-9         | Monitoring console                                                 |
|  14 | Billing budget alerts at 50%, 75%, 90%                                        | P0-9         | Billing budgets console                                            |

## Acceptance From Business Perspective

Phase 2 is accepted only when:

- A real external user can access production domain securely.
- Content updates flow from CMS to site without manual rebuild workflows.
- Security checks are verifiably passing and documented.
- Operators can detect, diagnose, and respond to incidents quickly.
