# 04. Technical Architecture And Decisions

Source baseline: `docs/phase2/_sources/litstream_phase2_sec03.md` with normalization from `litstream_phase2.agent.final.md`

## Architecture Overview

Phase 2 uses a Next.js 14 standalone runtime architecture:

- Next.js compiles at build time into `.next/standalone/`.
- Runtime executes a Node.js app server from the standalone output.
- Firebase Hosting provides edge entry, TLS, and route rewrite behavior.
- Cloud Run hosts the Node.js container.

## Key Technology Decisions

- Frontend: React + Next.js 14 + TypeScript + Tailwind.
- Content/Backend: Supabase (PostgreSQL + realtime + auth + storage).
- Build tooling: `npm run build` with `output: 'standalone'`.
- Runtime: Node.js standalone container (non-root).
- Infra: GCP Cloud Build, Artifact Registry, Cloud Run, Firebase Hosting.
- Observability: Sentry + Cloud Monitoring + Cloud Logging.

## ADR-001: Supabase Backend And Build-Time Data Fetch

- **Decision:** Use Supabase as backend and build-time data fetch where appropriate.
- **Why:** Next.js supports both SSR and static generation (SSG). Server-side fetching and API routes can use the full Supabase client, while pages that are static-generated at build time can pre-fetch content and eliminate runtime CMS dependency for those routes.
- **Consequence:** Server secrets needed at runtime for Supabase service role, Stripe, and Resend.

## ADR-002: Secret Naming And Exposure Boundary

- **Decision:** Separate `NEXT_PUBLIC_*` public variables from server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`).
- **Why:** Prevent secret exposure to browser bundle. Next.js inlines `NEXT_PUBLIC_*` variables into the client JS at build time; any secret without that prefix stays server-side.
- **Consequence:** Public vars are baked at build time; secrets injected at runtime via Secret Manager.

## ADR-003: Cloud Run gen2 Memory Floor

- **Decision:** Deploy with `--memory=512Mi`.
- **Why:** Cloud Run gen2 rejects `256Mi` for 1 vCPU configuration.
- **Consequence:** Stable deploy acceptance and predictable runtime envelope. Next.js standalone may benefit from `512Mi`–`1Gi` depending on traffic and SSR workload.

## ADR-004: Next.js Standalone Runtime

- **Decision:** Runtime image runs Node.js server using Next.js `output: 'standalone'` build artifact.
- **Why:** Supports API routes, SSR, and dynamic rendering while keeping the container minimal and self-contained.
- **Consequence:** Dockerfile must use a Node.js base image and build or copy `.next/standalone/` into the final layer.

## ADR-005: Security Gates In CI

- **Decision:** Pipeline includes mandatory secret audit and vulnerability gate.
- **Why:** Security regressions must fail before deployment.
- **Consequence:** Deploy can be blocked by policy violations, requiring remediation.

## ADR-006: Cloud Logging Only For Cloud Build

- **Decision:** Cloud Build uses `options.logging: CLOUD_LOGGING_ONLY`.
- **Why:** Avoids legacy GCS build-log buckets that can widen exposure surface for secret-adjacent log lines.
- **Consequence:** Build forensics use Cloud Logging; do not depend on bucket-exported CI logs.

## ADR-007: Production Dockerfile Uses Standalone Output

- **Decision:** The production Dockerfile builds the Next.js app inside a multi-stage build or uses pre-built `.next/standalone/`.
- **Why:** The standalone output contains `server.js` and all required static files in a self-contained directory, keeping the final image deterministic.
- **Consequence:** CI must produce `.next/standalone/` before image packaging; missing `server.js` fails the build.

## Cloud Build Pipeline Architecture Reference

Canonical **stage** numbering matches [`05-milestone-implementation-plan.md`](05-milestone-implementation-plan.md). Detailed step IDs (`restore-npm-cache`, `nextjs-build`, `docker-build`, …) are defined in repository `cloudbuild.yaml` and summarized in [`09-appendices.md`](09-appendices.md) Appendix C.

| Phase           | Canonical steps | Notes                                                                                                                                    |
| --------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Build           | 1–8             | Checkout, `npm ci`, lockfile verify, Next.js build, `.next/standalone/` integrity check; fail-closed secret audit before container image |
| Container       | 9–12            | Docker build → push to Artifact Registry → vulnerability scan **on pushed image**                                                        |
| Deploy + verify | 13–14           | Cloud Run deploy with runtime secrets, post-deploy checks per YAML                                                                       |

## Request And Content Flows

### Runtime Request Path

`User -> Firebase Hosting -> Cloud Run (Next.js Node server) -> SSR / API / static response`

### Content Update Path

`Supabase update -> webhook trigger -> Cloud Build -> Next.js rebuild -> new revision`

## Canonical Parameter Set

- Runtime port: `3000`
- Container execution user: `UID 1001` (or `node` user)
- Cloud Run memory: `512Mi` (with note: may scale to `1Gi` for Next.js)
- Cloud Run execution environment: `gen2`
- Deep-link behavior: Next.js file-system routing / `next.config.js` rewrites

## Decision Alignment Notes

Pin the Next.js version in `package.json` to a specific minor/patch range (e.g., `^14.2.x`) and update only after smoke-testing the standalone output in Cloud Run.

See `change-log-and-decisions.md` for reconciliation details.
