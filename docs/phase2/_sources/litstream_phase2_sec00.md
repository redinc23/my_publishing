## Executive Summary

### Project Purpose

Mangu Publishers is a content publishing platform for books, authors, and categories, where editors manage content through Sanity Studio and a build-time pipeline pre-renders that content into a fully static site. There is no runtime API: every page is generated during the build process, producing HTML shells, hashed assets, and a sitemap that collectively form a complete deployable artifact. Phase 2 takes the Mangu Publishers codebase from its current local-only development state to a fully operational production deployment reachable at a custom domain over HTTPS, served through Firebase Hosting with a Cloud Run backend and backed by Sanity CMS content.

The goal of Phase 2 is singular: a real user must be able to type the domain into a browser, see the site load over TLS, navigate to any deep-linked page, and view content that originated in Sanity. The deployment must be automated, secrets must not leak into any client-facing bundle or runtime environment, content changes must trigger automatic rebuilds, and the system must be instrumented with monitoring and alerting.

### Scope Definition

Phase 2 is organized into seven sequential milestones (M1 through M7), summarized below. Launch occurs at the completion of M6; M7 provides post-launch production hardening.

| Milestone                             | Goal                                                                             | Key Deliverable                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| M1 — Local Security Hardening         | Eliminate secret exposure risk before any infrastructure work begins             | Renamed token (`SANITY_API_READ_TOKEN`), Zod validation, `.gitignore`, `.dockerignore`, secret audit script             |
| M2 — Build Pipeline Scripts           | Five npm scripts that transform Sanity content into a complete `dist/` directory | `build:content`, `build:routes`, `build:vite`, `build:prerender`, `build:sitemap` plus combined `build` and smoke tests |
| M3 — Runtime Container                | Hardened container that serves only pre-built static files                       | `Dockerfile` (`nginx:1.27-alpine`), `nginx.conf.template`, non-root execution (UID 1001), hard-fail on missing `dist/`  |
| M4 — GCP Foundation                   | All Google Cloud resources provisioned with correct IAM bindings                 | Artifact Registry, Secret Manager, Cloud Build service account, Developer Connect (GitHub), build trigger               |
| M5 — Cloud Build End-to-End           | Push to `main` triggers automated build and Cloud Run deployment                 | `cloudbuild.yaml` (16-step pipeline including vulnerability scan, `--memory=512Mi`, `--no-default-url`)                 |
| M6 — Firebase Hosting & Custom Domain | Public site live on custom domain over HTTPS with CDN                            | `firebase.json` rewrite to Cloud Run, DNS configuration, TLS provisioning, SPA routing                                  |
| M7 — Production Guardrails            | Observability, auto-rebuild on content changes, cost controls                    | Sentry release tracking, Sanity webhook validator, Cloud Monitoring uptime checks, billing alerts, tag pruning          |

The milestones form a strict dependency chain. M2 requires M1's `node-env.ts` module. M3 requires M2's `dist/` output. M4 has no dependency on M2 or M3 and may be provisioned in parallel with local build work. M5 requires all four prior milestones to be complete. M6 and M7 depend on M5.

### Success Criteria

Phase 2 is complete when the following conditions are simultaneously satisfied: the site loads at `https://www.custom-domain.com` over HTTPS; the `/healthz` endpoint returns HTTP 200; deep links (e.g., `/books/<slug>`) resolve correctly without server-side 404 errors; a `grep` for `SANITY_API_READ_TOKEN` across `dist/assets/` and the Cloud Run runtime environment returns zero results; hashed JavaScript and CSS assets are served with `Cache-Control: public, max-age=31536000, immutable`; source map URLs return HTTP 404; the Content-Security-Policy header excludes `*.api.sanity.io`; the container runs as non-root (UID 1001); publishing content in Sanity Studio triggers a rebuild within approximately 60 seconds; Sentry receives events tagged with the git SHA as the release identifier; a Cloud Monitoring uptime check reports green; and billing budget alerts are configured at 50%, 75%, and 90% thresholds.

### Target Audience

This document is written for the engineering team executing the Phase 2 buildout, DevOps operators responsible for GCP infrastructure and Firebase Hosting configuration, and future maintainers who need to understand the architectural rationale, operational runbooks, and acceptance criteria that define a completed Phase 2 deployment.
