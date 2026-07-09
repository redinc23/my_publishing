# Mangu Publishers Phase 2 — Complete Buildout Planning Document

**Document Type:** BRD / FRD / Technical Specification

**Version:** 1.0

**Date:** May 2026

**Prepared for:** Mangu Publishers Engineering Team

---

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

## 1. Business Requirements Document

### 1.1 Product Overview

#### 1.1.1 Mangu Publishers as a Content Publishing Platform

Mangu Publishers is a content publishing platform for editorial management of books, authors, and category metadata. Content editors manage all site content through Sanity Studio, which serves as the single source of truth. The Sanity schema defines content types for books (title, author, body, cover image, slug, category relationships), authors (name, biography, portrait), and categories (name, description, slug). Editorial changes in Sanity Studio propagate to the live website through a webhook-triggered rebuild pipeline. The platform serves public visitors with pre-rendered content; there is no authenticated user experience for end visitors in Phase 2. All content is public-read, delivered as static HTML with no runtime content API.

#### 1.1.2 Static Rendering and CDN Delivery Architecture

All content from Sanity is fetched at **build time only** through a server-side client configured with `perspective: "published"` and `useCdn: false`. The build pipeline produces a complete `dist/` directory with prerendered HTML for every route, hashed JavaScript and CSS assets (`/assets/*.[hash].js`, `/assets/*.[hash].css`), a `sitemap.xml`, and a `contentSnapshot.json` containing provenance metadata (`contentHash`, `buildCommit`, `sanityDataset`). There are **no runtime API calls to Sanity** from the browser or server after the build completes.

Prerendering uses Playwright Chromium to visit each route at build time, capture the rendered DOM, and write static HTML shells. Dynamic routes (`/books/<slug>`, `/authors/<slug>`, `/categories/<slug>`) are discovered by querying Sanity during the `build:routes` step and written to `.cache/routes.json` for the prerenderer. A hardened **nginx container** (`nginx:1.27-alpine`, non-root UID 1001, port 8080) serves the static files. The nginx configuration enforces a Content Security Policy excluding `*.api.sanity.io` from `connect-src`, includes `cdn.sanity.io` in `img-src` for Portable Text images, and delivers immutable cache headers on hashed assets. No Node.js process runs in the production container.

#### 1.1.3 Architectural Priorities: Security, Performance, and Operational Simplicity

Phase 2 makes explicit trade-offs favoring security, performance, and operational simplicity over dynamic runtime capabilities. **Security** is enforced through build-time secret isolation (the `SANITY_API_READ_TOKEN` is scoped to one Cloud Build step and never reaches the browser, Docker layers, Cloud Run runtime, or logs), HMAC webhook signature verification, a restrictive Content Security Policy, and non-root container execution. **Performance** is achieved through prerendered HTML, immutable asset caching (one-year `Cache-Control`), Firebase Hosting CDN edge caching, and Cloud Run minimum-zero scaling. **Operational simplicity** uses a single-branch GitOps workflow (`main`) triggering a deterministic 16-step build pipeline, idempotent `gcloud` infrastructure provisioning, and Cloud Monitoring for observability without external platforms.

### 1.2 Business Goals

#### 1.2.1 Goal 1: Public Website Launch on Custom Domain over HTTPS

Launch a publicly accessible website on a custom domain with TLS termination. The site resolves over HTTPS at `https://www.yourdomain.com/`, serves prerendered HTML for all routes including deep links (`/books/<slug>`), and maintains a `/healthz` endpoint returning HTTP 200. Launch readiness is defined as completion of Milestones 1 through 6. Milestone 6 (Firebase Hosting with custom domain, CDN, SPA routing) is the formal launch milestone.

#### 1.2.2 Goal 2: Automated CI/CD Pipeline

Establish a fully automated CI/CD pipeline via Google Cloud Build. Every push to `main` triggers a 16-step pipeline within 60 seconds: restore npm cache, install, production audit, content snapshot (sole step with the Sanity token), route generation, Vite build, prerender, sitemap, secrets audit, smoke test, Docker build, Docker push, vulnerability scan, Cloud Run deploy, tag pruning, save npm cache. The pipeline uses `CLOUD_LOGGING_ONLY` to prevent secret exposure and blocks deployment on HIGH or CRITICAL CVE findings.

#### 1.2.3 Goal 3: Zero Secret Exposure

The `SANITY_API_READ_TOKEN` must not be exposed to five attack surfaces: (1) the browser bundle and prerendered HTML shells (**full `dist/` tree**, not only `dist/assets/`), (2) Docker image layers (Dockerfile has no `ARG`/`ENV` for the token), (3) Cloud Run runtime (no `SANITY_API_READ_TOKEN` env var on the deployed service), (4) Cloud Build logs (`CLOUD_LOGGING_ONLY` with single-step `secretEnv` scoping), and (5) CSP headers (`connect-src` excludes `api.sanity.io`, proving no runtime Sanity connections). This goal is the central security thesis and is verified by the `audit:secrets` script and five independent P0 test dimensions.

#### 1.2.4 Goal 4: Automatic Content Rebuilds within ~60 Seconds

Content editors publishing changes in Sanity Studio must see those changes on the live site within approximately 60 seconds. A webhook validator (Cloud Run Function or second Cloud Run service) receives Sanity events, verifies HMAC signatures, implements replay protection (rejecting duplicate payload IDs within 10 minutes), and triggers Cloud Build via `gcloud builds triggers run mangu-publishers-main`. Unsigned requests return HTTP 401/403 and trigger no rebuild.

#### 1.2.5 Goal 5: Monitoring, Alerting, and Cost Controls

Establish production observability and cost governance. **Sentry** tracks errors with git-SHA release identification. **Cloud Monitoring** checks `/healthz` every 60 seconds and alerts on four conditions: 5xx error rate > 5%, p99 latency > 2000ms, memory utilization > 85%, and instance count >= 8 (approaching `maxScale=10`). **Cost controls** include billing budget alerts at 50%, 75%, and 90%, Artifact Registry cleanup policies, and automated Cloud Run tag pruning (`KEEP=50`).

### 1.3 In-Scope Features

#### 1.3.1 Feature Table: Seven Milestones

| Milestone | Name                     | Deliverables                                                                                                                                                                                                                                                                                             | Exit Criteria                                                                                                                    |
| --------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| M1        | Local Security Hardening | Token rename (`VITE_` prefix removal); `scripts/_lib/node-env.ts` (Zod validation, required token); `scripts/_lib/sanity-node-client.ts` (`useCdn: false`, `perspective: "published"`); `.gitignore` and `.dockerignore`; `audit:secrets` script                                                         | `audit:secrets` exits 0; grep for token in `dist/assets/` returns empty; `node-env.ts` throws on missing token                   |
| M2        | Build Pipeline Scripts   | Five npm scripts (`build:content`, `build:routes`, `build:vite`, `build:prerender`, `build:sitemap`); content snapshot with `contentHash`, `buildCommit`, `sanityDataset`; route generator; prerenderer (Playwright Chromium); sitemap generator; smoke test script                                      | `dist/` contains `index.html`, hashed assets, prerendered HTML shells, `sitemap.xml`; snapshot has all three provenance fields   |
| M3        | Runtime Container        | `Dockerfile` (`nginx:1.27-alpine`, UID 1001, hard-fail without `dist/`); `nginx.conf.template` (CSP, `/healthz`, immutable cache, SPA fallback, `.map` 404)                                                                                                                                              | `docker build` succeeds; fails without `dist/`; `/healthz` returns 200; CSP excludes `api.sanity.io`; container runs as UID 1001 |
| M4        | GCP Foundation           | Artifact Registry `web-images` with cleanup policy; Secret Manager secret `sanity-api-read-token`; Cloud Build SA `cloudbuild-mangu-publishers`; GCS cache bucket; Developer Connect GitHub link; Cloud Build trigger on `^main$`                                                                        | All `gcloud describe` commands succeed; push to `main` starts Cloud Build                                                        |
| M5        | Cloud Build End-to-End   | `cloudbuild.yaml` with 16 steps; vulnerability scan gate; `--memory=512Mi --no-default-url` deploy flags                                                                                                                                                                                                 | Full pipeline green; Cloud Run URL returns 200; no token in logs; image tagged with `SHORT_SHA` and `latest`                     |
| M6        | Firebase Hosting         | `firebase.json` (rewrite all routes to Cloud Run, `pinTag: true`); `public-placeholder/`; custom domain with TLS; CDN edge caching                                                                                                                                                                       | `https://www.yourdomain.com/` loads over HTTPS; deep links return 200; security headers present                                  |
| M7        | Production Guardrails    | Sentry release tracking with hidden source maps; Sanity webhook validator (HMAC + replay protection); Cloud Monitoring uptime check and alert policies; billing budget alerts at 50/75/90%; Artifact Registry cleanup; Cloud Run tag pruning (`KEEP=50`); Portable Text renderer; Formspree contact form | Sentry shows events tagged with SHA; webhook triggers build within ~60s; monitoring green; budget alerts active                  |

#### 1.3.2 Build Pipeline Producing Complete dist/

The build pipeline produces a `dist/` directory with four artifact types: prerendered HTML shells for all routes (static and dynamic), hashed/fingerprinted JS/CSS assets in `dist/assets/` with content-hash suffixes for immutable caching, a `sitemap.xml` with canonical URLs, and a `contentSnapshot.json` with SHA-256 `contentHash`, git `buildCommit`, and `sanityDataset` for build provenance. Five ordered npm scripts execute sequentially, followed by `audit:secrets` to verify no secrets leaked into output.

#### 1.3.3 Hardened nginx Container

The runtime container uses `nginx:1.27-alpine` with a non-root user (UID 1001, GID 1001), copies `dist/` into `/usr/share/nginx/html/`, and hard-validates that `index.html` exists (`test -f ... || exit 1`). No fallback build exists — if `dist/` is absent, the Docker build fails. The `nginx.conf.template` configures CSP with `connect-src` excluding `*.api.sanity.io`, `img-src` including `cdn.sanity.io`, and SPA routing via `try_files $uri $uri/ /index.html`. Source map URLs return HTTP 404 via a dedicated location block.

#### 1.3.4 Firebase Hosting with Custom Domain, TLS, CDN, and SPA Routing

Firebase Hosting provides the public edge layer: custom domain resolution, automatic TLS, global CDN caching, and SPA routing. The `firebase.json` sets `"public": "public-placeholder"` (an empty directory — all traffic is rewritten to Cloud Run) and defines `"source": "**"` routing to Cloud Run service `mangu-publishers` in `us-central1` with `pinTag: true`, creating an immutable traffic tag on each deploy. Deep links to `/books/<slug>` hit the CDN, are rewritten to Cloud Run, and nginx serves `index.html` for client-side routing.

#### 1.3.5 Sanity Webhook Validator with HMAC and Replay Protection

The webhook validator receives Sanity content change events and triggers rebuilds only for authenticated requests. **HMAC signature verification**: Sanity sends a `Sanity-Webhook-Signature` header; the validator recomputes the SHA-256 HMAC using a shared secret and rejects invalid requests (HTTP 401/403). **Replay protection**: payload IDs are tracked and duplicates rejected within a 10-minute window. On validation, the validator triggers `gcloud builds triggers run mangu-publishers-main`. The validator deploys independently of the main web service to minimize attack surface.

#### 1.3.6 Sentry Error Tracking with Git-SHA Release Identification

Sentry is configured with `@sentry/vite-plugin` receiving the auth token via `secretEnv` during the `vite-build` step. The plugin uploads source maps to Sentry and deletes them from `dist/` before Docker build, ensuring symbolized stack traces without exposing source maps in the deployed container. `VITE_APP_VERSION=${SHORT_SHA}` tags all events with the git commit hash as the release identifier, enabling commit-level error traceability.

#### 1.3.7 Cloud Monitoring Uptime Checks and Alert Policies

Cloud Monitoring checks `/healthz` every 60 seconds with a 10-second timeout. Four alert policies are configured: **5xx error rate** > 5% over 5 minutes; **p99 latency** > 2000ms over 5 minutes; **memory utilization** > 85% of 512Mi over 5 minutes; **instance count** >= 8 (80% of `maxScale=10`) indicating traffic spike or runaway process. All alerts route to the engineering team's email.

#### 1.3.8 Billing Budget Alerts at 50%, 75%, and 90% Thresholds

Cloud Billing budget alerts are configured with notification thresholds at 50%, 75%, and 90% of the monthly budget, each sending email to the engineering team. This provides early warning of cost overruns before they become critical, complementing the Artifact Registry cleanup and Cloud Run tag pruning automation.

#### 1.3.9 Artifact Registry Cleanup Policies and Cloud Run Tag Pruning

The Artifact Registry cleanup policy retains 15 most recent tagged images and deletes untagged images older than 3 days (259,200 seconds). Cloud Run tag pruning via `scripts/ops/prune-cloud-run-tags.sh` retains 50 most recent traffic tags, invoked as a Cloud Build step (step 15), run manually, or scheduled via Cloud Scheduler.

### 1.4 Out-of-Scope Features (Explicit Exclusions)

#### 1.4.1–1.4.5 Excluded Capabilities

The following features are explicitly excluded from Phase 2. These exclusions are non-negotiable scope boundaries; any request to implement them during Phase 2 must be deferred to Phase 3 or later.

| #   | Excluded Feature                          | Rationale                                                                                       | Deferral Target  |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Authentication / user accounts            | No authenticated visitor experience required for public content site                            | Phase 3          |
| 2   | Search functionality                      | No search index, API, or UI component; prerendered HTML is crawlable by external search engines | Phase 3          |
| 3   | Comments, ratings, user-generated content | Platform is strictly publisher-to-consumer with no visitor input channels                       | Phase 3 or later |
| 4   | Email subscriptions / newsletters         | Formspree contact form (M7) is unidirectional messaging only; no subscriber management          | Phase 3 or later |
| 5   | Mobile native applications                | No iOS or Android app development                                                               | Future phase     |
| 6   | Analytics dashboards                      | Basic GCP Cloud Monitoring metrics only; no custom analytics UI                                 | Phase 3          |
| 7   | A/B testing                               | No experiment framework or traffic splitting for feature comparison                             | Future phase     |
| 8   | Internationalization                      | Language field in Sanity schema only; no multi-locale routing or content translation            | Phase 3          |

### 1.5 Success Metrics (Definition of Done)

#### 1.5.1 Definition of Done Table

Phase 2 is complete when all 14 acceptance criteria below are satisfied. Each criterion maps to a canonical P0 ID from [`06-acceptance-and-test-protocol.md`](../06-acceptance-and-test-protocol.md) (see [`change-log-and-decisions.md`](../change-log-and-decisions.md) Decision 5 for legacy→canonical mapping).

| #   | Acceptance Criterion                                                                          | P0 Test ID | Verification Method                                                      |
| --- | --------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| 1   | Push to `main` triggers Cloud Build within 60s; build runs green                              | P0-7       | `gcloud builds list` shows SUCCESS within 60s of push; all 16 steps pass |
| 2   | `https://www.yourdomain.com/` loads over HTTPS                                                | P0-5, P0-6 | `curl -sI` returns `HTTP/2 200`                                          |
| 3   | `/healthz` returns HTTP 200                                                                   | P0-5       | `curl` to `/healthz` returns `200 ok`                                    |
| 4   | Deep links load correctly with no server 404                                                  | P0-3, P0-4 | `curl` to deep link returns 200; SPA fallback serves `index.html`        |
| 5   | `grep -R SANITY_API_READ_TOKEN dist/` returns empty (entire `dist/`, not only `dist/assets/`) | P0-1       | `rg` scan produces empty output                                          |
| 6   | Cloud Run runtime contains no `SANITY_API_READ_TOKEN`                                         | P0-1       | `gcloud run services describe` shows no secret in env                    |
| 7   | Hashed assets return `Cache-Control: public, max-age=31536000, immutable`                     | P0-4       | `curl -sI` on `/assets/*.js` or `/assets/*.css` returns correct header   |
| 8   | Source map URLs return HTTP 404                                                               | P0-4       | `curl` to any `.map` URL returns 404                                     |
| 9   | CSP `connect-src` excludes `*.api.sanity.io`                                                  | P0-4       | Response headers show CSP without `api.sanity.io` in `connect-src`       |
| 10  | Container runs as non-root (UID 1001)                                                         | P0-2, P0-6 | `docker exec <container> id` returns `uid=1001`                          |
| 11  | Sanity content publish triggers rebuild (target ~60s typical; worst-case see `06` P0-8)       | P0-8       | Publish in Sanity; Cloud Build start vs visibility vs thresholds         |
| 12  | Sentry receives errors tagged with git SHA as release                                         | P0-9       | Sentry dashboard shows `release = SHORT_SHA`                             |
| 13  | Cloud Monitoring uptime check on `/healthz` is green                                          | P0-9       | Console shows green checkmark                                            |
| 14  | Billing budget alerts at 50%, 75%, 90%                                                        | P0-9       | Billing Console shows budget with three thresholds                       |

#### 1.5.2 CI/CD Trigger and End-to-End Build Success

The automated pipeline triggers within 60 seconds of any push to `main` and executes all 16 steps. The pipeline completes without manual intervention, produces a deployed Cloud Run service, and generates an Artifact Registry image tagged with the git short SHA and `latest`. The image is pushed to Artifact Registry **before** the vulnerability scan step (**canonical steps 12–14**, [`05-milestone-implementation-plan.md`](../05-milestone-implementation-plan.md)); that scan blocks progression on HIGH or CRITICAL CVEs. Logging mode is `CLOUD_LOGGING_ONLY`.

#### 1.5.3 HTTPS Site Availability, Health Checks, and Deep Link Routing

The launched site serves all content over HTTPS with TLS from Firebase Hosting. The `/healthz` endpoint returns HTTP 200 with `Cache-Control: no-store`. Deep links return prerendered HTML shells (HTTP 200), and unknown paths fallback to `index.html` for client-side SPA routing rather than server 404. Firebase's `pinTag: true` routes through the tagged Cloud Run revision.

#### 1.5.4 Zero Secret Leakage across Five Test Dimensions

Secret exposure testing covers five dimensions: **(1)** Browser bundle: grep/`rg` scan of **`dist/`** (including HTML shells and `dist/assets/`) returns empty; **(2)** Cloud Run environment: `gcloud run services describe` confirms no token env var; **(3)** Docker layers: `docker save` piped through `strings` and `grep` finds no tokens; **(4)** Cloud Build logs: `CLOUD_LOGGING_ONLY` and single-step `secretEnv` scoping prevent log exposure; **(5)** CSP headers: `connect-src` excludes `*.api.sanity.io`, proving no runtime Sanity calls. All five dimensions must pass.

#### 1.5.5 Immutable Caching, Source Map Protection, and CSP Enforcement

Hashed JS/CSS assets in `dist/assets/` are served with `Cache-Control: public, max-age=31536000, immutable`. Source map files are deleted from `dist/` by the Sentry plugin after upload; `.map` requests return HTTP 404. The Content Security Policy excludes `api.sanity.io` from all directives, confirming no runtime Sanity API calls.

#### 1.5.6 Container Security, Sentry Integration, and Monitoring Health

The container runs as non-root (UID 1001). Sentry receives errors tagged with the git short SHA. Cloud Monitoring shows a green uptime check for `/healthz`, and all four alert policies (5xx rate, p99 latency, memory, instance count) are active with notification channels. Artifact Registry cleanup and billing budget alerts are confirmed active.

## 2. Functional Requirements Document

### 2.1 Functional Architecture Overview

#### 2.1.1 System Data Flow

The Mangu Publishers platform implements a **build-time content architecture** in which all dynamic data operations occur during CI/CD, producing fully static output served without server-side computation. Data traverses eight stages:

1. **Sanity CMS** — Content authors publish books, authors, and categories via Sanity Studio.
2. **Build Scripts** — Node.js scripts in Cloud Build fetch content via authenticated Sanity API calls and write a denormalized content snapshot.
3. **Vite Build** — The Vite bundler compiles React source, inlines public `VITE_*` environment variables, and produces hashed JS/CSS assets.
4. **Prerender** — Playwright Chromium visits every route, captures rendered HTML, and writes per-route `index.html` files.
5. **dist/** — Contains hashed assets (`dist/assets/`), prerendered HTML shells, `sitemap.xml`, and `index.html`.
6. **Docker** — Copies the pre-built `dist/` directory into an nginx image. No build commands execute inside the container.
7. **Cloud Run** — The nginx container deploys with autoscaling (min 0, max 10 instances), serving HTTP on port 8080.
8. **Firebase Hosting** — All requests arrive at Firebase Hosting, which rewrites every URL to the Cloud Run service, providing TLS termination, CDN caching, and custom domain support.

The end user receives prerendered HTML with embedded semantic content, hydrated by React on the client. No request to the origin triggers a Sanity API call at runtime.

#### 2.1.2 Runtime Static File Server Model

The Cloud Run runtime is a pure static file server running **nginx 1.27-alpine**. All dynamic behavior — content fetching, reference resolution, route generation — occurs at build time. The container has no Node.js runtime, no Sanity API access, and no access to the Sanity API read token. The Content Security Policy `connect-src` directive excludes `api.sanity.io`, preventing even accidental client-side Sanity connections. The only runtime environment variable is `PORT`, which Cloud Run sets automatically to `8080` and which nginx consumes via `envsubst`.

#### 2.1.3 Content Update Flow

When an author publishes a document in Sanity Studio, the following chain executes:

1. **Sanity publish** — The document commits to the published dataset.
2. **Webhook POST** — Sanity emits an HMAC-signed webhook POST to the validator endpoint.
3. **Validator** — The webhook validator (a Cloud Run service) verifies the HMAC signature, checks for duplicate payloads within 10 minutes, and rejects unsigned or replayed requests with HTTP 401/403.
4. **Cloud Build trigger** — A validated webhook invokes the Cloud Build trigger for the `^main$` branch. Direct pushes to `main` also trigger the pipeline.
5. **New deployment** — Cloud Build executes all 16 steps, producing a new container image and deploying it to Cloud Run. Firebase Hosting's `pinTag: true` atomically routes traffic to the new revision.

The cycle from Sanity publish to live deployment completes in approximately 3 to 5 minutes.

---

### 2.2 Content Management (Sanity CMS)

#### 2.2.1 Document Types and Schema Overview

The Sanity CMS defines three document types — **book**, **author**, and **category** — forming a directed acyclic graph in which books reference authors and categories. The build pipeline resolves these references at snapshot time, producing denormalized JSON consumed by the frontend without additional API calls.

| Document Type | Purpose                        | Key Fields                                                                                                     | Validation                                                                                                                                                                                | Relationships                                                |
| ------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **book**      | Published books in the catalog | title, slug, author, description, coverImage, publishedAt, featured, category, body, isbn, pageCount, language | title: required, max 200 chars; slug: required; author: required reference; description: required, max 500 chars; coverImage: required; isbn: ISBN-10/13 regex; pageCount: integer 1-5000 | author -> author (required); category -> category (optional) |
| **author**    | Book authors                   | name, slug, bio, photo, email, website, social                                                                 | name: required, max 100; slug: required; email: email format                                                                                                                              | Referenced by book documents                                 |
| **category**  | Book genres/categories         | name, slug, description, color                                                                                 | name: required, max 50; slug: required; description: max 300 chars                                                                                                                        | Referenced by book documents                                 |

#### 2.2.2 Book Schema

The book document defines 11 fields. **title** (`string`, required, max 200 chars) displays on the cover. **slug** (`slug`, required, max 96 chars) auto-generates from the title via lowercase hyphenation. **author** (`reference -> author`, required) links to the author document. **description** (`text`, required, max 500 chars) provides SEO meta descriptions. **coverImage** (`image`, required) includes hotspot support and a required `alt` field. **publishedAt** (`datetime`, required) is the official publication date. **featured** (`boolean`, default `false`) controls homepage inclusion. **category** (`reference -> category`, optional) specifies the genre. **body** (`array` of Portable Text, optional) stores rich content with support for Normal/H2/H3/Quote styles, Bullet/Number lists, Strong/Emphasis/Code marks, Link annotations with `blank` target, and inline images with `alt` and `caption`. **isbn** (`string`, optional) validates against ISBN-10/13 regex. **pageCount** (`number`, optional) enforces integer range 1-5000. **language** (`string`, optional, default `"en"`) supports English, Swahili, and French.

#### 2.2.3 Author Schema

The author document defines 6 fields. **name** (`string`, required, max 100 chars). **slug** (`slug`, required, max 96 chars, sourced from name). **bio** (Portable Text, optional) supports Normal and H2 styles with Strong and Emphasis decorators. **photo** (`image`, optional) with hotspot and required `alt`. **email** (`string`, optional) validated as email. **website** (`url`, optional). **social** (`object`, optional) with nested `twitter`, `instagram`, and `linkedin` URL fields.

#### 2.2.4 Category Schema

The category document defines 4 fields. **name** (`string`, required, max 50 chars). **slug** (`slug`, required, max 50 chars, sourced from name). **description** (`text`, optional, max 300 chars). **color** (`color`, optional) for UI accent theming.

#### 2.2.5 GROQ Queries for Build Pipeline

The `build-content-snapshot.ts` script executes five GROQ queries via the authenticated Sanity node client with `useCdn: false` and `perspective: "published"`:

1. **All Books** (`*[_type == "book"] { ... }`) — Fetches complete books with resolved author (`author->{_id, name, slug}`) and category references, cover image metadata including LQIP, and raw Portable Text body.
2. **All Authors** (`*[_type == "author"] { ... }`) — Fetches all authors with resolved photo assets, bio, email, website, and social links.
3. **All Categories** (`*[_type == "category"] { ... }`) — Fetches category metadata for navigation and filtering.
4. **Featured Books** (`*[_type == "book" && featured == true] | order(publishedAt desc) [0...6]`) — Fetches the 6 most recent featured books for the homepage.
5. **Books by Category** (`*[_type == "book" && category._ref == $categoryId] | order(publishedAt desc)`) — Parameterized query for category page filtering.

#### 2.2.6 Portable Text Handling

The `body` fields store content in **Portable Text** — Sanity's JSON-based rich text format. The build pipeline stores Portable Text as raw JSON in `contentSnapshot.json`. At runtime, `@portabletext/react` renders blocks via `PortableTextRenderer.tsx`, mapping node types to React components: Normal/H2/H3 paragraphs, blockquotes with left border styling, Strong/Emphasis/Code marks, Link annotations with `noopener noreferrer` for external targets, and image blocks resolved to Sanity CDN URLs with dimension metadata.

#### 2.2.7 Sanity Image URL Construction

Images are served from `cdn.sanity.io` with the format: `https://cdn.sanity.io/images/{projectId}/{dataset}/{assetId}-{dimensions}.{format}`. The `PortableTextRenderer` constructs these URLs at runtime from asset references in the Portable Text JSON, using public `VITE_SANITY_PROJECT_ID` and `VITE_SANITY_DATASET` variables. Transformation parameters (e.g., `?w=600&h=800&fit=crop`) support responsive sizing. The `cdn.sanity.io` domain is listed in CSP `img-src`. No authentication token is required for CDN image access.

---

### 2.3 Build Pipeline Functional Requirements

#### 2.3.1 Build Step Sequence

The pipeline consists of five ordered steps chained with `&&` for fail-fast behavior.

| Step                 | Script                    | Input                                   | Output                                             | Dependencies                                                                              |
| -------------------- | ------------------------- | --------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1 — Content Snapshot | `npm run build:content`   | Sanity CMS via authenticated API        | `src/generated/contentSnapshot.json`               | `SANITY_API_READ_TOKEN`; `scripts/_lib/node-env.ts`; `scripts/_lib/sanity-node-client.ts` |
| 2 — Route Generation | `npm run build:routes`    | `contentSnapshot.json`                  | `.cache/routes.json`                               | Static routes (`/`, `/about`, `/contact`) + dynamic routes from content                   |
| 3 — Vite Build       | `npm run build:vite`      | React source, `contentSnapshot.json`    | `dist/index.html`, hashed `dist/assets/*.{js,css}` | VITE\_\* env vars                                                                         |
| 4 — Prerender        | `npm run build:prerender` | `dist/index.html`, `.cache/routes.json` | `dist/{route}/index.html` for every route          | Playwright Chromium; local server on port 4173                                            |
| 5 — Sitemap          | `npm run build:sitemap`   | `.cache/routes.json`, `VITE_SITE_URL`   | `dist/sitemap.xml`                                 | Route manifest; site URL                                                                  |

#### 2.3.2 Step 1 — build:content

The script `tsx scripts/build-content-snapshot.ts` loads environment variables via `getNodeEnv()` (Zod-validated, crashes on missing vars), initializes the Sanity node client with `useCdn: false` and `perspective: "published"`, executes all five GROQ queries, constructs a snapshot with `buildCommit`, `sanityDataset`, `generatedAt`, and content arrays, computes a SHA-256 content hash, and writes the result to `src/generated/contentSnapshot.json`.

#### 2.3.3 Step 2 — build:routes

The script `tsx scripts/generate-routes.ts` reads `contentSnapshot.json`, defines static routes (`/`, `/about`, `/contact`), generates dynamic routes (`/books/{slug}`, `/authors/{slug}`) from document slugs, and writes the concatenated array to `.cache/routes.json`.

#### 2.3.4 Step 3 — build:vite

The `vite build` command bundles React source, imports `contentSnapshot.json` as a module (enabling tree-shaking), inlines `VITE_*` variables into client JS, outputs hashed assets to `dist/assets/`, and generates `dist/index.html`.

#### 2.3.5 Step 4 — build:prerender

The script `tsx scripts/prerender.ts` reads `.cache/routes.json`, starts a static server on port 4173, launches Playwright Chromium, visits each route waiting for `networkidle`, captures rendered HTML, and writes it to `dist/{route}/index.html`. The Cloud Build step uses the pinned image `mcr.microsoft.com/playwright:v1.43.0-jammy`.

#### 2.3.6 Step 5 — build:sitemap

The script `tsx scripts/generate-sitemap.ts` reads routes and `VITE_SITE_URL`, generates XML with `<changefreq>weekly</changefreq>`, assigns `priority: 1.0` to root and `priority: 0.8` to all other routes, and writes to `dist/sitemap.xml`.

#### 2.3.7 Combined Build Script

The combined build script chains all five steps:

```json
"build": "npm run build:content && npm run build:routes && npm run build:vite && npm run build:prerender && npm run build:sitemap"
```

The `&&` operator provides fail-fast behavior: any non-zero exit aborts the pipeline immediately, preventing partial outputs from being packaged or deployed.

---

### 2.4 Security Functional Requirements

#### 2.4.1 VITE\_ Prefix Rule and Variable Classification

Vite inlines all `VITE_*` environment variables into the client JavaScript bundle at compile time via `import.meta.env.VITE_*`. This design enables public configuration in browser code, but creates a critical security boundary: any secret assigned a `VITE_` prefix is exposed to every visitor, visible in DevTools and stored permanently in the JS bundle.

| Variable                  | VITE\_ Prefix | Source                     | Used By                     | Classification                       |
| ------------------------- | ------------- | -------------------------- | --------------------------- | ------------------------------------ |
| `VITE_SANITY_PROJECT_ID`  | Yes           | `.env.local` / Cloud Build | Client JS, build scripts    | **Public** — visible in CDN URLs     |
| `VITE_SANITY_DATASET`     | Yes           | `.env.local` / Cloud Build | Client JS, build scripts    | **Public** — non-sensitive name      |
| `VITE_SANITY_API_VERSION` | Yes           | `.env.local` / Cloud Build | Client JS, build scripts    | **Public** — version string          |
| `VITE_SITE_URL`           | Yes           | `.env.local` / Cloud Build | Sitemap, SEO meta           | **Public** — canonical domain        |
| `VITE_APP_VERSION`        | Yes           | Cloud Build (`SHORT_SHA`)  | Client JS, Sentry release   | **Public** — git SHA                 |
| `SANITY_API_READ_TOKEN`   | **No**        | Secret Manager only        | `build-content-snapshot.ts` | **Secret** — NEVER use VITE\_ prefix |
| `SENTRY_AUTH_TOKEN`       | **No**        | Secret Manager (optional)  | Sentry Vite plugin          | **Secret** — source map upload only  |
| `PORT`                    | **No**        | Cloud Run (auto-set)       | nginx runtime               | **Non-secret** — auto-set to 8080    |

#### 2.4.2 SANITY_API_READ_TOKEN Validation

The token is declared in `scripts/_lib/node-env.ts` with Zod schema `z.string().min(1)` as a **required** field. The `getNodeEnv()` function validates at script startup. A missing or empty token crashes the build with exit code 1 and a descriptive error to stderr, preventing deployments with missing credentials.

#### 2.4.3 Token Scoping

Secret Manager injects `SANITY_API_READ_TOKEN` into **exactly one** Cloud Build step: step 4 (`content-snapshot`). The `secretEnv` binding applies only to this step. No other step — including Vite build, prerender, Docker build, push, or deploy — has access. This ensures the Docker build context, Cloud Run runtime, Vite bundler, and other Cloud Build steps cannot access the token.

#### 2.4.4 audit:secrets Script

The `audit:secrets` npm script scans compiled output for token leakage:

```json
"audit:secrets": "grep -rn \"SANITY_API_READ_TOKEN\" dist/assets/ && exit 1 || exit 0"
```

In Cloud Build, this runs as **step 9** (`audit-secrets`), between the build phase and Docker build. A match exits with code 1, aborting the pipeline before containerization.

#### 2.4.5 Exclude Lists

`.gitignore` excludes `src/generated/contentSnapshot.json`, `.env.local`, and `.env*.local`. `.dockerignore` excludes `node_modules/`, `.git/`, `.env*`, `*.md`, `docs/`, `scripts/`, `src/generated/contentSnapshot.json`, `.cache/`, IDE configs, and log files. These exclusions prevent generated files, local secrets, and build tooling from entering version control or Docker context.

#### 2.4.6 Log Configuration and Security Summary

The `cloudbuild.yaml` specifies `options.logging: CLOUD_LOGGING_ONLY`, preventing build logs from reaching the legacy GCS log bucket. Combined with `secretEnv` scoping, this ensures `SANITY_API_READ_TOKEN` never appears in persistent log storage.

| Requirement                  | Implementation                                                          | Verification                                               |
| ---------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| No secret uses VITE\_ prefix | `SANITY_API_READ_TOKEN` has no prefix; old name renamed across codebase | `grep -rn "VITE_SANITY_API_READ_TOKEN" src/` returns empty |
| Token required               | Zod `z.string().min(1)` on `SANITY_API_READ_TOKEN`                      | Build crashes with exit 1 if missing                       |
| Token scoped to one step     | `secretEnv` only on Cloud Build step 4                                  | `grep "secretEnv" cloudbuild.yaml` shows single occurrence |
| Audit catches leaks          | `audit:secrets` runs as Cloud Build step 9                              | Pipeline fails if token string found in `dist/assets/`     |
| Files excluded               | `.gitignore` and `.dockerignore` cover all generated files and secrets  | Git and Docker contexts are clean                          |
| Logs protected               | `CLOUD_LOGGING_ONLY` in build options                                   | No legacy GCS log bucket writes                            |

---

### 2.5 Container Functional Requirements

#### 2.5.1 Dockerfile Build Model

The production Dockerfile contains **no build commands**. It does not run `npm install`, `npm run build`, or any code generation. The Dockerfile copies the pre-built `dist/` directory into `nginx:1.27-alpine` and validates its presence. This minimizes image size (no Node.js, no `node_modules`), separates build and runtime environments, and allows independent `dist/` inspection.

#### 2.5.2 Hard Validation

After copying `dist/`, the Dockerfile executes:

```dockerfile
RUN test -f /usr/share/nginx/html/index.html || exit 1
```

A missing `dist/` or absent `index.html` fails the Docker build with exit code 1. There is no fallback — the build does not attempt alternative generation.

#### 2.5.3 Non-Root Execution

The container runs as **UID 1001 / GID 1001**, created via `addgroup` and `adduser` in the Dockerfile. The nginx PID file writes to `/tmp/nginx.pid` (writable by non-root users), and static files serve from `/usr/share/nginx/html/` with read permissions for UID 1001.

#### 2.5.4 Base Image and Port

The base image is **nginx:1.27-alpine**. Port **8080** is exposed. Cloud Run sets the `PORT` environment variable automatically; nginx consumes it via `envsubst` replacing `${PORT}` in `nginx.conf.template` with the runtime value.

---

### 2.6 Hosting & Routing Functional Requirements

#### 2.6.1 Firebase Hosting Configuration

The `firebase.json` uses `public: "public-placeholder"` (an empty directory). Firebase serves no static files directly. A wildcard rewrite routes all requests to Cloud Run:

```json
{
  "hosting": {
    "public": "public-placeholder",
    "rewrites": [
      {
        "source": "**",
        "run": { "serviceId": "mangu-publishers", "region": "us-central1", "pinTag": true }
      }
    ]
  }
}
```

The `pinTag: true` option creates a Cloud Run traffic tag per deployment, enabling atomic rollouts and instant rollback by retagging.

#### 2.6.2 SPA Fallback

The nginx `try_files` directive implements SPA fallback:

```nginx
try_files $uri $uri/ /index.html;
```

For non-asset routes (e.g., `/books/some-slug`), nginx checks for a file, then a directory, then falls back to `index.html`. The client-side React router handles route parsing. Deep links work on direct access or refresh, and search engines receive prerendered HTML per route.

#### 2.6.3 /healthz Endpoint

The `/healthz` endpoint returns HTTP 200 with body `ok` and `Cache-Control: no-store`, preventing cached stale health checks. Cloud Monitoring uses this for uptime verification.

#### 2.6.4 Immutable Asset Caching

Files under `/assets/*` return `Cache-Control: public, max-age=31536000, immutable`. The `immutable` directive allows indefinite caching without revalidation — safe because Vite generates content-hashed filenames (e.g., `index-a1b2c3d.js`), so any code change produces a new URL.

#### 2.6.5 Source Map Blocking

All `*.map` requests return HTTP 404. Source maps are generated during Vite build, uploaded to Sentry via `@sentry/vite-plugin`, then deleted from `dist/` via `filesToDeleteAfterUpload`. The deployed container contains no source maps, preventing source code exposure while preserving production error symbolication in Sentry.

#### 2.6.6 Security Headers

The nginx configuration sets five security headers on all responses: **Content-Security-Policy** (comprehensive resource restrictions), **X-Frame-Options: DENY** (clickjacking protection), **X-Content-Type-Options: nosniff** (MIME sniffing prevention), **Referrer-Policy: strict-origin-when-cross-origin**, and **Permissions-Policy** (browser feature restrictions).

#### 2.6.7 CSP Directives

The CSP reflects the build-time architecture: **`connect-src`** includes `'self'`, `*.sentry.io`, and `*.ingest.sentry.io` but **excludes `api.sanity.io`** because the runtime never contacts Sanity. **`img-src`** includes `cdn.sanity.io` for Portable Text images — a read-only public CDN requiring no authentication. **`style-src`** includes `'unsafe-inline'` for Tailwind/React (nonce-based CSP is a Phase 3 migration). **`script-src`** includes `'self'` for hashed JS bundles.

---

### 2.7 CI/CD Functional Requirements

#### 2.7.1 Cloud Build Trigger

The pipeline triggers on pushes to `^main$` via **Developer Connect GitHub integration**, replacing the legacy Cloud Build GitHub App. The trigger uses the dedicated `cloudbuild-mangu-publishers` service account with least-privilege IAM bindings.

#### 2.7.2 16-Step Pipeline

The `cloudbuild.yaml` defines a 16-step sequential pipeline with fail-fast behavior. Steps 1-10 are the **build phase**; steps 11-16 are the **deploy phase**.

| Step | ID                           | Name          | Purpose                                              | Image                                           |
| ---- | ---------------------------- | ------------- | ---------------------------------------------------- | ----------------------------------------------- |
| 1    | restore-npm-cache            | Restore cache | Pull npm cache from GCS                              | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` |
| 2    | install                      | Install deps  | `npm ci` with cache dir                              | `node:20`                                       |
| 3    | production-audit             | npm audit     | Non-blocking audit output                            | `node:20`                                       |
| 4    | content-snapshot             | Content fetch | Fetch Sanity content via secret token                | `node:20`                                       |
| 5    | generate-routes              | Route gen     | Read snapshot; write `.cache/routes.json`            | `node:20`                                       |
| 6    | vite-build                   | Vite build    | Bundle React; inject `VITE_APP_VERSION=${SHORT_SHA}` | `node:20`                                       |
| 7    | prerender                    | Prerender     | Playwright visits routes; write HTML shells          | `mcr.microsoft.com/playwright:v1.43.0-jammy`    |
| 8    | sitemap                      | Sitemap       | Generate `dist/sitemap.xml`                          | `node:20`                                       |
| 9    | audit-secrets                | Secret audit  | `grep dist/assets/` for token; fail if found         | `node:20`                                       |
| 10   | smoke-test                   | Smoke test    | Verify all routes have prerendered HTML              | `node:20`                                       |
| 11   | docker-build                 | Docker build  | Build nginx container with SHA+latest tags           | `gcr.io/cloud-builders/docker`                  |
| 12   | docker-push                  | Docker push   | Push both tags to Artifact Registry                  | `gcr.io/cloud-builders/docker`                  |
| 13   | enforce-vulnerability-policy | CVE scan      | Scan image; block on HIGH/CRITICAL                   | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` |
| 14   | deploy-run                   | Deploy        | Deploy SHA-tagged image to Cloud Run                 | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` |
| 15   | prune-tags                   | Tag prune     | Remove old Cloud Run tags; keep 50                   | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` |
| 16   | save-npm-cache               | Save cache    | Upload npm cache to GCS                              | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` |

#### 2.7.3 Vulnerability Scan Gate

Step 13 scans the container using Artifact Registry's on-demand scanning API. It executes `gcloud artifacts docker images scan` followed by `list-vulnerabilities`. Any finding with `CRITICAL` or `HIGH` severity triggers exit code 1, blocking the deploy step. The `ondemandscanning.googleapis.com` API must be enabled.

#### 2.7.4 Cloud Run Deployment Parameters

Step 14 deploys with: `--memory=512Mi` (gen2 minimum), `--concurrency=80`, `--min-instances=0`, `--max-instances=10`, `--execution-environment=gen2`, `--no-default-url` (eliminates direct `.run.app`), `--cpu=1`, `--cpu-boost`, `--port=8080`, and `--allow-unauthenticated`. The `512Mi` value reflects a correction from the v11 specification — gen2 requires a minimum of 512 MiB.

---

### 2.8 Monitoring & Alerting Functional Requirements

#### 2.8.1 Sentry Integration

Sentry provides error tracking and release monitoring. **Release tracking** uses `VITE_APP_VERSION=${SHORT_SHA}` (set in Cloud Build step 6), enabling per-deployment error tracking. **Hidden source maps** are generated by Vite, uploaded to Sentry via `@sentry/vite-plugin`, then deleted from `dist/` via `filesToDeleteAfterUpload`. The deployed container has no `.map` files. The Sentry React SDK captures runtime JS errors, unhandled promise rejections, and React component errors with release tags.

#### 2.8.2 Uptime Check

Cloud Monitoring checks `/healthz` every **60 seconds** with a **10-second timeout**, expecting HTTP 200. Failures trigger alert policy evaluation.

#### 2.8.3 Alert Policies

Four alert policies monitor the Cloud Run service: **5xx error rate** (> 5% over 5 minutes), **P99 latency** (> 2000ms over 5 minutes), **memory utilization** (> 85% of 512 MiB), and **instance count** (>= 8, approaching the `max-instances=10` ceiling). Alerts send email notifications to the engineering team with configured alignment periods to minimize false positives.

#### 2.8.4 Billing Budget Alerts

GCP Billing alerts fire at **50%, 75%, and 90%** of the monthly budget, emailing engineering and finance teams of potential cost overruns.

#### 2.8.5 Artifact Registry Cleanup

The cleanup policy retains the **15 most recent tagged images** and deletes **untagged images after 3 days** (259,200 seconds), preventing storage accumulation.

#### 2.8.6 Cloud Run Tag Pruning

Step 15 executes `scripts/ops/prune-cloud-run-tags.sh` with `KEEP=50`, querying Cloud Run for traffic tags, sorting by age, and removing tags beyond the 50-most-recent threshold. This prevents tag accumulation from hitting Cloud Run metadata limits.

## 3. Technical Architecture & Design Decisions

This chapter defines the technical architecture of the Mangu Publishers publishing platform, covering the system topology, technology selections, environment variable governance, architecture decision records, CI/CD pipeline design, and container runtime configuration.

### 3.1 System Architecture Overview

#### 3.1.1 Primary Deployment Pipeline

Mangu Publishers uses a **build-time content aggregation** model with a **static runtime** served through a multi-layer edge infrastructure. The deployment pipeline traverses eight stages: **GitHub → Developer Connect → Cloud Build → (Secret Manager + Sanity API) → dist/ → Docker → Artifact Registry → Cloud Run → Firebase Hosting (CDN + Custom Domain) → End User**.

Source code resides in GitHub as the single source of truth. **Developer Connect** authenticates to GitHub via OAuth and creates a repository link, enabling Cloud Build to listen for push events without storing credentials in GCP. When a commit is pushed to `main`, Developer Connect delivers a build trigger to Cloud Build.

Cloud Build executes a 16-step pipeline on an `E2_HIGHCPU_8` worker. Step 4 (`content-snapshot`) is the sole consumer of `SANITY_API_READ_TOKEN`, injected via Secret Manager. This step fetches all published content from Sanity and writes `src/generated/contentSnapshot.json`. Subsequent steps generate routes, run the Vite production build, prerender HTML shells, and produce `sitemap.xml`. The resulting `dist/` directory contains only static assets.

The Docker build (step 11) packages `dist/` into an `nginx:1.27-alpine` container. No build commands execute inside Docker. The image is pushed to **Artifact Registry** with both `${SHORT_SHA}` and `:latest` tags. Step 13 runs a vulnerability scan; HIGH or CRITICAL CVEs block deployment with `exit 1`. Step 14 deploys the SHA-tagged image to **Cloud Run** (`mangu-publishers`, `us-central1`, gen2). **Firebase Hosting** sits in front as a TLS-terminating reverse proxy; all requests match `"source": "**"` and rewrite to Cloud Run. The `--no-default-url` flag eliminates the direct `.run.app` endpoint.

#### 3.1.2 Content Update Path

Content changes follow an automated pipeline: **Sanity Studio → Webhook → Validator → Cloud Build Trigger → New Build → New Deployment**. When an editor publishes content, Sanity emits a webhook payload to a validator endpoint that performs HMAC signature verification and replay protection. Invalid payloads are rejected with 401/403. A validated webhook triggers a Cloud Build execution via the REST API, producing a fresh build. Time from publish to live site is approximately 3–5 minutes. Content staleness is bounded by webhook latency plus build duration.

#### 3.1.3 Runtime Traffic Flow

All end-user requests follow: **User → Firebase Hosting Edge → Cloud Run → nginx → static files**. The runtime container makes **no Sanity API calls**. The CSP `connect-src` directive excludes `*.api.sanity.io` because the runtime never contacts Sanity (consequence of ADR-001 and ADR-002). The container has **zero access to secrets**.

### 3.2 Technology Stack

**Table 1: Technology Stack Summary**

| Layer              | Technology          | Version       | Role                                                        |
| ------------------ | ------------------- | ------------- | ----------------------------------------------------------- |
| Frontend Framework | React               | 19            | UI component library with concurrent features               |
| Build Tool         | Vite                | 5.x           | Module bundler, dev server, tree-shaking                    |
| Styling            | Tailwind CSS        | 3.x           | Utility-first CSS with production purge                     |
| Language           | TypeScript          | 5.x           | Type-safe development for src/ and scripts/                 |
| Content CMS        | Sanity              | Current       | Headless CMS with GROQ query language                       |
| Content Rendering  | @portabletext/react | Current       | Portable Text to React component renderer                   |
| Script Execution   | tsx                 | 4.x           | Zero-config TypeScript execution for Node.js                |
| Prerendering       | Playwright          | v1.43.0-jammy | Headless Chromium for static HTML generation                |
| Local Server       | serve               | Current       | Lightweight static file server for dev                      |
| Container          | nginx               | 1.27-alpine   | Production static file server, minimal CVE footprint        |
| Container Platform | Cloud Run (gen2)    | —             | Serverless container with concurrency and traffic splitting |
| Edge/CDN           | Firebase Hosting    | —             | TLS termination, custom domain, global CDN                  |
| Image Registry     | Artifact Registry   | —             | Docker storage with immutable tags and CVE scanning         |
| Secrets            | Secret Manager      | —             | Encrypted storage with IAM-scoped access                    |
| CI/CD              | Cloud Build         | —             | 16-step pipeline with per-step secret scoping               |
| Error Tracking     | Sentry              | Current       | Frontend error monitoring with release tracking             |
| Monitoring         | Cloud Monitoring    | —             | Uptime checks, latency/5xx/memory alerting                  |
| Source Control     | GitHub              | —             | Repository with Developer Connect trigger integration       |

#### 3.2.1 Frontend: React 19 + Vite + Tailwind CSS + TypeScript

React 19 provides concurrent rendering and automatic batching. Vite serves as both the dev server (native ESM, instant HMR) and production bundler (Rollup-based, tree-shaken bundles with hashed asset filenames). Tailwind CSS is configured with content-aware purging, typically producing a CSS file under 10 KiB gzipped. TypeScript enforces strict mode across `src/` (browser) and `scripts/` (Node.js build tooling).

#### 3.2.2 Content: Sanity CMS with GROQ Queries

Sanity stores all content (books, authors, articles, metadata). GROQ queries execute server-side in Node.js build scripts; no queries run in the browser. Portable Text is rendered via **@portabletext/react**, which converts the JSON tree to React components. Images are served from `cdn.sanity.io` (read-only, no auth required).

#### 3.2.3 Build Tooling: tsx, Playwright, serve

Build scripts in `scripts/` execute with **tsx**, eliminating a separate compilation step. **Playwright** (pinned to `mcr.microsoft.com/playwright:v1.43.0-jammy` in Cloud Build) prerenders HTML shells by launching headless Chromium for each route. The pinned image ensures reproducible builds without OS package drift. **serve** provides local static file hosting during development.

#### 3.2.4 Container: nginx:1.27-alpine, Non-Root UID 1001

The production container uses **nginx:1.27-alpine** for its minimal CVE footprint. It runs as **non-root user UID 1001** (GID 1001), limiting the blast radius of container compromise. The nginx worker writes its PID to `/tmp/nginx.pid` (writable by UID 1001) and serves files from `/usr/share/nginx/html/`.

#### 3.2.5 Infrastructure: GCP Cloud Run, Firebase Hosting, Artifact Registry

**Cloud Run gen2** provides concurrency (80 requests/instance), traffic splitting, and CPU throttling — features unavailable in gen1. **Firebase Hosting** offers TLS termination and global CDN edge caching. **Artifact Registry** stores images with immutable tags and automated vulnerability scanning. **Secret Manager** holds `sanity-api-read-token` with IAM-scoped per-step access. **Cloud Build** orchestrates the pipeline. **Cloud Monitoring** provides uptime checks and alerting.

#### 3.2.6 Observability: Sentry and Cloud Monitoring

**Sentry** captures frontend errors with release tracking via `VITE_APP_VERSION` (git SHA). Source maps are uploaded during the Vite build and then deleted from `dist/` before Docker packaging. **Cloud Monitoring** checks `/healthz` every 60 seconds and alerts on 5xx rate, p99 latency, memory utilization, and instance count thresholds.

### 3.3 Environment Variable Architecture

The environment variable architecture enforces one security principle: **secrets must never reach the browser, Docker container, or Cloud Run runtime.** This is achieved through strict naming conventions, directory-level scoping, and build-step isolation.

#### 3.3.1 Complete Environment Variable Reference

**Table 2: Environment Variables Reference**

| Variable                  | Vite Prefix | Source                           | Used By                     | Required | Example                           |
| ------------------------- | ----------- | -------------------------------- | --------------------------- | -------- | --------------------------------- |
| `VITE_SANITY_PROJECT_ID`  | Yes         | `.env.local` / Cloud Build `env` | Client JS, build scripts    | Yes      | `abc123de`                        |
| `VITE_SANITY_DATASET`     | Yes         | `.env.local` / Cloud Build `env` | Client JS, build scripts    | Yes      | `production`                      |
| `VITE_SANITY_API_VERSION` | Yes         | `.env.local` / Cloud Build `env` | Client JS, build scripts    | Yes      | `2024-01-01`                      |
| `VITE_SITE_URL`           | Yes         | `.env.local` / Cloud Build `env` | Sitemap, SEO meta tags      | Yes      | `https://www.mangupublishers.com` |
| `VITE_APP_VERSION`        | Yes         | Cloud Build `${SHORT_SHA}`       | Client JS, Sentry release   | Yes      | `a1b2c3d`                         |
| `SANITY_API_READ_TOKEN`   | **No**      | **Secret Manager only**          | `build-content-snapshot.ts` | Yes      | `skProductionToken...`            |
| `SENTRY_AUTH_TOKEN`       | **No**      | Secret Manager (optional)        | Sentry Vite plugin          | Optional | `sntrys_...`                      |
| `PORT`                    | **No**      | Cloud Run (auto-injected)        | nginx `listen ${PORT}`      | Auto-set | `8080`                            |

#### 3.3.2 Public Variables (VITE\_ Prefix)

Variables with the `VITE_` prefix are inlined by Vite into the client-side bundle and are safe for public exposure. `VITE_SANITY_PROJECT_ID` is the Sanity project identifier (appears in CDN URLs). `VITE_SANITY_DATASET` is the dataset name. `VITE_SANITY_API_VERSION` is a date-based version pin preventing API breakage. `VITE_SITE_URL` is the canonical public URL used for sitemaps and OpenGraph. `VITE_APP_VERSION` is the 7-character git SHA injected by Cloud Build step 6; local dev uses `"local"`.

#### 3.3.3 Secret Variables (No VITE\_ Prefix)

Variables without the `VITE_` prefix are **not** inlined by Vite and are accessible only to Node.js build scripts via `process.env`.

`SANITY_API_READ_TOKEN` is the most sensitive credential in the system. Stored in Secret Manager as `sanity-api-read-token`, it is injected **only** into Cloud Build step 4 via `secretEnv`. It is unavailable to other steps, Docker, and Cloud Run. The `audit:secrets` script (step 9) scans `dist/assets/` for the string; if found, the build fails. Build scripts using this token live in `scripts/` — importing from `src/` would bundle the token into client JS, which is categorically prohibited.

`SENTRY_AUTH_TOKEN` is optional. If absent, source maps are generated but not uploaded. The build succeeds without it.

#### 3.3.4 Auto-Set Variables

`PORT` is injected automatically by Cloud Run at container startup (value: 8080). The nginx template uses it via `envsubst`. Never set manually.

#### 3.3.5 Variable Lifecycle Across Environments

Variables flow through three environments with progressively restricted secret access. **Local development** (`.env.local`, gitignored): all variables present, `VITE_APP_VERSION="local"`. **Cloud Build (CI)**: step 4 receives `SANITY_API_READ_TOKEN` via `secretEnv`; step 6 receives only `VITE_APP_VERSION`. No other step has secret access. `CLOUD_LOGGING_ONLY` prevents secret appearance in legacy GCS logs. **Cloud Run (runtime)**: receives no secret variables. Only the auto-injected `PORT` is present. `SANITY_API_READ_TOKEN` is never in the runtime environment.

### 3.4 Architecture Decision Records

#### 3.4.1 ADR-001: nginx-static over Node.js Runtime

**Context.** Mangu Publishers's deliverable is static HTML/CSS/JS fetched from Sanity at build time. Two runtime strategies were considered: a Node.js server (Express/Hono) allowing runtime server-side logic, or nginx serving pre-built files directly.

**Decision.** The production container uses **nginx-static**. The Dockerfile uses `nginx:1.27-alpine`, copies pre-built `dist/` assets, and runs as non-root UID 1001.

**Consequences.** Positive: **zero runtime secrets**, minimal CVE attack surface, faster cold starts (nginx starts in milliseconds), lower memory usage, and simplified CSP (no `connect-src` for Sanity). Negative: no runtime SSR, no runtime API endpoints, and content updates require a rebuild. Mitigation: the Sanity webhook auto-triggers Cloud Build on content changes, bounding staleness to ~3–5 minutes.

#### 3.4.2 ADR-002: No VITE\_ Prefix on SANITY_API_READ_TOKEN

**Context.** Vite inlines all `VITE_`-prefixed variables into the client bundle. The Sanity read token is a secret with read access to all published content.

**Decision.** The variable is named **`SANITY_API_READ_TOKEN`** — no `VITE_` prefix. Vite ignores it; only Node.js build scripts in `scripts/` can access it via `process.env`.

**Consequences.** The token never appears in `dist/assets/*.js`, Docker layers, Cloud Run env, or Cloud Build logs. The tradeoff: build scripts must live in `scripts/` (not `src/`), and token rotation requires `gcloud secrets versions add`. The `audit:secrets` script (step 9) enforces this at build time.

#### 3.4.3 ADR-003: 512Mi Memory for Cloud Run gen2

**Context.** The v11 spec specified `--memory=256Mi`, which caused deployment failure: "For 1.0 CPU, memory must be between 512Mi and 4Gi." Gen2 requires a 512 MiB minimum.

**Decision.** Set `--memory=512Mi` in the deploy step. This is the gen2 minimum.

**Consequences.** Deployment succeeds. nginx uses <50Mi normally, so 512Mi provides ample headroom. Cloud Run bills for actual usage, not allocation, so cost impact is negligible for a lightly loaded service.

#### 3.4.4 ADR-004: Infrastructure-First over Content-First

**Context.** Two strategies: content-first (build Sanity schemas, then GCP) versus infrastructure-first (provision GCP, then content).

**Decision.** **Infrastructure-first.** Milestone 4 (GCP Foundation) completes before Milestone 5. Secret Manager must exist before Cloud Build can access tokens; Artifact Registry must exist before `docker push`; Developer Connect OAuth is a manual prerequisite.

**Consequences.** Content editors and engineers work in parallel. Early pipeline validation proves the full chain (GitHub → Cloud Build → Secret Manager → Sanity → Docker → Artifact Registry → Cloud Run) before content complexity is introduced. The first deploy may show an empty site, which is acceptable for pipeline validation.

#### 3.4.5 ADR-005: public-placeholder Directory for Firebase Hosting

**Context.** Firebase Hosting requires a `public` directory even when all routes rewrite to Cloud Run. Options: point `public` at `dist/` (uploads all assets to Firebase CDN) or use an empty directory.

**Decision.** Use **`public-placeholder/`** — empty, containing only `.gitkeep`. All traffic rewrites to Cloud Run via `"source": "**"` with `pinTag: true`.

**Consequences.** Single source of truth: all content served from Cloud Run running the exact Docker image. No asset duplication. Security headers are set by nginx consistently. The tradeoff is slightly higher latency (every request traverses Firebase → Cloud Run), which is negligible for a publishing site.

#### 3.4.6 ADR-006: CLOUD_LOGGING_ONLY in Cloud Build

**Context.** Cloud Build has two logging modes: LEGACY (logs in Cloud Logging + GCS bucket) and CLOUD_LOGGING_ONLY (Cloud Logging only). GCS buckets have broader IAM permissions.

**Decision.** Set **`options.logging: CLOUD_LOGGING_ONLY`** in `cloudbuild.yaml`.

**Consequences.** Reduced secret exposure surface — legacy GCS buckets are bypassed. Real-time log streaming. Direct Cloud Monitoring integration. Tradeoff: no long-term GCS archive (30-day Cloud Logging retention by default). The content-snapshot step does not echo the token.

#### 3.4.7 ADR-007: No Fallback Build in Dockerfile

**Context.** v10 Dockerfiles included `RUN test -d dist || (npm ci && npm run build)` — a fallback that introduced security risks.

**Decision.** The Dockerfile contains **no build commands**: no `npm install`, no `npm run build`, no `npm ci`, no fallback. It only sets up the non-root user, copies `dist/`, validates `index.html` exists, and starts nginx.

**Consequences.** No secrets in Docker context (the Dockerfile cannot access `SANITY_API_READ_TOKEN`). Deterministic builds. Faster Docker builds (just COPY + validation). Smaller image (no `node_modules/`). Clear failure: missing `dist/` causes immediate, unambiguous error. The tradeoff: local builds require pre-built `dist/`.

### 3.5 Cloud Build Pipeline Architecture

#### 3.5.1 Pipeline Step Reference

**Table 3: Cloud Build Pipeline Step Reference**

| Step # | ID                           | Name                 | Purpose                       | Critical Config                               |
| ------ | ---------------------------- | -------------------- | ----------------------------- | --------------------------------------------- |
| 1      | restore-npm-cache            | Restore npm Cache    | Restores cache from GCS       | `gsutil cp` from `${_CACHE_BUCKET}`           |
| 2      | install                      | Install Dependencies | Runs `npm ci`                 | `node:20`; `--no-audit --no-fund`             |
| 3      | production-audit             | Production Audit     | Audits prod deps              | Non-blocking (`\|\| true`)                    |
| 4      | content-snapshot             | Content Snapshot     | Fetches Sanity content        | **`secretEnv` only — sole secret consumer**   |
| 5      | generate-routes              | Generate Routes      | Outputs `.cache/routes.json`  | Consumes content snapshot                     |
| 6      | vite-build                   | Vite Build           | Compiles to `dist/`           | Sets `VITE_APP_VERSION=${SHORT_SHA}`          |
| 7      | prerender                    | Prerender HTML       | Renders static HTML per route | Pinned `playwright:v1.43.0-jammy`             |
| 8      | sitemap                      | Generate Sitemap     | Produces `dist/sitemap.xml`   | Uses `VITE_SITE_URL`                          |
| 9      | audit-secrets                | Secret Audit         | Scans for leaked secrets      | **Build fails (exit 1) if found**             |
| 10     | smoke-test                   | Smoke Tests          | Validates build output        | `npm run smoke:check-routes`                  |
| 11     | docker-build                 | Docker Build         | Packages `dist/` into nginx   | No build commands; COPY only                  |
| 12     | docker-push                  | Docker Push          | Pushes to Artifact Registry   | Tags: `${SHORT_SHA}` and `latest`             |
| 13     | enforce-vulnerability-policy | Vulnerability Scan   | Checks for HIGH/CRITICAL CVEs | **Blocks deploy with exit 1**                 |
| 14     | deploy-run                   | Deploy to Cloud Run  | Deploys SHA-tagged image      | `--memory=512Mi --execution-environment=gen2` |
| 15     | prune-tags                   | Prune Tags           | Removes old traffic tags      | Keeps 50 most recent                          |
| 16     | save-npm-cache               | Save npm Cache       | Archives cache to GCS         | `gsutil cp` to `${_CACHE_BUCKET}`             |

#### 3.5.2 Security-Critical Step Sequencing

The pipeline enforces: **secret consumption → build → audit → containerization → scan → deploy**. Step 4 is the sole secret consumer. Steps 5–10 operate without secret access. Step 9 scans `dist/assets/` for `"SANITY_API_READ_TOKEN"`; a match halts the pipeline. Step 11 receives only pre-built `dist/` with no secrets in the Docker context. Step 13 blocks deployment on HIGH/CRITICAL CVEs.

#### 3.5.3 Substitution Variables

Four substitutions in `cloudbuild.yaml`: `_REGION: us-central1`, `_AR_REPO: web-images`, `_SERVICE: mangu-publishers`, `_CACHE_BUCKET: mangu-publishers-cloudbuild-cache`. Built-ins: `${PROJECT_ID}`, `${SHORT_SHA}` (7-char git SHA for tagging and `VITE_APP_VERSION`).

#### 3.5.4 Build Options

`machineType: E2_HIGHCPU_8` provides 8 vCPUs for Vite, Playwright, and scanning. `timeout: 1800s` (30 minutes) accommodates cold builds. `logging: CLOUD_LOGGING_ONLY` prevents secret leakage in legacy GCS log buckets (ADR-006).

### 3.6 Container Architecture

#### 3.6.1 nginx Configuration

The `nginx.conf.template` uses `listen ${PORT}` (substituted via `envsubst` at startup). A `/healthz` location returns 200 `"ok"` with `Cache-Control: no-store`. The CSP header includes `connect-src 'self' https://*.sentry.io` but **excludes** `*.api.sanity.io` (runtime never contacts Sanity). `img-src` includes `https://cdn.sanity.io` for Portable Text images. `style-src 'unsafe-inline'` supports Tailwind/React (nonce-based CSP in Phase 3). Security headers include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`. `/assets/*` gets `Cache-Control: public, max-age=31536000, immutable`. `*.map` returns 404 (source maps deleted after Sentry upload). SPA fallback uses `try_files $uri $uri/ /index.html`.

#### 3.6.2 Dockerfile Layers

`FROM nginx:1.27-alpine` → `RUN addgroup -g 1001` and `adduser -u 1001` → `WORKDIR /usr/share/nginx/html` → `COPY dist/ .` → `RUN test -f index.html || exit 1` → `USER 1001` → `EXPOSE 8080` → `CMD envsubst` + `nginx`. No `npm install`, no build commands, no fallback. The container serves exactly what Cloud Build produced.

#### 3.6.3 Cloud Run Service Configuration

**Table 4: Cloud Run Service Configuration**

| Parameter                 | Value                             | Rationale                                 |
| ------------------------- | --------------------------------- | ----------------------------------------- |
| `--image`                 | SHA-tagged from Artifact Registry | Immutable deployment reference            |
| `--region`                | `us-central1`                     | Resource co-location                      |
| `--allow-unauthenticated` | `true`                            | Public website                            |
| `--port`                  | `8080`                            | Matches nginx configuration               |
| `--cpu`                   | `1`                               | Sufficient for static serving             |
| `--memory`                | `512Mi`                           | Gen2 minimum (ADR-003)                    |
| `--concurrency`           | `80`                              | Max concurrent requests per instance      |
| `--min-instances`         | `0`                               | Scale-to-zero for cost optimization       |
| `--max-instances`         | `10`                              | Hard cap preventing runaway costs         |
| `--execution-environment` | `gen2`                            | Concurrency, traffic splitting, CPU boost |
| `--no-default-url`        | `true`                            | Forces Firebase Hosting access only       |
| `--cpu-boost`             | `true`                            | Reduced cold start latency                |
| `--labels`                | `env=prod,app=mangu-publishers`   | Cost attribution                          |

The service scales from 0 to 10 instances based on request load. With concurrency=80, 1–2 instances handle normal load. `--min-instances=0` eliminates idle cost; `--cpu-boost` and nginx's sub-millisecond startup mitigate cold start latency. `pinTag: true` enables instant rollback by retagging a previous deployment. Cloud Monitoring checks `/healthz` every 60 seconds and replaces unhealthy instances automatically.

## 4. Milestone Implementation Plan

This chapter defines the executable work plan for delivering the Mangu Publishers Phase 2 architecture. The plan is organized into eight milestones — Milestone 0 (pre-flight setup) followed by seven delivery milestones (M1 through M7). Each milestone specifies a concrete goal, a task table with exact commands and file operations, and verifiable exit criteria. The critical path is sequential: M1 through M6 must complete in order, with M7 representing post-launch hardening. M4 (GCP Foundation) has no dependency on local code changes and may be executed in parallel with M1–M3 to reduce wall-clock time.

---

### 4.1 Milestone 0 — Pre-flight Setup

Milestone 0 is a one-time preparatory phase executed before any code changes enter the repository. Its purpose is to verify access credentials, install local tooling, audit the current repository state, and stage all externally authored configuration files. None of the work in M0 produces commits to the project repository; it creates the conditions under which M1–M7 can proceed without interruption.

#### 4.1.1 Account Verification Checklist

Four external accounts must be verified before work begins. Each check is a gate: failure at any point blocks all subsequent milestones.

**GitHub repository access.** Confirm read and write access to the `redinc23/my_publishing` repository. This repository is the single source of truth for all code and is referenced by the Developer Connect configuration in M4. Execute:

```bash
git clone https://github.com/redinc23/my_publishing.git /tmp/my_publishing
```

A successful clone confirms SSH key or HTTPS credential validity and establishes that the repository is accessible from the local environment. If the clone fails, resolve authentication (SSH key setup or personal access token) before proceeding.

**Sanity project access.** Log in to `sanity.io/manage` and navigate to the Mangu Publishers project. Confirm visibility of the Project ID under Project Settings and the ability to create API tokens under API → Tokens. The Project ID and dataset name are required for `.env.local` configuration in M2. Token creation capability is required to generate the `SANITY_API_READ_TOKEN`.

**GCP project and billing verification.** Confirm that the active `gcloud` project is the target project and that a billing account is linked:

```bash
gcloud config get-value project
gcloud beta billing projects describe $(gcloud config get-value project)
```

Both commands must return without error. The billing command must show `billingEnabled: true`. All M4–M7 work runs in this project.

**Domain registrar access.** Confirm access to the DNS configuration panel for the target custom domain (e.g., `www.yourdomain.com`). M6 requires adding A records or CNAME records provided by Firebase Hosting. Inability to modify DNS records blocks the custom domain step of M6.

#### 4.1.2 Local Tool Installation

The following tools must be installed and functional on the local development workstation:

| Tool           | Version / Spec  | Installation Command                                  | Verification         |
| -------------- | --------------- | ----------------------------------------------------- | -------------------- |
| Node.js        | 20.x (LTS)      | `nvm install 20 && nvm use 20`                        | `node --version`     |
| tsx            | latest (global) | `npm install -g tsx`                                  | `tsx --version`      |
| firebase-tools | latest (global) | `npm install -g firebase-tools`                       | `firebase --version` |
| gcloud CLI     | latest          | Google Cloud SDK installer                            | `gcloud version`     |
| Docker Desktop | 4.x or later    | docker.com/products/docker-desktop                    | `docker --version`   |
| jq             | 1.6 or later    | `brew install jq` (macOS) or `apt install jq` (Linux) | `jq --version`       |

**Authentication requirements.** After installing the gcloud CLI, authenticate with both user credentials and application default credentials:

```bash
gcloud auth login
gcloud auth application-default login
```

Docker Desktop must be running before M3 container verification. Verify with `docker info` returning daemon status.

#### 4.1.3 One-time Repository Audit

Execute the following six commands from the repository root. Save the output to a file (e.g., `audit-output.txt`) for reference throughout the implementation.

```bash
# 1. Find all occurrences of the old insecure token variable name
grep -rn "VITE_SANITY_API_READ_TOKEN" . \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  --include="*.env*" --include="*.yaml" --include="*.yml" \
  --exclude-dir=node_modules --exclude-dir=.git

# 2. Check current build scripts
cat package.json | grep -A 30 '"scripts"'

# 3. Check scripts/ directory state
ls -la scripts/ 2>/dev/null || echo "scripts/ directory does not exist yet"
ls -la scripts/_lib/ 2>/dev/null || echo "scripts/_lib/ does not exist yet"

# 4. Check .gitignore for required entries
cat .gitignore | grep -E "contentSnapshot|env.local|env\*.local" || echo "Missing gitignore entries"

# 5. Check .dockerignore
cat .dockerignore 2>/dev/null || echo ".dockerignore does not exist yet"

# 6. Verify node-env.ts and sanity-node-client.ts presence
ls scripts/_lib/node-env.ts scripts/_lib/sanity-node-client.ts 2>/dev/null || echo "Files not yet in repo"
```

The audit output establishes a baseline. It identifies every file that requires modification in M1 and confirms which preparatory files are already present versus those that must be copied from the Drive folder.

#### 4.1.4 Stage Drive Files Locally

Download all eight code and configuration files from the shared Drive folder into a local `_drive_files/` directory outside the repository. These files are authored externally and are copied into the repository at specific milestones.

| File                           | Milestone Used | Purpose                                               |
| ------------------------------ | -------------- | ----------------------------------------------------- |
| `cloudbuild.yaml`              | M5             | 16-step Cloud Build pipeline definition               |
| `Dockerfile`                   | M3             | nginx container build specification                   |
| `nginx.conf.template`          | M3             | nginx runtime configuration with CSP and SPA fallback |
| `firebase.json`                | M6             | Firebase Hosting rewrite configuration                |
| `artifact-cleanup-policy.json` | M4, M7         | Artifact Registry lifecycle policy                    |
| `node-env.ts`                  | M1             | Zod-based environment validation (build-time only)    |
| `sanity-node-client.ts`        | M1             | Build-time Sanity client with `useCdn: false`         |
| `prune-cloud-run-tags.sh`      | M7             | Cloud Run traffic tag pruning script                  |

Store `_drive_files/` in the home or projects directory — not inside the repository. This prevents accidental commits of configuration files that belong at specific paths within the repo.

---

### 4.2 Milestone 1 — Local Security Hardening

**Goal:** The `SANITY_API_READ_TOKEN` is never exposed to the browser bundle. All secret-handling infrastructure is verified locally before any cloud infrastructure work begins.

Milestone 1 addresses the most critical security vulnerability in the Phase 1 codebase: the Sanity read token is prefixed with `VITE_`, which causes Vite to inline the value into client-side JavaScript at build time. The fix renames the variable, introduces Zod-based validation, establishes defensive ignore files, and adds an automated audit script that runs on every build.

| #   | Task                                                          | Operation                                                                                 | Verification                                                            |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1.1 | Rename `VITE_SANITY_API_READ_TOKEN` → `SANITY_API_READ_TOKEN` | `find . -type f -exec sed -i 's/VITE_SANITY_API_READ_TOKEN/SANITY_API_READ_TOKEN/g' {} +` | `grep -rn "VITE_SANITY_API_READ_TOKEN" .` returns empty                 |
| 1.2 | Create `scripts/_lib/` directory                              | `mkdir -p scripts/_lib`                                                                   | `ls -la scripts/_lib/` succeeds                                         |
| 1.3 | Copy `node-env.ts` from Drive                                 | `cp _drive_files/node-env.ts scripts/_lib/node-env.ts`                                    | Zod validation throws on missing token                                  |
| 1.4 | Copy `sanity-node-client.ts` from Drive                       | `cp _drive_files/sanity-node-client.ts scripts/_lib/sanity-node-client.ts`                | Imports from `node-env.ts`; `useCdn: false`, `perspective: "published"` |
| 1.5 | Add `.gitignore` entries                                      | Append 3 lines to `.gitignore`                                                            | `grep` checks confirm all entries present                               |
| 1.6 | Create `.dockerignore`                                        | `cat > .dockerignore << 'EOF'` (heredoc with 11 lines)                                    | `cat .dockerignore` shows correct content                               |
| 1.7 | Add `audit:secrets` npm script                                | Add to `package.json` scripts block                                                       | `npm run audit:secrets` exits 0                                         |

#### 4.2.1 Variable Rename Across All Files

The rename operation targets all source files. The `find` command restricts to TypeScript, JavaScript, YAML, and environment files while excluding `node_modules/` and `.git/`. macOS users must use `sed -i ''` (note the empty string argument); Linux users use `sed -i` without the empty string.

After running the rename, verification must produce zero results:

```bash
grep -rn "VITE_SANITY_API_READ_TOKEN" . \
  --exclude-dir=node_modules --exclude-dir=.git
# EXPECTED: No output
```

The absence of output confirms that no file in the repository still references the old variable name. This is a hard gate: M1 is not complete until this grep returns nothing.

#### 4.2.2 Create `scripts/_lib/` and Copy Build-time Library Files

The `scripts/_lib/` directory contains code that runs exclusively in Node.js at build time. It must never be imported by files in `src/` (browser code). Copy both files from the staged Drive folder:

```bash
cp _drive_files/node-env.ts scripts/_lib/node-env.ts
cp _drive_files/sanity-node-client.ts scripts/_lib/sanity-node-client.ts
```

**`node-env.ts`** defines `getNodeEnv()`, a Zod-validated environment parser. The `SANITY_API_READ_TOKEN` field is `z.string().min(1)` — a required non-empty string. If the variable is unset or empty, `getNodeEnv()` throws a `ZodError` with a descriptive message, crashing the build before any content snapshot can proceed.

**`sanity-node-client.ts`** imports `getNodeEnv()` and creates a Sanity client configured with `useCdn: false` (always fetch fresh data at build time) and `perspective: "published"` (exclude drafts from the content snapshot). This client is used exclusively by `build-content-snapshot.ts` in M2.

Verify both files are present:

```bash
ls -la scripts/_lib/node-env.ts scripts/_lib/sanity-node-client.ts
```

#### 4.2.3 `.gitignore` Additions

Append three entries to `.gitignore`:

```
# Sanity content snapshot (generated at build time, not committed)
src/generated/contentSnapshot.json

# Local environment files with secrets
.env.local
.env*.local
```

The `src/generated/contentSnapshot.json` file is produced by the content snapshot script in M2 and changes on every build. Committing it would create unnecessary churn and could expose content structure. Environment files contain the actual `SANITY_API_READ_TOKEN` value and must never be tracked.

Verify with:

```bash
grep "contentSnapshot" .gitignore && echo "OK" || echo "MISSING"
grep "env.local" .gitignore && echo "OK" || echo "MISSING"
```

#### 4.2.4 `.dockerignore` Contents

Create `.dockerignore` with the following exact contents:

```
node_modules/
.git/
.env*
*.md
docs/
scripts/
src/generated/contentSnapshot.json
.cache/
.vscode/
.idea/
*.log
```

This file prevents the Docker build context from including files that do not belong in the container image. Critically, `scripts/` and `src/generated/contentSnapshot.json` are excluded because the container receives only the finished `dist/` directory — no build scripts, no generated artifacts, no source code. The `.env*` pattern blocks all environment files, including any that contain secrets.

#### 4.2.5 `audit:secrets` Script

Add the following entry to the `"scripts"` section of `package.json`:

```json
"audit:secrets": "grep -rn \"SANITY_API_READ_TOKEN\" dist/assets/ && exit 1 || exit 0"
```

This script searches the compiled `dist/assets/` directory for any occurrence of the secret token name. If a match is found, the script exits with code 1 (failure); otherwise it exits with code 0 (pass). The script is integrated into the Cloud Build pipeline in M5 as step 9, running after the Vite build and prerender steps but before the Docker build. This placement ensures that a leaked secret blocks containerization and deployment.

#### 4.2.6 Exit Criteria

Milestone 1 is complete when all four criteria are satisfied:

1. `grep -rn "VITE_SANITY_API_READ_TOKEN" .` returns no output — the old variable name is fully eliminated.
2. `npm run audit:secrets` exits with code 0 — no leaked secret names in `dist/assets/`.
3. `scripts/_lib/node-env.ts` and `scripts/_lib/sanity-node-client.ts` exist and are functional.
4. `SANITY_API_READ_TOKEN="" node -e "require('./scripts/_lib/node-env.ts').getNodeEnv()"` throws a validation error.

Commit at this point with message `feat: milestone 1 - local security hardening`.

---

### 4.3 Milestone 2 — Build Pipeline Scripts

**Goal:** Five npm scripts run in deterministic sequence and produce a complete `dist/` directory containing prerendered HTML shells, hashed static assets, and a sitemap.

Milestone 2 establishes the entire build-time content pipeline. The pipeline is designed to run identically in local development and in Cloud Build (M5). Each script reads the output of the previous step, creating a linear dependency chain: content snapshot → route list → Vite build → prerender → sitemap.

| #   | Task                                | Script File                         | npm Script               | Output                               |
| --- | ----------------------------------- | ----------------------------------- | ------------------------ | ------------------------------------ |
| 2.1 | Update `package.json` scripts block | —                                   | 8 entries in `"scripts"` | Pipeline definition                  |
| 2.2 | Create `build-content-snapshot.ts`  | `scripts/build-content-snapshot.ts` | `build:content`          | `src/generated/contentSnapshot.json` |
| 2.3 | Create `generate-routes.ts`         | `scripts/generate-routes.ts`        | `build:routes`           | `.cache/routes.json`                 |
| 2.4 | Create `prerender.ts`               | `scripts/prerender.ts`              | `build:prerender`        | `dist/{route}/index.html`            |
| 2.5 | Create `generate-sitemap.ts`        | `scripts/generate-sitemap.ts`       | `build:sitemap`          | `dist/sitemap.xml`                   |
| 2.6 | Create `check-routes.ts`            | `scripts/smoke/check-routes.ts`     | `smoke:check-routes`     | Console pass/fail                    |
| 2.7 | Create `.env.local`                 | `.env.local`                        | —                        | Local environment config             |
| 2.8 | Run full pipeline                   | —                                   | `npm run build`          | Complete `dist/` directory           |

#### 4.3.1 `package.json` Scripts Block

Replace the `"scripts"` section in `package.json` with the following:

```json
{
  "scripts": {
    "dev": "vite",
    "build:content": "tsx scripts/build-content-snapshot.ts",
    "build:routes": "tsx scripts/generate-routes.ts",
    "build:vite": "vite build",
    "build:prerender": "tsx scripts/prerender.ts",
    "build:sitemap": "tsx scripts/generate-sitemap.ts",
    "build": "npm run build:content && npm run build:routes && npm run build:vite && npm run build:prerender && npm run build:sitemap",
    "audit:secrets": "grep -rn \"SANITY_API_READ_TOKEN\" dist/assets/ && exit 1 || exit 0",
    "smoke:check-routes": "tsx scripts/smoke/check-routes.ts"
  }
}
```

Install `tsx` as a development dependency if not already present:

```bash
npm install --save-dev tsx
```

#### 4.3.2 `build-content-snapshot.ts`

This script fetches all published content from Sanity and writes a snapshot JSON file. It is the **only** location in the entire pipeline where `SANITY_API_READ_TOKEN` is used.

The script imports `sanityNodeClient` from `scripts/_lib/sanity-node-client.ts` and fetches books and authors using GROQ queries. The snapshot object contains:

| Field           | Source                                      | Purpose                                                  |
| --------------- | ------------------------------------------- | -------------------------------------------------------- |
| `buildCommit`   | `process.env.VITE_APP_VERSION` or `"local"` | Traceability: identifies which commit produced the build |
| `sanityDataset` | `env.VITE_SANITY_DATASET`                   | Identifies which Sanity dataset was the content source   |
| `generatedAt`   | `new Date().toISOString()`                  | Timestamp for cache invalidation decisions               |
| `contentHash`   | SHA-256 of the serialized snapshot JSON     | Cache-busting key for downstream consumers               |

The `contentHash` is computed as the hex digest of `SHA256(JSON.stringify(snapshot))`. This hash changes whenever any content field changes, providing a reliable signal for cache invalidation and build comparison.

#### 4.3.3 `generate-routes.ts`

This script reads `src/generated/contentSnapshot.json` and produces `.cache/routes.json`, a flat array of all URL paths that the site must serve. The route list includes:

- **Static routes**: `/`, `/about`, `/contact` — always present regardless of content.
- **Dynamic routes**: `/books/{slug}` and `/authors/{slug}` — derived from the `slug.current` field of each book and author document in the snapshot.

The output format is a JSON array of strings. The prerender script (step 2.4) and the sitemap generator (step 2.5) both consume this file as their input.

#### 4.3.4 `prerender.ts`

This script generates static HTML shells for every route in `.cache/routes.json`. It uses **Playwright Chromium** to render each route and capture the final HTML:

```bash
npm install --save-dev playwright serve
npx playwright install chromium
```

The script starts a local static file server (`npx serve dist`) on port 4173, then launches a headless Chromium browser via Playwright. For each route, it navigates to `http://localhost:4173{route}`, waits for `networkidle`, captures the rendered HTML, and writes it to `dist/{route}/index.html`. After all routes are processed, the server process is killed.

The wait condition is `networkidle` with a 30-second timeout, ensuring that client-side hydration completes before HTML capture. For the root route (`/`), the output is written to `dist/index.html` directly.

#### 4.3.5 `generate-sitemap.ts`

This script reads `.cache/routes.json` and writes `dist/sitemap.xml` with proper XML structure, including `<?xml version="1.0" encoding="UTF-8"?>` and the `http://www.sitemaps.org/schemas/sitemap/0.9` namespace. Each URL entry includes `<loc>`, `<changefreq>` (set to `weekly`), and `<priority>` (1.0 for `/`, 0.8 for all other routes). The site URL base is read from `VITE_SITE_URL` in the environment configuration.

#### 4.3.6 `smoke/check-routes.ts`

This verification script confirms that every route in `.cache/routes.json` has a corresponding `index.html` file in `dist/`. It iterates the route list, constructs the expected file path for each route, and checks existence with `fs.existsSync`. Any missing file causes the script to log an error and exit with code 1. A successful run exits with code 0.

#### 4.3.7 `.env.local` Template

Create `.env.local` at the repository root (this file is gitignored by M1):

```bash
cat > .env.local << 'EOF'
# Public Sanity config (safe to bundle into client JS)
VITE_SANITY_PROJECT_ID=your-project-id
VITE_SANITY_DATASET=production
VITE_SANITY_API_VERSION=2024-01-01
VITE_SITE_URL=http://localhost:5173

# Secret: read token for build-time scripts only
SANITY_API_READ_TOKEN=your-actual-token-here

# Build version (set by Cloud Build in CI)
VITE_APP_VERSION=local
EOF
```

Replace `your-project-id` with the actual Sanity Project ID and `your-actual-token-here` with a Sanity read token created via Sanity Studio → API → Tokens with role "Viewer". Confirm `.env.local` is not tracked by git: `git status` must not list it.

#### 4.3.8 Exit Criteria

Milestone 2 is complete when all of the following are verified:

1. `dist/index.html` exists and contains valid HTML.
2. `dist/sitemap.xml` exists and contains entries for all routes.
3. `.cache/routes.json` exists and contains the expected route count.
4. `src/generated/contentSnapshot.json` exists with `contentHash`, `buildCommit`, and `sanityDataset` fields populated.
5. `dist/assets/` contains hashed JavaScript and CSS files (e.g., `index-abc123.js`).
6. Prerendered HTML shells exist for every dynamic route (e.g., `dist/books/some-slug/index.html`).
7. `npm run smoke:check-routes` exits 0.
8. `npm run audit:secrets` exits 0.

---

### 4.4 Milestone 3 — Runtime Container

**Goal:** A hardened nginx container that serves only pre-built static files from `dist/`. The build fails hard if `dist/` is absent, ensuring there is never a fallback to runtime builds inside the container.

Milestone 3 introduces the production runtime artifact: a Docker image based on `nginx:1.27-alpine` that runs as a non-root user and serves the contents of `dist/` over port 8080. The container contains no Node.js runtime, no build tools, and no secrets.

| #    | Task                                  | Operation                                                                          | Verification                                         |
| ---- | ------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 3.1  | Copy `Dockerfile` from Drive          | `cp _drive_files/Dockerfile .`                                                     | `ls Dockerfile` succeeds                             |
| 3.2  | Copy `nginx.conf.template` from Drive | `cp _drive_files/nginx.conf.template .`                                            | `ls nginx.conf.template` succeeds                    |
| 3.3  | Build image with `dist/` present      | `docker build -t mangu-publishers-test .`                                          | Build succeeds                                       |
| 3.4  | Verify hard-fail without `dist/`      | `mv dist dist-backup && docker build -t mangu-publishers-fail .`                   | Build fails with missing-file error                  |
| 3.5  | Run container locally                 | `docker run -d -p 8080:8080 --name mangu-publishers-local mangu-publishers-test`   | Container starts, `docker ps` shows it               |
| 3.6  | Verify health check                   | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/healthz`             | Returns `200`                                        |
| 3.7  | Verify CSP excludes Sanity API        | `curl -sI http://localhost:8080/ \| grep -i "content-security-policy"`             | Does NOT contain `api.sanity.io`                     |
| 3.8  | Verify asset cache headers            | `curl -sI http://localhost:8080/assets/{hashed-file}`                              | `Cache-Control: public, max-age=31536000, immutable` |
| 3.9  | Verify source map 404                 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/assets/index.js.map` | Returns `404`                                        |
| 3.10 | Verify non-root user                  | `docker exec mangu-publishers-local id`                                            | Shows `uid=1001`                                     |

#### 4.4.1 Dockerfile Specification

The Dockerfile is based on `nginx:1.27-alpine` and contains no build logic. Key attributes:

- **Non-root execution**: `USER 1001` is set after installing packages and creating required directories. The nginx worker process runs as UID 1001 / GID 1001.
- **Hard validation**: After `COPY dist/ /usr/share/nginx/html/`, a `RUN` instruction executes `test -f /usr/share/nginx/html/index.html || exit 1`. If `dist/` is missing or empty, this instruction fails and the Docker build aborts.
- **Port 8080**: `EXPOSE 8080` matches the Cloud Run `PORT` environment variable default.
- **No fallback**: The Dockerfile contains no `npm install`, no `npm run build`, no `RUN` instruction that could reconstruct `dist/`. This is a deliberate architectural decision (ADR-007) ensuring that only pre-built, audited artifacts enter the container.

#### 4.4.2 `nginx.conf.template` Configuration

The nginx configuration template is processed at container startup to substitute `${PORT}` with the Cloud Run port. Key configuration directives:

- **`/healthz` location block**: Returns HTTP 200 with body `ok` and `Cache-Control: no-store`. This endpoint is used by Cloud Run health probes, Firebase Hosting health checks, and the Cloud Monitoring uptime check configured in M7.
- **Content Security Policy**: The `Content-Security-Policy` header is configured with `connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io` — it explicitly excludes `api.sanity.io` because the runtime never contacts the Sanity API. The `img-src` directive includes `https://cdn.sanity.io` for Portable Text image rendering.
- **Immutable asset caching**: All files under `/assets/` receive `Cache-Control: public, max-age=31536000, immutable` because their filenames contain content hashes.
- **Source map blocking**: Any request for `*.map` files returns HTTP 404.
- **SPA fallback**: The location block for `/` uses `try_files $uri $uri/ /index.html` so that deep links (e.g., `/books/some-slug`) serve `index.html` and allow client-side routing to handle the path.

#### 4.4.3 Hard-fail Verification

The hard-fail test confirms that the container cannot be built without a pre-existing `dist/`:

```bash
mv dist dist-backup
docker build -t mangu-publishers-fail . 2>&1 | tail -5
# EXPECTED: Error about missing index.html
mv dist-backup dist
```

This test is a P0 acceptance criterion (P0-2). A build that succeeds without `dist/` indicates a regression — the Dockerfile must never contain fallback build logic.

#### 4.4.4 Runtime Verification

Start the container and verify six runtime behaviors:

```bash
docker run -d -p 8080:8080 --name mangu-publishers-local mangu-publishers-test
sleep 2
```

1. **Health check**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/healthz` → `200`
2. **CSP excludes Sanity API**: `curl -sI http://localhost:8080/ | grep -i "content-security-policy"` → must not contain `api.sanity.io`
3. **CSP includes Sanity CDN**: Same header must include `cdn.sanity.io` for Portable Text images
4. **Asset cache headers**: `curl -sI http://localhost:8080/assets/{filename}` → `Cache-Control: public, max-age=31536000, immutable`
5. **Source maps return 404**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/assets/index.js.map` → `404`
6. **Container runs as UID 1001**: `docker exec mangu-publishers-local id` → `uid=1001`
7. **SPA fallback**: `curl -s http://localhost:8080/some/nonexistent/path | grep -c '<div id="'` → ≥ 1

After verification, stop and remove the container:

```bash
docker stop mangu-publishers-local && docker rm mangu-publishers-local
```

#### 4.4.5 Exit Criteria

Milestone 3 is complete when all runtime verification checks pass. The container must build successfully with `dist/`, fail without `dist/`, serve `/healthz` at 200, enforce the correct CSP, cache hashed assets immutably, block source maps, and run as UID 1001.

---

### 4.5 Milestone 4 — GCP Foundation

**Goal:** All GCP resources are provisioned and IAM bindings are in place so that Cloud Build can execute the full pipeline defined in M5.

Milestone 4 is the infrastructure provisioning phase. It has no dependency on local code changes (M1–M3) and may be executed in parallel with them to reduce overall wall-clock time. All commands are run via the `gcloud` CLI with an authenticated user who has Project Owner or equivalent permissions.

| #   | Task                               | gcloud Command(s)                                                             | Verification                                                     |
| --- | ---------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 4.1 | Set environment variables          | `export` block (8 variables)                                                  | All variables non-empty in `env`                                 |
| 4.2 | Enable 10 GCP APIs                 | `gcloud services enable` (10 APIs)                                            | `gcloud services list --enabled` shows all 10                    |
| 4.3 | Create Artifact Registry           | `gcloud artifacts repositories create` + cleanup policy                       | `gcloud artifacts repositories describe` succeeds                |
| 4.4 | Create Secret Manager secret       | `gcloud secrets create sanity-api-read-token`                                 | `gcloud secrets versions access latest` returns token            |
| 4.5 | Create Cloud Build service account | `gcloud iam service-accounts create` + 5 role grants + secret binding         | `gcloud iam service-accounts describe` succeeds                  |
| 4.6 | Create cache bucket                | `gcloud storage buckets create` + IAM binding                                 | `gcloud storage buckets describe` succeeds                       |
| 4.7 | Developer Connect GitHub link      | `gcloud developer-connect connections create` + `git-repository-links create` | OAuth flow completes; link shows in console                      |
| 4.8 | Cloud Build trigger                | `gcloud builds triggers create developer-connect`                             | `gcloud builds triggers describe mangu-publishers-main` succeeds |

#### 4.5.1 Environment Variables

Set the following variables in the shell before executing any resource creation commands:

```bash
export PROJECT_ID="your-gcp-project-id"          # CHANGE THIS
export REGION="us-central1"
export SERVICE="mangu-publishers"
export AR_REPO="web-images"
export CACHE_BUCKET="mangu-publishers-cloudbuild-cache"
export BUILD_SA_NAME="cloudbuild-mangu-publishers"
export PROJECT_NUMBER="$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')"
export BUILD_SA="${BUILD_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
export GITHUB_REPO_URL="https://github.com/redinc23/my_publishing.git"

gcloud config set project "$PROJECT_ID"
```

`PROJECT_ID` and `GITHUB_REPO_URL` must be changed to match the actual project and repository. All other variables use the default values from the architecture specification.

#### 4.5.2 Required GCP APIs

Enable all ten APIs in a single command:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  developerconnect.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  ondemandscanning.googleapis.com
```

These APIs cover: Cloud Run (container runtime), Cloud Build (CI/CD), Artifact Registry (image storage), Secret Manager (token storage), Developer Connect (GitHub integration), Firebase and Firebase Hosting (CDN + custom domain), Logging and Monitoring (observability), and On-Demand Scanning (CVE vulnerability scanning). The command returns asynchronously; allow approximately 60 seconds for all APIs to reach enabled state.

#### 4.5.3 Artifact Registry

Create a Docker-format repository with immutable tags:

```bash
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Mangu Publishers production web images" \
  --immutable-tags
```

Apply the cleanup policy from the staged Drive file:

```bash
gcloud artifacts repositories set-cleanup-policies "$AR_REPO" \
  --location="$REGION" \
  --policy=artifact-cleanup-policy.json
```

The cleanup policy (see Section 3.4 of the Implementation Package) retains the 15 most recent tagged images and deletes untagged images older than 3 days (259,200 seconds). This prevents unbounded storage growth while preserving deployable images.

#### 4.5.4 Secret Manager

Create the `sanity-api-read-token` secret from the actual token value obtained from Sanity Studio:

```bash
echo -n "YOUR_ACTUAL_TOKEN" | gcloud secrets create sanity-api-read-token \
  --replication-policy="automatic" \
  --data-file=-
```

Verify the secret is accessible:

```bash
gcloud secrets versions access latest --secret=sanity-api-read-token
```

This command must echo the token value. The secret is scoped to the `content-snapshot` step in `cloudbuild.yaml` (M5) via the `availableSecrets` block — no other step, container, or runtime process has access.

#### 4.5.5 Cloud Build Service Account

Create a dedicated service account with least-privilege roles:

```bash
# Create the service account
gcloud iam service-accounts create "$BUILD_SA_NAME" \
  --display-name="Cloud Build Mangu Publishers deployer"

# Grant five project-level roles
for role in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser \
  roles/logging.logWriter \
  roles/ondemandscanning.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$BUILD_SA" \
    --role="$role"
done

# Grant Secret Manager access scoped to one secret only
gcloud secrets add-iam-policy-binding sanity-api-read-token \
  --member="serviceAccount:$BUILD_SA" \
  --role="roles/secretmanager.secretAccessor"
```

The five project roles provide: Cloud Run administration (deploy and update services), Artifact Registry write (push images), service account user (act as other service accounts), log writing, and vulnerability scanning administration. The Secret Manager binding is scoped to the single `sanity-api-read-token` secret — the build SA cannot read any other secrets in the project.

#### 4.5.6 Cache Bucket

Create a Google Cloud Storage bucket for npm cache persistence between builds:

```bash
gcloud storage buckets create "gs://$CACHE_BUCKET" \
  --location="$REGION"

gcloud storage buckets add-iam-policy-binding "gs://$CACHE_BUCKET" \
  --member="serviceAccount:$BUILD_SA" \
  --role="roles/storage.objectAdmin"
```

The bucket stores a gzipped npm cache tarball that is restored at the start of each build and saved at the end. This reduces dependency installation time from minutes to seconds on warm builds.

#### 4.5.7 Developer Connect (GitHub OAuth)

Developer Connect establishes the authenticated link between GCP and GitHub. This step requires browser interaction for the OAuth flow:

```bash
# Create the Developer Connect service identity
gcloud beta services identity create \
  --service=developerconnect.googleapis.com

# Create the GitHub connection (opens browser for OAuth)
gcloud developer-connect connections create my-github-connection \
  --location="$REGION" \
  --github-config-app=developer-connect
```

After completing the OAuth authorization in the browser, link the specific repository:

```bash
gcloud developer-connect connections git-repository-links create my-publishing-link \
  --connection=my-github-connection \
  --location="$REGION" \
  --clone-uri="$GITHUB_REPO_URL"
```

#### 4.5.8 Cloud Build Trigger

Create the trigger that fires on every push to the `main` branch:

```bash
gcloud builds triggers create developer-connect \
  --name=mangu-publishers-main \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --region="$REGION" \
  --service-account="projects/$PROJECT_ID/serviceAccounts/$BUILD_SA"
```

The trigger uses the Developer Connect connection (not GitHub mirrored repos), the custom build service account (not the default Cloud Build SA), and targets `cloudbuild.yaml` at the repository root.

#### 4.5.9 Exit Criteria

Milestone 4 is complete when all resources are verifiable via `gcloud describe` commands:

1. `gcloud artifacts repositories describe web-images --location=us-central1` — shows repository with cleanup policy.
2. `gcloud secrets versions access latest --secret=sanity-api-read-token` — returns the token value.
3. `gcloud iam service-accounts describe $BUILD_SA` — shows the service account.
4. `gcloud builds triggers describe mangu-publishers-main --region="$REGION"` — shows trigger on `^main$`.
5. A push to `main` starts a Cloud Build execution (it may fail at the content snapshot step since `cloudbuild.yaml` is not yet in the repo — that is expected and confirms the trigger is wired correctly).

---

### 4.6 Milestone 5 — Cloud Build End-to-End

**Goal:** Pushing to `main` triggers an automated Cloud Build pipeline that produces a deployed Cloud Run service serving the live site.

Milestone 5 is the integration point where all prior milestones converge. The `cloudbuild.yaml` file from the Drive folder defines a 16-step pipeline that executes the same build scripts verified locally in M2, packages the output in the container verified in M3, and deploys it using the infrastructure provisioned in M4.

| #   | Task                                   | Operation                               | Verification                               |
| --- | -------------------------------------- | --------------------------------------- | ------------------------------------------ |
| 5.1 | Copy `cloudbuild.yaml` from Drive      | `cp _drive_files/cloudbuild.yaml .`     | File present at repo root                  |
| 5.2 | Pre-flight checks on `cloudbuild.yaml` | 6 grep-based verifications              | All checks match expected values           |
| 5.3 | Commit and push to `main`              | `git add && git commit && git push`     | Build triggers within 60 seconds           |
| 5.4 | Monitor 16-step pipeline               | `gcloud builds log <BUILD_ID>`          | All 16 steps complete (green)              |
| 5.5 | Verify deployed service                | `gcloud run services describe` + `curl` | Memory 512Mi, port 8080, URL returns 200   |
| 5.6 | Verify no secret leakage               | `gcloud logging read` query             | No results for token name in logs          |
| 5.7 | Verify image tags in AR                | `gcloud artifacts docker images list`   | Both `SHORT_SHA` and `latest` tags present |

#### 4.6.1 `cloudbuild.yaml` Pre-flight Checks

Before committing `cloudbuild.yaml`, verify six security-critical attributes:

```bash
# 1. Memory is 512Mi (gen2 requirement)
grep -- "--memory=512Mi" cloudbuild.yaml

# 2. Logging mode prevents secret leakage in legacy bucket
grep "CLOUD_LOGGING_ONLY" cloudbuild.yaml

# 3. Secret env is scoped to content-snapshot step ONLY
grep -B2 -A2 "secretEnv" cloudbuild.yaml

# 4. Deploy step suppresses default URL
grep -- "--no-default-url" cloudbuild.yaml

# 5. Build steps run before Docker step
grep "id:" cloudbuild.yaml

# 6. Vulnerability scan step exists
grep -A3 "enforce-vulnerability-policy" cloudbuild.yaml
```

Each grep must match the expected value. A failure at any check indicates that the `cloudbuild.yaml` file has been modified or is the wrong version — do not proceed until resolved.

#### 4.6.2 16-step Pipeline Walkthrough

The Cloud Build pipeline executes the following steps in order:

| Step | ID                             | Purpose                                                                              | Key Details                                                    |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --- | ----- |
| 1    | `restore-npm-cache`            | Restore npm cache from GCS bucket                                                    | `gsutil cp` from `${_CACHE_BUCKET}`                            |
| 2    | `install`                      | Install Node.js dependencies                                                         | `npm ci` with cache at `/workspace/.npm`                       |
| 3    | `production-audit`             | Run `npm audit` (non-blocking)                                                       | `--audit-level=high`, `                                        |     | true` |
| 4    | `content-snapshot`             | Fetch Sanity content                                                                 | **Only step with `secretEnv: [SANITY_API_READ_TOKEN]`**        |
| 5    | `generate-routes`              | Build `.cache/routes.json` from snapshot                                             | `npm run build:routes`                                         |
| 6    | `vite-build`                   | Vite production build                                                                | Sets `VITE_APP_VERSION=${SHORT_SHA}`                           |
| 7    | `prerender`                    | Playwright Chromium renders all routes                                               | Uses pinned `mcr.microsoft.com/playwright:v1.43.0-jammy`       |
| 8    | `sitemap`                      | Generate `dist/sitemap.xml`                                                          | `npm run build:sitemap`                                        |
| 9    | `audit-secrets`                | Verify no secrets under **`dist/`** (including HTML shells, not only `dist/assets/`) | Exits 1 if forbidden strings appear                            |
| 10   | `smoke-test`                   | Verify all routes have `index.html`                                                  | `npm run smoke:check-routes`                                   |
| 11   | `docker-build`                 | Build nginx container from `dist/`                                                   | Tags with both `SHORT_SHA` and `latest`                        |
| 12   | `docker-push`                  | Push image to Artifact Registry                                                      | `--all-tags` pushes both tags                                  |
| 13   | `enforce-vulnerability-policy` | CVE scan blocks on HIGH/CRITICAL                                                     | Exits 1 if CRITICAL or HIGH findings detected                  |
| 14   | `deploy-run`                   | Deploy to Cloud Run                                                                  | `--memory=512Mi --no-default-url --execution-environment=gen2` |
| 15   | `prune-tags`                   | Remove old Cloud Run traffic tags                                                    | Calls `scripts/ops/prune-cloud-run-tags.sh`                    |
| 16   | `save-npm-cache`               | Save npm cache to GCS bucket                                                         | `gsutil cp` to `${_CACHE_BUCKET}`                              |

Steps 1–10 constitute the **build phase**: they produce `dist/` and verify its integrity. Steps 11–14 constitute the **deploy phase**: they containerize, scan, and deploy. Steps 15–16 are **cleanup phase**: they maintain resource hygiene and cache state.

The vulnerability scan (step **13**) runs **after** image push (step **12**) and **before** deploy (step **14**). If the scan finds HIGH or CRITICAL CVEs in the container image, it exits with code 1, preventing Cloud Run deploy. Canonical ID: **P0-7** (legacy label **CVE-GATE**).

#### 4.6.3 Deployed Service Verification

After the pipeline completes successfully, verify the deployed service:

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="yaml(spec.template.spec.containers[0].resources,status.url)"
```

Expected output includes `memory: 512Mi`, `port: 8080`, and a service URL. Test the URL:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  $(gcloud run services describe mangu-publishers --region=us-central1 --format='value(status.url)')
# EXPECTED: 200
```

#### 4.6.4 Secret Leakage Verification

Confirm that the Sanity token name does not appear in Cloud Build logs:

```bash
gcloud logging read "resource.labels.build_id=<BUILD_ID> AND textPayload:SANITY_API_READ_TOKEN" --limit=10
```

This query must return no results. The `CLOUD_LOGGING_ONLY` option in `cloudbuild.yaml` prevents secrets from being written to the legacy Cloud Storage log bucket, but the Cloud Logging API remains searchable. A non-empty result indicates a secret exposure that must be investigated immediately.

#### 4.6.5 Exit Criteria

Milestone 5 is complete when:

1. Cloud Build completes all 16 steps with green status.
2. `gcloud run services describe mangu-publishers` shows `memory: 512Mi`, port 8080, and a service URL.
3. The service URL returns HTTP 200.
4. `/healthz` on the service URL returns HTTP 200.
5. No `SANITY_API_READ_TOKEN` appears in Cloud Build logs.
6. The image in Artifact Registry has both `SHORT_SHA` and `latest` tags.

---

### 4.7 Milestone 6 — Firebase Hosting and Custom Domain (LAUNCH)

**Goal:** `https://www.yourdomain.com/` resolves to the Cloud Run service over a global CDN with TLS termination and SPA routing.

Milestone 6 is the launch milestone. When this milestone is complete, the site is publicly accessible on a custom domain over HTTPS. Firebase Hosting provides the edge network, TLS certificate provisioning, and rewrite rules that route all traffic to the Cloud Run service deployed in M5.

| #   | Task                            | Operation                                                          | Verification                                                                      |
| --- | ------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 6.1 | Create `public-placeholder/`    | `mkdir -p public-placeholder && touch public-placeholder/.gitkeep` | Directory exists, tracked by git                                                  |
| 6.2 | Copy `firebase.json` from Drive | `cp _drive_files/firebase.json .`                                  | `public: "public-placeholder"`, rewrite to `mangu-publishers` with `pinTag: true` |
| 6.3 | Initialize Firebase Hosting     | `firebase init hosting`                                            | Select existing project, `public-placeholder`, SPA yes, no GitHub auto-deploys    |
| 6.4 | Deploy Firebase Hosting         | `firebase deploy --only hosting`                                   | Default Firebase URL serves the site                                              |
| 6.5 | Add custom domain               | Firebase Console → Hosting → Add custom domain                     | DNS records added at registrar                                                    |
| 6.6 | Verify launch                   | 7 verification checks (HTTPS, deep links, headers, cache, SPA)     | All checks pass                                                                   |

#### 4.7.1 `public-placeholder/` Directory

Firebase Hosting requires a `public` directory to exist at deploy time, even though all traffic is rewritten to Cloud Run. The `public-placeholder/` directory is intentionally empty (containing only `.gitkeep` so that git tracks it). This design (documented in ADR-005) ensures that no static files are served directly by Firebase — every request flows through the rewrite rule to the Cloud Run container, where nginx handles routing, caching, and security headers consistently.

#### 4.7.2 `firebase.json` Configuration

The `firebase.json` file defines the Hosting configuration:

```json
{
  "hosting": {
    "public": "public-placeholder",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "mangu-publishers",
          "region": "us-central1",
          "pinTag": true
        }
      }
    ]
  }
}
```

Key attributes: `"public": "public-placeholder"` (not `"dist"`), `"source": "**"` (matches all request paths), and `"pinTag": true` (creates an immutable traffic tag on each deploy, enabling instant rollback). The rewrite sends every request to the `mangu-publishers` Cloud Run service in `us-central1`.

#### 4.7.3 Firebase Initialization

Authenticate and initialize:

```bash
firebase login
firebase init hosting
```

During initialization, select the existing GCP project, specify `public-placeholder` as the public directory, answer "Yes" to single-page app configuration, and decline GitHub Action auto-deploys (Cloud Build handles deployment via the trigger configured in M4).

#### 4.7.4 Deploy and Test

```bash
firebase deploy --only hosting
```

The deploy output shows the default Firebase Hosting URL (e.g., `https://your-project.web.app/`). Test this URL in a browser — it should load the site through the Cloud Run rewrite.

#### 4.7.5 Custom Domain Setup

Add the custom domain via the Firebase Console:

1. Navigate to Hosting → Add custom domain.
2. Enter the domain (e.g., `www.yourdomain.com`).
3. Firebase displays the required DNS records (typically two A records pointing to Firebase IP addresses, or a CNAME for subdomains).
4. Add the records at the domain registrar.
5. Wait for DNS propagation and certificate provisioning (5 minutes to several hours).

#### 4.7.6 Launch Verification

Once Firebase shows the domain as "Connected", execute seven verification checks:

```bash
DOMAIN="https://www.yourdomain.com"

# 1. HTTPS works
curl -sI "$DOMAIN/" | head -5    # HTTP/2 200

# 2. Deep links work
curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/books/some-real-slug"    # 200

# 3. /healthz works
curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/healthz"    # 200

# 4. Security headers present
curl -sI "$DOMAIN/" | grep -iE "x-frame-options|x-content-type|referrer-policy|permissions-policy|content-security-policy"

# 5. Source map blocked
curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/assets/index.js.map"    # 404

# 6. Asset cache immutable
ASSET=$(ls dist/assets/*.js | head -1 | xargs basename)
curl -sI "$DOMAIN/assets/$ASSET" | grep -i "immutable"    # Cache-Control: public, max-age=31536000, immutable

# 7. Browser click-through test — open in real browser, verify content loads
```

#### 4.7.7 Exit Criteria

Milestone 6 — and the launch — is complete when the site loads on the custom domain over HTTPS, deep links return 200, all security headers are present, source maps are blocked, hashed assets are cached immutably, and content loads correctly in a browser.

---

### 4.8 Milestone 7 — Production Guardrails

**Goal:** The site is observable, automatically rebuilds on content changes, and has operational safeguards for cost, performance, and security.

Milestone 7 implements the production hardening that makes the site maintainable after launch. The work items are independent and may be executed in any order. They fall into five categories: error tracking (Sentry), content-driven rebuilds (webhook validator), monitoring and alerting, cost controls, and code quality (Portable Text renderer + Formspree).

| #   | Task                          | Operation                                                                                                                      | Verification                                                              |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 7.1 | Sentry release tracking       | `npm install --save-dev @sentry/vite-plugin @sentry/react`; update `vite.config.ts`; add `SENTRY_AUTH_TOKEN` to Secret Manager | Sentry dashboard shows events tagged with SHA                             |
| 7.2 | Sanity webhook validator      | Deploy Cloud Run Function with HMAC verification + replay protection                                                           | Publish in Sanity triggers build within 60s; unsigned request returns 401 |
| 7.3 | Cloud Monitoring uptime check | `gcloud monitoring uptime create mangu-publishers-healthz`                                                                     | Green check on `/healthz` in Monitoring Console                           |
| 7.4 | Alert policies                | Create 4 policies: 5xx rate, p99 latency, memory, instance count                                                               | Policies show as active in Alerting Console                               |
| 7.5 | Billing budget alerts         | Cloud Console → Billing → Budgets & alerts                                                                                     | Notifications at 50%, 75%, 90%                                            |
| 7.6 | Artifact Registry cleanup     | Verify policy from M4.3                                                                                                        | `gcloud artifacts repositories describe` shows policy                     |
| 7.7 | Cloud Run tag pruning         | Copy `prune-cloud-run-tags.sh`; run or schedule                                                                                | Excess tags removed; most recent 50 retained                              |
| 7.8 | Portable Text renderer        | `npm install @portabletext/react`; create `PortableTextRenderer.tsx`                                                           | Renders Sanity rich text correctly                                        |
| 7.9 | Replace Netlify Forms         | Sign up for Formspree; update contact form POST endpoint                                                                       | Form submissions arrive at configured destination                         |

#### 4.8.1 Sentry Release Tracking and Hidden Source Maps

Install the Sentry packages:

```bash
npm install --save-dev @sentry/vite-plugin @sentry/react
```

Update `vite.config.ts` to include the `sentryVitePlugin`:

```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: { sourcemap: true },
  plugins: [
    // ... existing plugins
    sentryVitePlugin({
      org: 'your-sentry-org',
      project: 'mangu-publishers',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist/**',
        ignore: ['./node_modules/**'],
        filesToDeleteAfterUpload: './dist/**/*.map',
      },
    }),
  ],
});
```

Add `SENTRY_AUTH_TOKEN` to Secret Manager:

```bash
echo -n "YOUR_SENTRY_TOKEN" | gcloud secrets create sentry-auth-token \
  --replication-policy=automatic --data-file=-
```

Update `cloudbuild.yaml` step 6 (`vite-build`) to include `secretEnv: ['SENTRY_AUTH_TOKEN']` and pass `VITE_APP_VERSION=${SHORT_SHA}`. After the next deploy, verify in the Sentry dashboard that error events are tagged with the git SHA as the release version, and that no `.map` files remain in `dist/` after the build (the plugin deletes them after upload).

#### 4.8.2 Sanity Webhook Validator

The webhook validator is a lightweight HTTP endpoint — deployed as a second Cloud Run service or a Cloud Run Function — that receives Sanity webhook notifications, validates their authenticity, and triggers Cloud Build.

**HMAC signature verification.** Sanity sends a `Sanity-Webhook-Signature` header containing an HMAC-SHA256 signature of the payload. The validator computes the expected signature using a shared secret configured in Sanity Studio and rejects requests where the signature does not match.

**Replay protection.** The validator tracks payload IDs (sent in the webhook metadata) and rejects duplicate deliveries within a 10-minute window. This prevents malicious or accidental replay attacks from triggering redundant builds.

**Build trigger.** On a valid, signed request, the validator executes:

```bash
gcloud builds triggers run mangu-publishers-main --region=us-central1
```

**Negative test.** Sending an unsigned request must return HTTP 401 or 403 and must not trigger a build:

```bash
curl -X POST https://your-validator-url/webhook \
  -H "Content-Type: application/json" \
  -d '{"_type":"book","_id":"test"}'
# EXPECTED: 401 or 403
```

In Sanity Studio, configure the webhook under Settings → API → Webhooks with the validator URL and a shared secret.

#### 4.8.3 Cloud Monitoring Uptime Check

Create an uptime check that polls `/healthz` every 60 seconds:

```bash
gcloud monitoring uptime create mangu-publishers-healthz \
  --display-name="Mangu Publishers /healthz" \
  --resource-type=uptime-url \
  --hostname="www.yourdomain.com" \
  --path="/healthz" \
  --check-interval=60s \
  --timeout=10s
```

Verify in the Cloud Monitoring Console → Uptime checks that the check shows green.

#### 4.8.4 Alert Policies

Create four alert policies in Cloud Monitoring:

| Alert              | Condition                                                              | Threshold                | Rationale                                              |
| ------------------ | ---------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------ |
| 5xx error rate     | `metric.type=run.googleapis.com/request_count` with response class 5xx | > 5% over 5 minutes      | Detects server errors affecting users                  |
| p99 latency        | `metric.type=run.googleapis.com/request_latencies`                     | > 2000ms over 10 minutes | Detects performance degradation                        |
| Memory utilization | `metric.type=run.googleapis.com/container/memory/utilizations`         | > 85% over 10 minutes    | Prevents OOM kills                                     |
| Instance count     | `metric.type=run.googleapis.com/container/instance_count`              | >= 8 over 5 minutes      | Signals traffic spike or runaway process (maxScale=10) |

#### 4.8.5 Billing Budget Alerts

Create a monthly billing budget in the Cloud Console:

1. Navigate to Billing → Budgets & alerts → Create Budget.
2. Set the monthly budget amount appropriate for the project.
3. Configure notification thresholds at 50%, 75%, and 90% of the budget.
4. Add an email notification channel for the engineering team.

#### 4.8.6 Artifact Registry Cleanup and Tag Pruning

The Artifact Registry cleanup policy was applied in M4.3. Verify it remains active:

```bash
gcloud artifacts repositories describe web-images --location=us-central1
```

For Cloud Run tag pruning, copy and configure the pruning script:

```bash
mkdir -p scripts/ops
cp _drive_files/prune-cloud-run-tags.sh scripts/ops/
chmod +x scripts/ops/prune-cloud-run-tags.sh
```

The script retains the most recent 50 traffic tags (configurable via the `KEEP` environment variable) and removes the rest. Execute manually, integrate as a Cloud Build step (already present as step 15 in `cloudbuild.yaml`), or schedule via Cloud Scheduler as a weekly cron job.

#### 4.8.7 Portable Text Renderer

Install the Portable Text React component:

```bash
npm install @portabletext/react
```

Create `src/components/PortableTextRenderer.tsx` that wraps the `@portabletext/react` component with a custom image renderer. The image component constructs Sanity CDN URLs from asset references in the Portable Text blocks, using `https://cdn.sanity.io/images/` as the base URL with `loading="lazy"` for performance. Use this component wherever rich text content from Sanity is rendered (e.g., book descriptions, author bios).

#### 4.8.8 Formspree Integration

Replace any existing Netlify Forms integration with Formspree:

1. Sign up for a Formspree account and create a new form.
2. Update the contact form component in `src/` to POST to the Formspree endpoint URL (e.g., `https://formspree.io/f/YOUR_FORM_ID`).
3. Remove any `netlify` form attributes or Netlify-specific form handling code from the codebase.

#### 4.8.9 Exit Criteria

Milestone 7 — and all of Phase 2 — is complete when:

1. Sentry shows error events tagged with the git SHA as the release version.
2. No `.map` files exist in `dist/` after build (source maps uploaded to Sentry and deleted).
3. Publishing content in Sanity triggers a verified Cloud Build within approximately 60 seconds.
4. Unsigned webhook requests return HTTP 401/403 and do not trigger builds.
5. The Cloud Monitoring uptime check on `/healthz` shows green.
6. All four alert policies are active in the Cloud Monitoring Alerting Console.
7. Billing budget alerts are configured with 50%, 75%, and 90% thresholds.
8. The Artifact Registry cleanup policy is active.
9. Cloud Run traffic tags do not exceed the configured retention limit.
10. All P0 acceptance tests (defined in Chapter 5) pass.

## 5. Acceptance Criteria & Test Protocol

**Canonical authority:** Executable command templates, pass/fail semantics, and the **`P0-1`…`P0-9`** inventory live in [`06-acceptance-and-test-protocol.md`](../06-acceptance-and-test-protocol.md). Legacy subsection headings below (`5.2`…`5.8`) retain historical titles; map them to canonical IDs via [`change-log-and-decisions.md`](../change-log-and-decisions.md) **Decision 5**.

This chapter summarizes the suite for narrative continuity. Every check must be executed under `set -euo pipefail` without masking failures (no `|| true` on required negatives).

### 5.1 P0 Test Suite Overview

#### 5.1.1 P0 Test Inventory (Canonical)

| Test ID  | Requirement validated                                                     | Evidence focus                                                        | Typical milestones |
| -------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------ |
| **P0-1** | No secret leakage (bundle, layers, runtime, logs)                         | `rg`/`grep`, `gcloud run describe`, logging queries                   | M1, M5             |
| **P0-2** | Build before Docker; deterministic Dockerfile                             | `cloudbuild.yaml` ordering; inverted Dockerfile `npm` check           | M3, M5             |
| **P0-3** | Static deep-link / SPA routing                                            | HTTPS probes on deep URLs                                             | M6                 |
| **P0-4** | Security headers (CSP, cache immutability, `.map` 404)                    | `curl -sI` evidence                                                   | M3, M6             |
| **P0-5** | Health / liveness (`/healthz`)                                            | uptime + direct probe                                                 | M5, M6             |
| **P0-6** | Cloud Run deployment shape                                                | memory `512Mi`, scaling, gen2                                         | M5                 |
| **P0-7** | CI security gates (secret audit, CVE policy **after image push**)         | build logs, scan step                                                 | M4, M5             |
| **P0-8** | Content rebuild automation (signed webhook path)                          | publish → build latency (target ~60s typical; worst-case SLO in `06`) | M7a/M7b            |
| **P0-9** | Observability + cost (Sentry release, alerts **per Decision 7**, budgets) | console screenshots / API proof                                       | M7a/M7b            |

Optional **`SENTRY_AUTH_TOKEN`** (source maps) is build-step scoped only — dual-secret posture is described in `03-functional-requirements.md` and Appendix A of `09-appendices.md`.

#### 5.1.2 Relationship To Legacy “Seven P0s + CVE-GATE + WEBHOOK”

Older drafts counted seven narrative tests plus separate CVE and webhook gates. Canonical **`P0-7`** absorbs **CVE-GATE**; canonical **`P0-8`** absorbs **WEBHOOK**. Use **`06`** + **Decision 5** when reconciling IDs across RACI, evidence logs, and this frozen narrative.

### 5.2 P0-1: No Browser-Bundled Secrets

**Requirement:** No secret variable starts with the `VITE_` prefix. The Sanity API read token must not appear anywhere under **`dist/`**, Docker layers, Cloud Run env, or Cloud Build logs. **Canonical commands:** [`06-acceptance-and-test-protocol.md`](../06-acceptance-and-test-protocol.md) P0-1.

#### 5.2.1 Test A: scan **`dist/`** for SANITY_API_READ_TOKEN

```bash
if rg -n 'SANITY_API_READ_TOKEN|VITE_SANITY_API_READ_TOKEN' dist/; then
  echo "FAIL: secret strings found under dist/"
  exit 1
fi
echo "PASS: no SANITY/VITE secret strings under dist/"
```

**Expected:** No matching lines (exit 0 after PASS echo).

#### 5.2.2 Test B: scan **`dist/assets/`** for Base64 Token Patterns (high-entropy sanity check)

```bash
grep -rn "sk[A-Za-z0-9]" dist/assets/ | head -20
```

**Expected:** No Sanity token matches. The command may produce false positives from benign `sk`-prefixed strings (for example, `skipAnimation`). The operator must manually inspect output to distinguish token-like strings. A valid Sanity production token starts with `sk` followed by at least 20 alphanumeric characters.

#### 5.2.3 Test C: Check Cloud Run Runtime Environment for Token

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

**Expected:** The YAML output does not contain `SANITY_API_READ_TOKEN`. The `env` field is either empty or contains only non-secret variables such as `PORT=8080`.

#### 5.2.4 Test D: Inspect Docker Image Layers with docker save | strings | grep

```bash
docker save us-central1-docker.pkg.dev/$PROJECT_ID/web-images/mangu-publishers:latest \
  | tar -xO | strings | grep -i "sanity.*token"
```

**Expected:** No output. The `docker save | tar | strings | grep` pipeline produces no matching lines. The Dockerfile copies only pre-built static files from `dist/` and contains no `npm install` or build-time secret injection.

#### 5.2.5 Test E: Verify CLOUD_LOGGING_ONLY in cloudbuild.yaml

```bash
grep "logging:" cloudbuild.yaml
```

**Expected:** Output contains `CLOUD_LOGGING_ONLY` under the `options` block:

```yaml
options:
  logging: CLOUD_LOGGING_ONLY
```

**P0-1 Pass Criteria:** All five tests return no secret values. Any single failure blocks deployment.

### 5.3 P0-2: Build Before Docker

**Requirement:** Cloud Build executes the full static build pipeline — content snapshot, route generation, Vite compilation, prerendering, and sitemap — before Docker image assembly. The Dockerfile contains no fallback build logic and fails deterministically if `dist/` is absent.

#### 5.3.1 Test A: Verify Step Ordering in cloudbuild.yaml

```bash
grep -n "id:" cloudbuild.yaml | grep -E \
  "content-snapshot|generate-routes|vite-build|prerender|sitemap|docker-build" \
  | awk '{print $1}' | sed 's/://'
```

**Expected:** Line numbers show `content-snapshot`, `generate-routes`, `vite-build`, `prerender`, and `sitemap` at lower line numbers than `docker-build`. The exact ordering is: content-snapshot, generate-routes, vite-build, prerender, sitemap, docker-build.

#### 5.3.2 Test B: Remove dist/ and Attempt Docker Build

```bash
mv dist dist-backup 2>/dev/null || true
docker build -t mangu-publishers-fail-test . 2>&1 | grep -q "missing\|COPY failed\|FATAL" \
  && echo "PASS: Docker fails without dist/" || echo "FAIL: Docker should fail without dist/"
mv dist-backup dist 2>/dev/null || true
```

**Expected:** The Docker build fails with an error referencing missing `dist/` or the `test -f` validation. The Dockerfile contains: `RUN test -f /usr/share/nginx/html/index.html || exit 1`. If the build succeeds without `dist/`, the test fails — a fallback `npm run build` was incorrectly retained.

#### 5.3.3 Test C: Verify No npm Commands in Dockerfile

```bash
grep -E "npm (install|run build|ci)" Dockerfile
```

**Expected:** No output. The Dockerfile must not contain `npm install`, `npm ci`, `npm run build`, or any Node.js invocation. The only application code `COPY` is `COPY dist/ /usr/share/nginx/html/`.

**P0-2 Pass Criteria:** Build-step ordering is correct, Docker build fails without `dist/`, and the Dockerfile contains no npm commands.

### 5.4 P0-3: Static Runtime

**Requirement:** The Cloud Run container serves only pre-built static files through nginx. No Node.js process runs. No outbound Sanity API connections occur at runtime. The CSP reflects this by excluding `api.sanity.io` from `connect-src`.

#### 5.4.1 Test A: /healthz Returns 200; Test B: Container Image Contains nginx

**Test A — Health Endpoint:**

```bash
curl -s -o /dev/null -w "%{http_code}" https://www.yourdomain.com/healthz
```

**Expected:** `200`. Response body contains `ok`. Response includes `Cache-Control: no-store`.

**Test B — Container Image:**

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="value(spec.template.spec.containers[0].image)"
```

**Expected:** Output contains `nginx` (specifically `nginx:1.27-alpine`). Must not contain `node`.

#### 5.4.2 Test C: CSP connect-src Does Not Contain api.sanity.io; Test D: No Secret Env Vars at Runtime

**Test C — Content Security Policy:**

```bash
curl -sI https://www.yourdomain.com/ | grep -i "content-security-policy"
```

**Expected:** The `Content-Security-Policy` header is present. `connect-src` does NOT contain `api.sanity.io`. Expected `connect-src` includes `'self'`, `https://*.sentry.io`, and `https://*.ingest.sentry.io` only. The `img-src` directive may include `https://cdn.sanity.io` for Portable Text images — this is expected as the Sanity CDN is read-only and requires no authentication.

**Test D — Runtime Environment:**

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

**Expected:** The `env` list is empty or contains only non-secret variables such as `PORT=8080`. No variable containing `TOKEN`, `SECRET`, or `KEY` appears.

**P0-3 Pass Criteria:** `/healthz` returns 200, container image is nginx-based, CSP `connect-src` excludes `api.sanity.io`, and no secret env vars are configured.

### 5.5 P0-4: GitHub + Developer Connect

**Requirement:** GitHub remains the single source of truth. Cloud Build triggers use Developer Connect (not mirror-based repositories), and push to `main` automatically initiates a build within 60 seconds.

#### 5.5.1 Test A: Trigger Exists and Describes Correctly; Test B/C: Push to main Triggers Build Within 60 Seconds

**Test A — Trigger Existence:**

```bash
gcloud builds triggers describe mangu-publishers-main --region=us-central1
```

**Expected:** Exit code 0. Output shows `developerConnect` trigger type with `branchPattern: ^main$`. The `buildConfig` references `cloudbuild.yaml`. The `serviceAccount` references `cloudbuild-mangu-publishers@`.

**Test B — Push Event and Test C — Build Latency:**

```bash
git commit --allow-empty -m "ops: trigger test $(date +%s)" && git push origin main
```

Wait 60 seconds, then:

```bash
gcloud builds list --region=us-central1 --limit=1 --format='table(id, status, createTime)'
```

**Expected:** The most recent build shows status `WORKING`, `QUEUED`, or `SUCCESS` with `createTime` within 60 seconds of the push. A `FAILURE` status still passes P0-4 (the trigger fired) but indicates a different P0 test or build step requires investigation.

**P0-4 Pass Criteria:** The Developer Connect trigger exists on `^main$`, and push to `main` initiates Cloud Build within 60 seconds.

### 5.6 P0-5: Firebase Hosting Rewrite

**Requirement:** All HTTP traffic is served through Firebase Hosting, which provides custom domain, TLS termination, CDN caching, and SPA routing. Firebase rewrites every request to Cloud Run `mangu-publishers` in `us-central1`. No static files are served directly from Firebase Hosting — the `public` directory is `public-placeholder`, an empty directory.

#### 5.6.1 Test A: Custom Domain Resolves HTTPS 200; Test B: Deep Links Return 200 (SPA Fallback)

**Test A — Root Domain:**

```bash
curl -sI https://www.yourdomain.com/ | head -1
```

**Expected:** HTTP/2 200. Response includes TLS headers and `strict-transport-security`.

**Test B — Deep Link:**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://www.yourdomain.com/books/a-nonexistent-slug
```

**Expected:** `200` (not 404). Server returns `index.html` shell; client-side routing handles navigation.

#### 5.6.2 Test C: Firebase/Google Headers Present; Test D: firebase.json Uses public-placeholder

**Test C — Infrastructure Headers:**

```bash
curl -sI https://www.yourdomain.com/ | grep -i "x-served-by\|server\|firebase"
```

**Expected:** Headers contain indicators of Firebase/Google infrastructure (for example, `Server: Google Frontend`). Absence of `nginx` in the `Server` header is expected — Firebase Hosting sits in front of Cloud Run.

**Test D — firebase.json:**

```bash
grep '"public"' firebase.json
```

**Expected:** Output shows `"public": "public-placeholder"`. The value must not be `"dist"`. The `public-placeholder` directory contains only `.gitkeep`.

**P0-5 Pass Criteria:** Custom domain returns HTTPS 200 on root and deep links, Firebase/Google headers present, and `firebase.json` points to `public-placeholder`.

### 5.7 P0-6: Cloud Run Deploy Flags

**Requirement:** The Cloud Run service deploys with specific resource limits, scaling parameters, and network configuration defined in the `cloudbuild.yaml` deploy step.

#### 5.7.1 Cloud Run Configuration Verification Table

| Parameter               | Specified Value | GCP Spec Path                                                                    | Verification Command                                                                                                                                               |
| ----------------------- | --------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `max-instances`         | 10              | `spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"]`         | `gcloud run services describe mangu-publishers --region=us-central1 --format="value(spec.template.metadata.annotations.autoscaling.knative.dev/maxScale)"`         |
| `min-instances`         | 0               | `spec.template.metadata.annotations["autoscaling.knative.dev/minScale"]`         | `gcloud run services describe mangu-publishers --region=us-central1 --format="value(spec.template.metadata.annotations.autoscaling.knative.dev/minScale)"`         |
| `execution-environment` | gen2            | `spec.template.metadata.annotations["run.googleapis.com/execution-environment"]` | `gcloud run services describe mangu-publishers --region=us-central1 --format="value(spec.template.metadata.annotations.run.googleapis.com/execution-environment)"` |
| `memory`                | 512Mi           | `spec.template.spec.containers[0].resources.limits.memory`                       | `gcloud run services describe mangu-publishers --region=us-central1 --format="value(spec.template.spec.containers[0].resources.limits.memory)"`                    |
| `port`                  | 8080            | `spec.template.spec.containers[0].ports[0].containerPort`                        | `gcloud run services describe mangu-publishers --region=us-central1 --format="value(spec.template.spec.containers[0].ports[0].containerPort)"`                     |
| `allow-unauthenticated` | true            | IAM binding: `allUsers` with `roles/run.invoker`                                 | `gcloud run services get-iam-policy mangu-publishers --region=us-central1 --format="yaml(bindings)" \| grep -A 1 "role: roles/run.invoker"`                        |

**Consolidated verification:**

```bash
CONFIG=$(gcloud run services describe mangu-publishers --region=us-central1 --format="json")
echo "$CONFIG" | jq -e '.spec.template.metadata.annotations."autoscaling.knative.dev/maxScale" == "10"' && echo "PASS: max=10" || echo "FAIL"
echo "$CONFIG" | jq -e '.spec.template.metadata.annotations."autoscaling.knative.dev/minScale" == "0"' && echo "PASS: min=0" || echo "FAIL"
echo "$CONFIG" | jq -e '.spec.template.metadata.annotations."run.googleapis.com/execution-environment" == "gen2"' && echo "PASS: gen2" || echo "FAIL"
echo "$CONFIG" | jq -e '.spec.template.spec.containers[0].ports[0].containerPort == 8080' && echo "PASS: port=8080" || echo "FAIL"
echo "$CONFIG" | jq -e '.spec.template.spec.containers[0].resources.limits.memory == "512Mi"' && echo "PASS: 512Mi" || echo "FAIL"
```

**Note:** `512Mi` is the minimum memory allocation for Cloud Run gen2. The original `256Mi` value was corrected in the v12 gap analysis.

**P0-6 Pass Criteria:** All six parameters match specified values. Any deviation indicates deployment configuration drift.

### 5.8 P0-7: nginx SPA Behavior

**Requirement:** The nginx container serves hashed static assets with immutable cache headers, returns SPA `index.html` for deep links, blocks source map URLs, and includes five security headers on every response.

#### 5.8.1 Test A: Hashed Assets Return Immutable Cache Header; Test B: All Five Security Headers Present

**Test A — Immutable Cache:**

```bash
ASSET=$(ls dist/assets/*.js 2>/dev/null | head -1 | xargs basename)
curl -sI "https://www.yourdomain.com/assets/$ASSET" | grep -i "cache-control"
```

**Expected:** `Cache-Control` contains `public, max-age=31536000, immutable`. The `immutable` directive eliminates conditional revalidation requests.

**Test B — Security Headers:**

```bash
curl -sI https://www.yourdomain.com/ | grep -iE \
  "x-frame-options|x-content-type-options|referrer-policy|permissions-policy|content-security-policy"
```

**Expected:** All five headers present:

| Header                    | Expected Value                                                 |
| ------------------------- | -------------------------------------------------------------- |
| `X-Frame-Options`         | `DENY` or `SAMEORIGIN`                                         |
| `X-Content-Type-Options`  | `nosniff`                                                      |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`                              |
| `Permissions-Policy`      | Restricted defaults (camera=(), microphone=(), geolocation=()) |
| `Content-Security-Policy` | All directives with no `api.sanity.io` in `connect-src`        |

#### 5.8.2 Test C: .map URLs Return 404; Test D: Deep Links Return SPA HTML

**Test C — Source Map Blocking:**

```bash
curl -s -o /dev/null -w "%{http_code}" https://www.yourdomain.com/assets/index.js.map
```

**Expected:** `404`. The `nginx.conf.template` contains an explicit location block returning 404 for `*.map` requests. Source maps are uploaded to Sentry during build and deleted from `dist/` before Docker packaging.

**Test D — Deep Link SPA Fallback:**

```bash
curl -s https://www.yourdomain.com/books/nonexistent-slug | grep -c "<div id="
```

**Expected:** Count of 1 or greater, confirming the response contains the SPA HTML shell. The nginx `try_files` directive implements the fallback: `try_files $uri $uri/ /index.html;`.

**P0-7 Pass Criteria:** Hashed assets return `immutable` cache, all five security headers present, `.map` returns 404, and deep links return SPA HTML.

### 5.9 CVE-GATE: Vulnerability Scan (Canonical **P0-7**)

**Requirement:** The `cloudbuild.yaml` pipeline includes a vulnerability scanning step after Docker push and before deploy. HIGH or CRITICAL CVE findings block deployment.

#### 5.9.1 Verify enforce-vulnerability-policy Step; Verify HIGH/CRITICAL Blocks Deploy

**Step Existence:**

```bash
grep -A 15 "enforce-vulnerability-policy" cloudbuild.yaml
```

**Expected:** Output shows a step with `id: enforce-vulnerability-policy` using the On-Demand Scanning API. The step greps scan results for `CRITICAL` or `HIGH` and exits 1 if found. It is positioned after `docker-push` (step 12) and before `deploy-run` (step 14).

**Negative Test — Vulnerable Image Blocking:**

Create a test branch with a known-vulnerable base image and confirm Cloud Build stops at the vulnerability step:

```bash
sed -i 's/nginx:1.27-alpine/nginx:1.21-alpine/' Dockerfile
git commit -am "TEST: vulnerable base image"
git push origin test/cve-gate-check
# Monitor Cloud Build — expect failure at step 13, no deploy
```

**CVE-GATE Pass Criteria:** The `enforce-vulnerability-policy` step exists at the correct position, and HIGH/CRITICAL CVEs cause build failure before deploy.

### 5.10 WEBHOOK: Sanity Rebuild Triggers (Canonical **P0-8**)

**Requirement:** Publishing in Sanity Studio triggers Cloud Build within ~60 seconds. The webhook endpoint rejects unsigned requests with HTTP 401 and implements replay protection with a 10-minute deduplication window.

#### 5.10.1 Test A: Sanity Publish Triggers Cloud Build Within ~60s; Test B: Unsigned Request Returns 401

**Test A — Publish Latency:**

1. Publish a minor content change in Sanity Studio. Record the timestamp.
2. Monitor Cloud Build:

```bash
gcloud builds list --region=us-central1 --limit=5 --format="table(id, status, createTime)"
```

**Expected:** A new build appears with `createTime` within 60 seconds of the publish. Build source provenance indicates a webhook trigger.

**Test B — Unsigned Rejection:**

```bash
curl -X POST https://your-validator-url/webhook \
  -H "Content-Type: application/json" \
  -d '{"_type":"book","_id":"test-unsigned"}'
```

**Expected:** HTTP 401 or 403. No Cloud Build is triggered within 60 seconds.

#### 5.10.2 Test C: Replay of Same Signed Payload Within 10 Minutes Rejected as Duplicate

1. Capture a valid signed webhook payload from Sanity (including the signature header).
2. Send once and confirm acceptance (HTTP 200) and build trigger.
3. Within 10 minutes, resend the identical payload:

```bash
# First delivery — accepted, build triggered
curl -X POST https://your-validator-url/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: sanity-webhook-signature=<sig>" \
  -d '{"_type":"book","_id":"test-replay","_rev":"<rev>"}'

# Second delivery — rejected as duplicate
curl -X POST https://your-validator-url/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: sanity-webhook-signature=<sig>" \
  -d '{"_type":"book","_id":"test-replay","_rev":"<rev>"}'
```

**Expected:** The second delivery returns HTTP 409 (Conflict) or HTTP 200 with `duplicate-payload` in the body. No second Cloud Build is triggered. The validator's replay protection stores a hash of processed payloads with a 10-minute TTL.

**WEBHOOK Pass Criteria:** Sanity publish triggers Cloud Build within ~60 seconds, unsigned requests return 401/403, and replayed signed payloads within the 10-minute window are rejected without duplicate builds.

### 5.11 Full P0 Test Suite Execution

The complete P0 suite should execute after every deployment. **Canonical IDs:** follow **`06`**. Legacy narrative blocks below label sections **5.2–5.10**; **`P0-7`** covers CVE scanning; **`P0-8`** covers webhook rebuild latency (worst-case thresholds in **`06`** / **`13`**); **`P0-9`** covers observability and billing gates.

All nine acceptance criteria must pass for the Phase 2 Definition of Done to be satisfied. A failure in any P0 test or gate is a deployment blocker. The operator should consult the Operational Runbook (Chapter 6) for remediation procedures.

## 6. Operational Runbook

This chapter documents the post-deployment operational procedures required to verify builds, monitor service health, execute rollbacks, and perform maintenance tasks on the Mangu Publishers production environment. All commands assume the operator has authenticated with `gcloud auth login` and set the active project with `gcloud config set project $PROJECT_ID`.

### 6.1 Verifying a Cloud Build Run

#### 6.1.1 Check Build Status and Stream Logs

After a push to `main` or a manual trigger, the first operational task is to confirm the Cloud Build pipeline has completed successfully. The `gcloud builds list` command returns the most recent builds in the `us-central1` region.

```bash
gcloud builds list --region=us-central1 --limit=5
```

Capture the most recent build identifier and inspect its status:

```bash
BUILD_ID=$(gcloud builds list --region=us-central1 --limit=1 --format='value(id)')
gcloud builds describe $BUILD_ID --region=us-central1 --format='value(status)'
```

The expected result is `SUCCESS`. Any other state — `FAILURE`, `CANCELLED`, `TIMEOUT`, or `WORKING` — requires further investigation. To stream the build logs in real time, use the log command:

```bash
gcloud builds log $BUILD_ID --region=us-central1
```

This streams the full output of all 16 build steps to the terminal. If the build is still in progress, the command attaches to the running stream; if the build has completed, it replays the archived log from Cloud Logging.

#### 6.1.2 Step-by-Step Log Verification Checklist

The pipeline consists of 16 discrete steps defined in `cloudbuild.yaml` (Section 4.2). Each step produces characteristic log output that operators must verify during post-deployment review. Table 6-1 enumerates every step, its step identifier, the expected log output pattern, and the failure indicator.

**Table 6-1: Cloud Build Step Verification Checklist**

| Step | ID                             | Expected Output Pattern                                                          | Failure Indicator                                       |
| ---- | ------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | `restore-npm-cache`            | `✓ npm cache restored` or `⚠ No npm cache found — cold install`                  | `gsutil` permission denied or GCS path not found        |
| 2    | `install`                      | `added N packages` without `npm ERR!`                                            | `npm ERR!` exit code 1                                  |
| 3    | `production-audit`             | Audit results displayed, `✓ npm audit complete`                                  | Blocking error (step is non-blocking by design)         |
| 4    | `content-snapshot`             | `✓ Content snapshot generated` with book/author counts                           | Sanity API error, auth failure, or empty dataset        |
| 5    | `generate-routes`              | `✓ Routes JSON generated`                                                        | Missing `.cache/routes.json` output                     |
| 6    | `vite-build`                   | Vite build completes, asset manifest output                                      | Build error, out of memory, or missing assets           |
| 7    | `prerender`                    | `✓ Prerender complete` with page count                                           | Playwright timeout or prerender crash                   |
| 8    | `sitemap`                      | `sitemap.xml` generated with expected entry count                                | Missing sitemap file or route mismatch                  |
| 9    | `audit-secrets`                | Exit code 0, no leaked secret patterns found                                     | `audit-secrets` non-zero exit (secret leakage detected) |
| 10   | `smoke-test`                   | `Smoke check: N passed, 0 failed`                                                | Any failed smoke test (non-zero failure count)          |
| 11   | `docker-build`                 | Docker build output, final image digest                                          | `COPY failed` (missing `dist/`) or build error          |
| 12   | `docker-push`                  | `digest: sha256:…` for both `SHORT_SHA` and `latest` tags                        | Push permission denied or network timeout               |
| 13   | `enforce-vulnerability-policy` | `✓ No HIGH/CRITICAL vulnerabilities — deploy approved`                           | `DEPLOY BLOCKED: HIGH/CRITICAL vulnerability detected`  |
| 14   | `deploy-run`                   | `Service [mangu-publishers] revision [mangu-publishers-XXXXX] has been deployed` | Cloud Run deployment error or quota exceeded            |
| 15   | `prune-tags`                   | `✓ Pruned N old tags` or `✓ No tags to prune`                                    | Cloud Run API error or permission denied                |
| 16   | `save-npm-cache`               | Cache saved to `gs://mangu-publishers-cloudbuild-cache/npm-cache.tgz`            | GCS write failure or bucket not found                   |

Steps 9 and 13 are **gate steps** — failures halt the pipeline. A failure at step 9 indicates the `SANITY_API_READ_TOKEN` or another secret value was detected in the compiled `dist/` output, which constitutes a P0 security incident per Section 5.3.1. A failure at step 13 means the container image contains HIGH or CRITICAL CVEs that must be remediated before deployment proceeds. All other step failures should be treated as blocking errors that prevent continuation of the pipeline.

#### 6.1.3 Verify Build Artifacts and Log Security

After confirming all 16 steps passed, verify that the build artifacts exist in Artifact Registry with the expected tags:

```bash
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/$PROJECT_ID/web-images/mangu-publishers \
  --include-tags --format="table(tags, updateTime)"
```

The output must show two tags for the new image: the commit `SHORT_SHA` and `latest`. If either tag is missing, the push step or tagging logic failed and must be investigated.

To verify that no secrets leaked into the build logs, query Cloud Logging for the token pattern or the environment variable name:

```bash
gcloud logging read \
  "resource.labels.build_id=$BUILD_ID AND \
   (textPayload:\"sk\" OR textPayload:\"SANITY_API_READ_TOKEN\")" \
  --limit=10 --format="table(timestamp, textPayload)"
```

The `options.logging: CLOUD_LOGGING_ONLY` setting in `cloudbuild.yaml` (Section 4.2) prevents secret values from being written to the legacy Cloud Storage log bucket. The query above must return zero results. Any match indicates a logging configuration regression that must be escalated.

### 6.2 Checking Cloud Run Service Health

#### 6.2.1 Describe Service Configuration

Once the build succeeds, verify that Cloud Run deployed the service with the correct configuration parameters. The `gcloud run services describe` command returns the full service specification.

```bash
gcloud run services describe mangu-publishers --region=us-central1 --format="yaml"
```

Table 6-2 specifies every configuration parameter that must be present in the deployed service. Operators must verify each value against the output of the describe command.

**Table 6-2: Cloud Run Expected Configuration Parameters**

| Parameter             | Expected Value                                                                  | Verification Path                                                                | Purpose                                      |
| --------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| Container image       | `us-central1-docker.pkg.dev/$PROJECT_ID/web-images/mangu-publishers:$SHORT_SHA` | `spec.template.spec.containers[0].image`                                         | Immutable SHA-tagged image reference         |
| Container port        | `8080`                                                                          | `spec.template.spec.containers[0].ports[0].containerPort`                        | nginx listens on 8080                        |
| Memory limit          | `512Mi`                                                                         | `spec.template.spec.containers[0].resources.limits.memory`                       | gen2 execution environment requirement       |
| CPU limit             | `1`                                                                             | `spec.template.spec.containers[0].resources.limits.cpu`                          | Single vCPU per instance                     |
| Concurrency           | `80`                                                                            | `spec.template.spec.containerConcurrency`                                        | Max 80 concurrent requests per instance      |
| Min instances         | `0`                                                                             | `spec.template.metadata.annotations["autoscaling.knative.dev/minScale"]`         | Scale to zero when idle                      |
| Max instances         | `10`                                                                            | `spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"]`         | Upper bound for cost control                 |
| Execution environment | `gen2`                                                                          | `spec.template.metadata.annotations["run.googleapis.com/execution-environment"]` | Second-gen Cloud Run runtime                 |
| CPU throttling        | `true`                                                                          | `spec.template.metadata.annotations["run.googleapis.com/cpu-throttling"]`        | Throttle CPU outside request handling        |
| Default URL           | disabled                                                                        | `--no-default-url` flag                                                          | Traffic routes through Firebase Hosting only |
| Labels                | `env=prod,app=mangu-publishers`                                                 | `spec.template.metadata.labels`                                                  | Resource identification and filtering        |

Any deviation from the values in Table 6-2 indicates a deployment configuration drift. The most common causes are manual service edits through the GCP Console, prior deployments with different flags, or substitution variable overrides in the Cloud Build trigger.

#### 6.2.2 Health Check via Service URL

After verifying the configuration, validate that the service responds correctly to HTTP requests. Retrieve the direct Cloud Run URL (not the Firebase Hosting domain) and execute health checks:

```bash
RUN_URL=$(gcloud run services describe mangu-publishers --region=us-central1 --format='value(status.url)')
curl -s -o /dev/null -w "%{http_code}" "$RUN_URL/healthz"
```

The expected HTTP status code is `200`. Next, verify the home page:

```bash
curl -s -o /dev/null -w "%{http_code}" "$RUN_URL/"
```

This must also return `200`. Finally, inspect the security headers returned by the nginx container:

```bash
curl -sI "$RUN_URL/" | grep -E "content-security-policy|x-frame-options|x-content-type-options|referrer-policy|cache-control"
```

The response must include `X-Frame-Options: DENY` (or `SAMEORIGIN`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a `Content-Security-Policy` header that does not include `api.sanity.io` in the connect-src directive (per P0-1 enforcement, Section 5.3.1).

Check the traffic distribution to confirm 100% of traffic is routed to the newly deployed revision:

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="json(status.traffic)" | jq '.status.traffic'
```

The expected output is a single traffic entry with `"percent": 100` pointing to the latest revision name (e.g., `mangu-publishers-abcde12`). Multiple traffic entries with split percentages indicate a partial rollout or an incomplete rollback that requires correction.

#### 6.2.3 Monitor Metrics via Cloud Monitoring

Request count and memory utilization metrics provide operational insight into the health of the deployed service. Query Cloud Monitoring for request counts in the last hour, grouped by response code:

```bash
gcloud monitoring metrics list \
  --filter='metric.type="run.googleapis.com/request_count"' \
  --format="table(metric.labels.response_code, points.value.int64_value)"
```

Check memory utilization to ensure the 512Mi allocation is sufficient:

```bash
gcloud monitoring metrics list \
  --filter='metric.type="run.googleapis.com/container/memory/utilizations"' \
  --format="table(points.value.double_value)"
```

Memory utilization consistently above 80% indicates the 512Mi limit may be insufficient for the current workload or that a memory leak exists in the container. Sustained 4xx or 5xx error rates above 1% of total requests warrant investigation of the application logs via Cloud Logging.

### 6.3 Rollback Procedure

#### 6.3.1 List Revisions and Identify Last Good Revision

If a deployment introduces errors, the rollback procedure moves traffic from the current revision to the previously known-good revision. First, list all revisions for the service:

```bash
gcloud run revisions list --service=mangu-publishers --region=us-central1 \
  --format="table(name, creationTimestamp, trafficPercent)"
```

The output lists revisions in reverse chronological order. The revision at the top (100% traffic) is the current deployment. The target for rollback is the revision immediately below it — the most recent revision with `TRAFFIC_PERCENT: 0` that predates the bad deployment. If the revision history contains more than one candidate, select the revision with the latest `CREATION_TIMESTAMP` that was known to be stable.

#### 6.3.2 Roll Back Traffic

Execute the traffic shift using the `gcloud run services update-traffic` command with the `--to-revisions` flag. The command below captures the second revision in the list (the previous one) and routes 100% of traffic to it:

```bash
PREV_REVISION=$(gcloud run revisions list --service=mangu-publishers \
  --region=us-central1 --format="value(name)" | sed -n '2p')
gcloud run services update-traffic mangu-publishers --region=us-central1 \
  --to-revisions "$PREV_REVISION=100" --yes
```

The `--yes` flag suppresses the interactive confirmation prompt, which is appropriate in automated or time-sensitive rollback scenarios. After the command completes, verify the traffic distribution:

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="json(status.traffic)" | jq '.status.traffic'
```

The output must show a single entry with `"percent": 100` assigned to `$PREV_REVISION`.

#### 6.3.3 Verify Rollback and Clean Up

Confirm the rollback by requesting the public endpoint through Firebase Hosting:

```bash
curl -s -o /dev/null -w "%{http_code}" "https://www.yourdomain.com/"
```

An HTTP 200 response confirms the rollback is serving correctly. If the custom domain returns errors, check the Cloud Run URL directly to isolate Firebase Hosting issues from application issues.

After confirming the rollback is stable for at least 30 minutes, delete the faulty revision to free resources:

```bash
BAD_REVISION=$(gcloud run revisions list --service=mangu-publishers \
  --region=us-central1 --format="value(name)" | head -1)
gcloud run revisions delete "$BAD_REVISION" --region=us-central1 --quiet
```

Deletion of the bad revision is irreversible. Do not delete the revision until the rollback has been validated and the root cause of the failure has been documented.

### 6.4 Manual Rebuild Triggers

#### 6.4.1 Method Comparison

Four distinct methods exist for triggering a rebuild when no code changes are required, such as when Sanity content has been updated but the application source is unchanged. Table 6-3 compares each method across six operational dimensions.

**Table 6-3: Manual Rebuild Method Comparison**

| Method                       | Prerequisites                           | Speed     | Automation Readiness   | Audit Trail                               | Best For                            | Risk Level |
| ---------------------------- | --------------------------------------- | --------- | ---------------------- | ----------------------------------------- | ----------------------------------- | ---------- |
| `gcloud builds submit`       | Local gcloud auth, `cloudbuild.yaml`    | ~8–12 min | Manual only            | Cloud Build history                       | Ad-hoc rebuilds, local testing      | Low        |
| `gcloud builds triggers run` | Trigger `mangu-publishers-main` exists  | ~8–12 min | Scriptable via API     | Cloud Build history + trigger attribution | Operator-initiated content rebuilds | Low        |
| Empty commit + push          | Write access to `main`, Git CLI         | ~8–12 min | Fully automated via CI | Git commit + Cloud Build history          | Routine content-update rebuilds     | Low        |
| Sanity webhook (M7)          | Webhook validator deployed, HMAC secret | ~3–5 min  | Fully automated        | Cloud Build history + webhook log         | Production content publishing       | Low        |

The Sanity webhook method (Section 6.4.5) is the target state after Milestone 7 implementation. Until then, the empty commit method (Section 6.4.4) is the recommended approach for routine rebuilds because it preserves a complete audit trail in both Git and Cloud Build.

#### 6.4.2 Method 1: gcloud builds submit

Submit a build manually with explicit substitutions matching the production trigger configuration:

```bash
gcloud builds submit --config=cloudbuild.yaml --region=us-central1 \
  --substitutions=_REGION=us-central1,_AR_REPO=web-images,\
  _SERVICE=mangu-publishers,_CACHE_BUCKET=mangu-publishers-cloudbuild-cache \
  --async
```

The `--async` flag returns immediately without waiting for the build to complete. The `SANITY_API_READ_TOKEN` is automatically resolved from Secret Manager via the `availableSecrets` binding in `cloudbuild.yaml` (Section 4.2). Monitor the build with `gcloud builds log` as described in Section 6.1.1.

#### 6.4.3 Method 2: gcloud builds triggers run

Trigger the existing GitHub-connected build trigger directly:

```bash
gcloud builds triggers run mangu-publishers-main --region=us-central1 --branch=main
```

This method executes the same `cloudbuild.yaml` configuration used by the Developer Connect webhook but does not require a Git push. It is the preferred method when an operator needs to rebuild from the exact same commit currently at `main` head without introducing a new commit. The trigger attribution in Cloud Build history distinguishes these runs from webhook-triggered builds.

#### 6.4.4 Method 3: Empty Git Commit

Create an empty commit and push to `main` to trigger the Developer Connect webhook:

```bash
git commit --allow-empty -m "ops: rebuild after content update $(date +%s)"
git push origin main
```

The `$(date +%s)` suffix ensures each commit message is unique, preventing Git from rejecting the push as a duplicate. The Developer Connect webhook fires within seconds of the push, queuing a new Cloud Build run. This method is fully auditable — the Git history contains a permanent record of every rebuild trigger.

#### 6.4.5 Method 4: Sanity Webhook (Automated After M7)

After Milestone 7, a Sanity webhook validator endpoint receives signed `POST` requests from Sanity Studio on every content publish event. The validator verifies the HMAC signature and replay protection, then triggers Cloud Build via the REST API. The flow is:

1. Content editor publishes a change in Sanity Studio.
2. Sanity sends a signed `POST` to the validator endpoint.
3. Validator verifies the HMAC signature and timestamp freshness.
4. Validator calls Cloud Build API to trigger `mangu-publishers-main`.
5. Build completes in approximately 3–5 minutes (the reduction from 8–12 minutes is due to cache warming from frequent builds).

Verify webhook-triggered builds by filtering Cloud Build history for builds initiated by the API:

```bash
gcloud builds list --region=us-central1 --limit=10 \
  --format="table(id, status, source)"
```

Look for builds where the source provenance indicates API trigger rather than Developer Connect webhook.

### 6.5 Token Rotation Procedure

#### 6.5.1 Generate New Token and Add to Secret Manager

The `SANITY_API_READ_TOKEN` must be rotated every 90 days or immediately upon suspected compromise. Generate a new token in the Sanity Studio management console:

1. Navigate to `sanity.io/manage` → Project → API → Tokens.
2. Click "Add API token."
3. Set the name to `Mangu Publishers Build (Rotated YYYY-MM-DD)`.
4. Assign the **Viewer** role (read-only — no write permissions).
5. Copy the token value (starts with `sk`).

Add the new token as a new version in Secret Manager:

```bash
echo -n "sk-your-new-token-here" | \
  gcloud secrets versions add sanity-api-read-token --data-file=-
```

Verify the new version was created with state `ENABLED`:

```bash
gcloud secrets versions list sanity-api-read-token \
  --format="table(version, state, createTime)"
```

Cloud Build's `availableSecrets` configuration references `versions/latest`, which automatically resolves to the most recently enabled version. Confirm the latest pointer resolves to the new token:

```bash
gcloud secrets versions access latest --secret=sanity-api-read-token
```

#### 6.5.2 Verify Build Uses New Token

Trigger a test build to confirm the new token functions correctly:

```bash
gcloud builds triggers run mangu-publishers-main --region=us-central1 --branch=main
```

Monitor the build logs for the content-snapshot step:

```bash
gcloud builds log $(gcloud builds list --region=us-central1 --limit=1 --format='value(id)') \
  --region=us-central1
```

The log must show `📥 Fetching content from Sanity...` followed by book and author counts matching the current dataset. A failure at this step indicates the token lacks the Viewer role or the Secret Manager binding is misconfigured.

#### 6.5.3 Disable Old Token

Table 6-4 defines the phased timeline for completing token rotation safely.

**Table 6-4: Token Rotation Timeline**

| Phase | Time After Rotation | Action                                                   | Command / Location                                                                                                                                                                                                                     |
| ----- | ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T+0   | Immediate           | Generate new token, add to Secret Manager as new version | `gcloud secrets versions add sanity-api-read-token`                                                                                                                                                                                    |
| T+0   | Immediate           | Verify `versions/latest` resolves to new token           | `gcloud secrets versions access latest --secret=sanity-api-read-token`                                                                                                                                                                 |
| T+0   | Immediate           | Trigger test build and verify content snapshot succeeds  | `gcloud builds triggers run mangu-publishers-main --branch=main`                                                                                                                                                                       |
| T+24h | 24 hours            | Disable old Secret Manager version (do NOT delete)       | `OLD_VERSION=$(gcloud secrets versions list sanity-api-read-token --format="table(version, state)" \| grep ENABLED \| tail -1 \| awk '{print $1}')` then `gcloud secrets versions disable $OLD_VERSION --secret=sanity-api-read-token` |
| T+7d  | 7 days              | Delete old Sanity token from Sanity Studio console       | `sanity.io/manage` → API → Tokens → Delete old token                                                                                                                                                                                   |

The 24-hour window between enabling the new version and disabling the old version ensures that any in-flight builds or cached references have time to drain. The 7-day window before deleting the Sanity token provides a recovery path if the new token is found to be defective after extended use. After 7 days, only one `ENABLED` Secret Manager version should remain.

### 6.6 Billing and Cost Monitoring

#### 6.6.1 Check Billing Budgets and Alert Thresholds

Monitor billing through both gcloud commands and the GCP Console. List active billing budgets:

```bash
gcloud billing budgets list --billing-account=YOUR_BILLING_ACCOUNT_ID
```

Inspect the alert thresholds for each budget:

```bash
gcloud billing budgets describe BUDGET_ID --billing-account=YOUR_BILLING_ACCOUNT_ID
```

In the GCP Console, navigate to Billing → Budgets & Alerts and verify that alert thresholds are configured at 50%, 75%, and 90% of the monthly budget. Confirm that notification channels (email addresses) are active and that at least one channel includes the on-call operator.

View the current month's spend with:

```bash
gcloud billing accounts get-usage-report YOUR_BILLING_ACCOUNT_ID \
  --start-time=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d) \
  --end-time=$(date +%Y-%m-%d)
```

For the Mangu Publishers project, the primary cost drivers are Cloud Run container instances (compute time), Artifact Registry storage (container images), and Cloud Build execution (build minutes). Cloud Run costs scale with traffic volume due to the `min-instances=0` setting; Artifact Registry costs scale with the number of retained image versions.

#### 6.6.2 Check Artifact Registry Image Count and Cleanup Policy

Count the total number of image versions stored in the repository:

```bash
IMAGE_COUNT=$(gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/$PROJECT_ID/web-images/mangu-publishers \
  --format="value(digest)" | wc -l)
echo "Total images: $IMAGE_COUNT"
```

Verify the cleanup policy is active:

```bash
gcloud artifacts repositories describe web-images --location=us-central1 \
  --format="yaml(cleanupPolicies)"
```

The cleanup policy has two rules: (1) **keep-recent-tagged-release-images** retains the 15 most recent tagged images, and (2) **delete-old-untagged-images** deletes untagged images older than 3 days (259,200 seconds). If `IMAGE_COUNT` exceeds 50, the cleanup policy may not be executing correctly and requires investigation.

#### 6.6.3 Manual Image Cleanup

If the cleanup policy fails or if immediate space reclamation is required, delete specific images manually:

```bash
gcloud artifacts docker images delete \
  us-central1-docker.pkg.dev/$PROJECT_ID/web-images/mangu-publishers:old-tag \
  --delete-tags --quiet
```

Use `--delete-tags` to remove the tag reference before deleting the underlying image layer. This command is irreversible; verify the tag is not referenced by an active Cloud Run revision before execution.

### 6.7 Tag Pruning Operations

#### 6.7.1 Automatic and Manual Execution

Firebase Hosting's `pinTag: true` configuration creates a new Cloud Run traffic tag on every deployment. Without pruning, these tags accumulate indefinitely, eventually exceeding Cloud Run service limits and degrading the GCP Console performance for the service.

**Automatic execution** occurs as Cloud Build step 15 (`prune-tags`) immediately after every successful deployment. The step executes the `prune-cloud-run-tags.sh` script with default parameters:

```yaml
- id: prune-tags
  name: gcr.io/google.com/cloudsdktool/cloud-sdk:slim
  entrypoint: bash
  args:
    - '-c'
    - |
      set -euo pipefail
      bash scripts/ops/prune-cloud-run-tags.sh || true
```

The `|| true` suffix ensures that a tag pruning failure does not fail the entire build.

**Manual execution** is required if step 15 was skipped, failed, or if an operator needs to prune tags outside the build pipeline. Set the required environment variables and execute:

```bash
export SERVICE=mangu-publishers
export REGION=us-central1
export KEEP=50
chmod +x scripts/ops/prune-cloud-run-tags.sh
./scripts/ops/prune-cloud-run-tags.sh
```

The script queries all traffic tags on the service, sorts them by creation time, and removes tags beyond the `KEEP` threshold (default 50). The expected output is either `✓ No tags to prune (total tags ≤ 50)` or `✓ Pruned N old tags` with a per-tag log of deletions.

#### 6.7.2 Verify Tag Count and Optional Scheduling

After pruning, verify the remaining tag count:

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="json(status.traffic)" | \
  jq '[.status.traffic[] | select(.tag != null)] | length'
```

The count must be less than or equal to 50 (or the `KEEP` value if overridden). List the remaining tags for visual confirmation:

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="json(status.traffic)" | \
  jq '.status.traffic[] | select(.tag != null) | .tag'
```

For additional operational safety, a Cloud Scheduler job can run the pruning script weekly as a fallback. The Cloud Build step 15 approach is preferred because it runs immediately after each deploy, keeping tags in sync with actual deployments. A scheduled job only catches cases where the build step was bypassed. To create the job:

```bash
gcloud scheduler jobs create http prune-cloud-run-tags-weekly \
  --schedule="0 2 * * 0" \
  --uri="https://cloudbuild.googleapis.com/v1/projects/$PROJECT_ID/builds" \
  --http-method=POST \
  --time-zone="UTC"
```

This schedule runs at 02:00 UTC every Sunday. The job should target a minimal Cloud Build configuration that executes only the tag pruning script, not the full 16-step pipeline. Before enabling a scheduled job, verify through the Cloud Build history that step 15 has been failing silently — if step 15 is working correctly, the scheduled job will be redundant but harmless.

## 7. Risk Assessment & Troubleshooting

This chapter catalogs identified risks, milestone-specific failure modes, cross-cutting issues, and the SDLC quality gates that prevent them. Every risk is scored by probability and impact, assigned an owner, and paired with concrete mitigation. Troubleshooting entries follow a Symptom → Root Cause → Exact Fix structure. The seven SDLC quality gates form the primary defense layer.

### 7.1 Risk Register

The risk register contains eight risks spanning security, infrastructure, deployment, and tooling. Risks R1–R6 were discovered during Phase 2 implementation; R7 and R8 were added after production incident review.

#### 7.1.1 Risk Matrix

| ID  | Description                                                               | Probability | Impact   | Mitigation                                                                            | Owner             |
| --- | ------------------------------------------------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------- | ----------------- |
| R1  | Secret leakage via `VITE_` prefix inlining token into browser bundle      | Medium      | Critical | `audit:secrets` script, Zod validation, grep checks across `src/`                     | Security Lead     |
| R2  | Cloud Run deployment failure due to 256Mi memory floor on gen2            | High        | High     | ADR-003 correction to `--memory=512Mi`; validate in cloudbuild.yaml                   | Platform Engineer |
| R3  | Developer Connect OAuth interruption blocking GitHub-triggered builds     | Medium      | High     | Verify GitHub owner rights before starting; allow retry with delete/recreate          | Platform Engineer |
| R4  | Immutable tag conflict on `:latest` push blocking Artifact Registry write | Medium      | Medium   | Remove `--immutable-tags` from repository or push SHA-only images                     | Platform Engineer |
| R5  | Vulnerability scan (HIGH/CRITICAL CVE) blocking deployment pipeline       | Medium      | Medium   | Update base image to latest patch; acceptable-risk override with documented exception | Security Lead     |
| R6  | Playwright timeout during prerender in Cloud Build environment            | Medium      | Medium   | Increase step timeout to 600s; upgrade Playwright image to `v1.59.1-noble`            | Build Engineer    |
| R7  | Webhook content update not reflected on site after Sanity publish         | Medium      | Medium   | Clear npm cache; verify token dataset access; check webhook payload                   | Build Engineer    |
| R8  | `.env.local` committed to git exposing SANITY_API_READ_TOKEN              | Low         | Critical | `git filter-repo` history rewrite; rotate token; force push; update `.gitignore`      | Security Lead     |

#### 7.1.2 R1 — Secret Leakage via VITE\_ Prefix

A developer reintroduces `VITE_SANITY_API_READ_TOKEN` or fails to complete the rename to `SANITY_API_READ_TOKEN`, causing Vite to inline the secret into the client-side JavaScript bundle. Vite exposes all `VITE_`-prefixed variables to browser code via `import.meta.env` — any visitor could extract the token from `dist/assets/*.js` and gain read access to all Sanity content.

**Mitigation layers:** (1) `npm run audit:secrets` (Cloud Build step 9) greps `dist/assets/` for the token string and fails the build if found; (2) `scripts/_lib/node-env.ts` validates `SANITY_API_READ_TOKEN` via `z.string().min(1)` — the absence of the `VITE_` prefix ensures Vite ignores it; (3) build scripts live in `scripts/`, not `src/` — importing `node-env.ts` from `src/` would bundle the token; (4) Gate 3 (REVIEW) requires `git diff --cached | grep -i token` before every commit.

**Residual risk:** A developer could intentionally add `VITE_SANITY_API_READ_TOKEN` to `.env.local` and reference it from `src/`. The `audit:secrets` script is the final backstop.

#### 7.1.3 R2 — Cloud Run Deployment Failure (256Mi Memory)

The `cloudbuild.yaml` deploy step specifies `--memory=256Mi`, which Cloud Run gen2 rejects because 512 MiB is the architectural minimum. The v11 specification incorrectly specified 256Mi; ADR-003 records the correction. Verify before pushing: `grep -- "--memory=512Mi" cloudbuild.yaml` must match. If 256Mi is present: `sed -i 's/--memory=256Mi/--memory=512Mi/g' cloudbuild.yaml`. Cost impact is negligible — Cloud Run bills for actual usage, and nginx static serving consumes less than 50 MiB.

#### 7.1.4 R3 — Developer Connect OAuth Interruption

The browser-based OAuth flow for Developer Connect fails, or the GitHub app is not installed on the repository, blocking automatic builds. Triggers: operator lacks Owner/Admin rights; browser popup blocked; OAuth session expired; app installation skipped.

**Mitigation:** Confirm GitHub ownership before initiating. Use a browser with no popup blockers. If OAuth fails, delete and retry:

```bash
gcloud developer-connect connections delete my-github-connection --location="$REGION"
gcloud developer-connect connections create my-github-connection --location="$REGION" --github-config-app=developer-connect
```

Verify status shows `ACTIVE`.

#### 7.1.5 R4 — Immutable Tag Conflict on :latest Push

Artifact Registry created with `--immutable-tags` prevents overwriting `:latest`. **Option A (recommended):** `gcloud artifacts repositories update "$AR_REPO" --location="$REGION" --no-immutable-tags` — SHA-tagged images provide true immutability; `:latest` is a convenience pointer that must be mutable. **Option B:** Push SHA-only by removing `:latest` from the `docker-build` step. **Option C:** Delete existing tag before push — race-prone in CI, not recommended.

#### 7.1.6 R5 — Vulnerability Scan Blocking Deployment

Cloud Build step 13 blocks deployment on HIGH or CRITICAL CVEs. Some CVEs in the base image may not be exploitable in the Mangu Publishers context (static file serving, no runtime secrets). **Mitigation hierarchy:** (1) update base image to latest patch (e.g., `nginx:1.27.1-alpine`); (2) switch to hardened image (`gcr.io/distroless/nginx`); (3) temporary override — change `grep -qE "CRITICAL|HIGH"` to `grep -qE "CRITICAL"` with documented exception. Identify specific vulnerabilities: `gcloud artifacts docker images list-vulnerabilities <image> --location="$REGION" --format="table(vulnerability, package, version, effectiveSeverity)"`.

#### 7.1.7 R6 — Playwright Timeout in Cloud Build

The prerender step uses Playwright Chromium; in Cloud Build, browser launch or navigation exceeds the default 30-second timeout. Root causes: slower worker I/O, pinned image compatibility, or static server startup failure. Apply in order: (1) increase timeout to 60000 in `scripts/prerender.ts`; (2) add `timeout: 600s` to the Cloud Build step; (3) upgrade Playwright image from `v1.43.0-jammy` to `v1.59.1-noble`.

#### 7.1.8 R7 — Webhook Content Not Updating Site

A Sanity publish triggers Cloud Build but the site shows stale content. Causes: stale npm cache with old `contentSnapshot.json`; token lacking dataset access; webhook payload missing the document type. Check Cloud Build logs — book count should match Sanity. If not, clear cache: `gsutil rm gs://mangu-publishers-cloudbuild-cache/npm-cache.tgz`. Verify webhook triggers on Create, Update, Delete events.

#### 7.1.9 R8 — .env.local Committed to Git

A developer commits `.env.local` containing `SANITY_API_READ_TOKEN`. Recovery: (1) `git filter-repo --path .env.local --invert-paths`; (2) `echo ".env.local" >> .gitignore && echo ".env*.local" >> .gitignore`; (3) rotate token in Sanity Studio; (4) update Secret Manager: `echo -n "sk-new-token" | gcloud secrets versions add sanity-api-read-token --data-file=-`; (5) `git push --force-with-lease origin main`. If the token was pushed to a remote, treat it as compromised — anyone who fetched during the exposure window has a copy.

### 7.2 Milestone-Specific Troubleshooting

#### 7.2.1 M1 — Local Security Hardening

**M1-1: Zod Validation Error — "SANITY_API_READ_TOKEN is required"**

**Symptom:** Build outputs `BUILD ENVIRONMENT VALIDATION FAILED` with `SANITY_API_READ_TOKEN is required`.
**Root Cause:** `SANITY_API_READ_TOKEN` is not set; `node-env.ts` uses `z.string().min(1)` requiring a non-empty string.
**Exact Fix:** `echo "SANITY_API_READ_TOKEN=sk-your-actual-token" >> .env.local`, verify with `cat .env.local`. Always run `npm run build` locally before pushing.

**M1-2: VITE_SANITY_API_READ_TOKEN Still Found in grep**

**Symptom:** `grep -rn "VITE_SANITY_API_READ_TOKEN" .` returns matches in source files.
**Root Cause:** Rename from `VITE_SANITY_API_READ_TOKEN` to `SANITY_API_READ_TOKEN` was incomplete.
**Exact Fix:** Run find/sed rename across `.ts`, `.tsx`, `.js`, `.yaml`, `.env*` files (macOS: `sed -i ''`; Linux: `sed -i`). Verify grep returns empty. Critical: verify no `import.meta.env.VITE_SANITY_API_READ_TOKEN` exists in `src/`.

**M1-3: audit:secrets Fails After Build**

**Symptom:** `npm run audit:secrets` outputs a `dist/assets/` file path containing the literal token string; exits code 1.
**Root Cause:** Token inlined into Vite bundle. Occurs when: (a) `VITE_` prefix remains in `src/`, (b) `node-env.ts` imported from a Vite-bundled file, or (c) token hardcoded in source.
**Exact Fix:** (1) `grep -rn "SANITY_API_READ_TOKEN" src/` — should return nothing; (2) `grep -rn "node-env" src/` — should return nothing; (3) if `node-env.ts` is in `src/lib/`, move to `scripts/_lib/` and update imports; (4) `rm -rf dist/ && npm run build && npm run audit:secrets`.

#### 7.2.2 M2 — Build Pipeline Scripts

**M2-1: build:content Fails with "Unauthorized - Invalid token"**

**Symptom:** `Content snapshot failed: Error: Unauthorized - Invalid token`.
**Root Cause:** `SANITY_API_READ_TOKEN` is invalid, expired, or lacks read permissions.
**Exact Fix:** In Sanity Studio (sanity.io/manage → API → Tokens), verify token has "Viewer" or "Editor" role. Create new token with "Viewer" role if needed, update `.env.local`, then test: `npx tsx scripts/build-content-snapshot.ts`.

**M2-2: build:prerender Fails with Playwright Browser Error**

**Symptom:** `Error: browserType.launch: Executable doesn't exist at /ms-playwright/chromium-...`.
**Root Cause:** Playwright browsers not installed locally.
**Exact Fix:** `npx playwright install chromium`. Verify version matches `cloudbuild.yaml` pin (v1.43.0). If mismatch: `npm install --save-dev playwright@1.43.0 && npx playwright install chromium`.

**M2-3: build:prerender Hangs Indefinitely**

**Symptom:** `Prerendering HTML shells... Rendering /...` hangs for more than 60 seconds.
**Root Cause:** Static file server failed to start, or port 4173 is in use.
**Exact Fix:** Check port: `lsof -i :4173`. Kill process: `kill -9 $(lsof -t -i:4173) 2>/dev/null`. Verify `serve` installed: `npm ls serve || npm install --save-dev serve`. Diagnose: `DEBUG=* npx tsx scripts/prerender.ts`.

**M2-4: smoke:check-routes Fails with Missing Files**

**Symptom:** `MISSING: /books/my-book → dist/books/my-book/index.html`.
**Root Cause:** Route in `.cache/routes.json` has no corresponding `index.html` in `dist/` — prerender failed for that route.
**Exact Fix:** Check: `cat .cache/routes.json | grep "/books/my-book"` and `ls -la dist/books/my-book/`. Re-run: `npm run build && npm run smoke:check-routes`.

#### 7.2.3 M3 — Docker Container

**M3-1: Docker Build Fails with "COPY dist/" Error**

**Symptom:** `COPY failed: file not found in build context or excluded by .dockerignore: dist`.
**Root Cause:** `dist/` does not exist. Dockerfile has no fallback (ADR-007).
**Exact Fix:** `npm run build && ls -la dist/index.html && docker build -t mangu-publishers-local .`. Do NOT add `RUN npm run build` to the Dockerfile.

**M3-2: Docker Build Fails with "index.html missing"**

**Symptom:** `FATAL: dist/index.html missing`.
**Root Cause:** `dist/` exists but is empty or missing `index.html`. Vite build failed silently or prerender produced no output.
**Exact Fix:** `rm -rf dist/ && npm run build && ls -la dist/index.html && docker build -t mangu-publishers-local .`.

**M3-3: Container Runs but Health Check Returns 404**

**Symptom:** `curl http://localhost:8080/healthz` returns `404 Not Found`.
**Root Cause:** `nginx.conf.template` missing the `/healthz` location block, or template not processed during startup.
**Exact Fix:** Check container: `docker exec <id> cat /etc/nginx/conf.d/default.conf | grep -A5 "healthz"`. Verify template: `cat nginx.conf.template | grep -A5 "healthz"`. Fix template and rebuild.

**M3-4: Container Runs as Root Instead of UID 1001**

**Symptom:** `docker exec mangu-publishers-local id` returns `uid=0(root)`.
**Root Cause:** Dockerfile missing `USER 1001` directive.
**Exact Fix:** Check: `cat Dockerfile | grep -E "USER|uid|gid"`. Expected: `RUN addgroup -g 1001 -S nginxuser && adduser -u 1001 -S nginxuser -G nginxuser` and `USER 1001`. Add if missing.

#### 7.2.4 M4 — GCP Foundation

**M4-1: gcloud artifacts repositories create Permission Denied**

**Symptom:** `PERMISSION_DENIED: Permission 'artifactregistry.repositories.create' denied`.
**Root Cause:** Authenticated gcloud user lacks `roles/artifactregistry.admin`.
**Exact Fix:** `gcloud auth list`, then `gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="user:your-email@example.com" --role="roles/artifactregistry.admin"`.

**M4-2: Secret Manager Permission Denied for Cloud Build SA**

**Symptom:** `PERMISSION_DENIED: Permission 'secretmanager.secrets.setIamPolicy' denied`.
**Root Cause:** Cloud Build SA lacks `roles/secretmanager.secretAccessor` on the secret.
**Exact Fix:** Verify SA: `gcloud iam service-accounts list | grep cloudbuild-mangu-publishers`. Grant: `gcloud secrets add-iam-policy-binding sanity-api-read-token --member="serviceAccount:$BUILD_SA" --role="roles/secretmanager.secretAccessor"`. Verify: `gcloud secrets get-iam-policy sanity-api-read-token`.

**M4-3: Developer Connect OAuth Not Completing**

**Symptom:** `Failed to create connection: OAuth flow did not complete`.
**Root Cause:** Browser OAuth interrupted, or GitHub app not installed on repository.
**Exact Fix:** (1) Verify Owner/Admin rights on GitHub repo; (2) re-run connection creation; (3) complete OAuth and install app; (4) verify status: `gcloud developer-connect connections list --location="$REGION"` shows `ACTIVE`. If stuck, delete and recreate the connection.

**M4-4: Cloud Build Trigger Fails with "service account not found"**

**Symptom:** `INVALID_ARGUMENT: service account "..." does not exist`.
**Root Cause:** Service account not created before trigger, or email format wrong.
**Exact Fix:** Verify SA: `gcloud iam service-accounts list | grep cloudbuild-mangu-publishers`. If missing: `gcloud iam service-accounts create "$BUILD_SA_NAME" --display-name="Cloud Build Mangu Publishers deployer"`. Wait 30 seconds for IAM propagation, retry trigger creation.

#### 7.2.5 M5 — Cloud Build End-to-End

**M5-1: Cloud Run Deploy Rejected Due to 256Mi Memory**

**Symptom:** `Invalid value specified for memory. For 1.0 CPU, memory must be between 512Mi and 4Gi inclusive`.
**Root Cause:** `cloudbuild.yaml` uses `--memory=256Mi`; Cloud Run gen2 requires 512Mi minimum.
**Exact Fix:** `sed -i 's/--memory=256Mi/--memory=512Mi/g' cloudbuild.yaml`. Verify: `grep "memory=" cloudbuild.yaml` shows `--memory=512Mi`. Commit and push.

**M5-2: --no-default-url Flag Rejection**

**Symptom:** `unrecognized arguments: --no-default-url`.
**Root Cause:** gcloud CLI version outdated.
**Exact Fix:** `gcloud components update`. Verify: `gcloud version | grep "Google Cloud SDK"` — should be 500.0.0+. If updating not possible, deploy without flag and apply as post-deploy update.

**M5-3: Cloud Build secretEnv Not Injecting the Token**

**Symptom:** Content-snapshot fails with `Unauthorized - Invalid token` despite secret existing.
**Root Cause:** `secretEnv` binding misconfigured, secret name mismatch, or SA lacks `secretAccessor`.
**Exact Fix:** (1) `gcloud secrets versions access latest --secret=sanity-api-read-token` returns token; (2) `grep -A10 "content-snapshot" cloudbuild.yaml | grep -A5 "secretEnv"` shows `secretEnv: ["SANITY_API_READ_TOKEN"]`; (3) `availableSecrets` section points to correct secret version; (4) `gcloud secrets get-iam-policy sanity-api-read-token | grep "$BUILD_SA"` shows accessor role.

**M5-4: Artifact Registry Immutable Tag Conflict** — See R4 (Section 7.1.5). **M5-5: Vulnerability Scan Blocks Deployment** — See R5 (Section 7.1.6). **M5-6: Playwright Timeout During Prerender** — See R6 (Section 7.1.7).

#### 7.2.6 M6 — Firebase Hosting

**M6-1: Firebase Deploy Fails with "public directory not found"**

**Symptom:** `Error: public directory "public-placeholder" does not exist`.
**Root Cause:** `public-placeholder/` directory not created.
**Exact Fix:** `mkdir -p public-placeholder && touch public-placeholder/.gitkeep`. Verify `firebase.json` has `"public": "public-placeholder"`, then deploy.

**M6-2: Firebase Hosting Serves 404 for All Routes**

**Symptom:** `curl https://www.yourdomain.com/` returns `404` despite Cloud Run being healthy.
**Root Cause:** Firebase rewrite not configured, Cloud Run not running, or missing `run.invoker` IAM binding.
**Exact Fix:** (1) Verify `firebase.json` rewrites; (2) verify Cloud Run: `gcloud run services describe mangu-publishers --region=us-central1`; (3) test direct: `curl -s -o /dev/null -w "%{http_code}" $(gcloud run services describe mangu-publishers --region=us-central1 --format='value(status.url)')`; (4) if Cloud Run works but Firebase doesn't: `gcloud run services add-iam-policy-binding mangu-publishers --region=us-central1 --member="allUsers" --role="roles/run.invoker"`.

#### 7.2.7 M7 — Production Guardrails

**M7-1: Sanity Webhook Triggers Build but Content Does Not Update**

**Symptom:** Cloud Build starts after Sanity publish, but site shows stale content.
**Root Cause:** Cached `contentSnapshot.json`, stale npm cache, or incorrect webhook payload.
**Exact Fix:** Check Cloud Build logs for content counts. If mismatch, clear cache: `gsutil rm gs://mangu-publishers-cloudbuild-cache/npm-cache.tgz`. Verify webhook triggers on Create/Update/Delete.

**M7-2: Sentry Source Maps Not Uploading**

**Symptom:** `Source map upload failed: Authentication error: invalid token`.
**Root Cause:** `SENTRY_AUTH_TOKEN` missing or invalid.
**Exact Fix:** Verify: `cat .env.local | grep SENTRY_AUTH_TOKEN`. Check `vite.config.ts` — `authToken` must read from `process.env.SENTRY_AUTH_TOKEN`. For CI, add to `cloudbuild.yaml` via `secretEnv`.

**M7-3: Cloud Run Tag Pruning Script Fails**

**Symptom:** `jq: error (at <stdin>:0): Cannot iterate over null (null)`.
**Root Cause:** Cloud Run service has no traffic tags, or `jq` not installed.
**Exact Fix:** Verify jq: `jq --version || apt-get install jq`. Check tags: `gcloud run services describe mangu-publishers --region=us-central1 --format='json(status.traffic)' | jq '.status.traffic[]?.tag'`. Script handles empty sets via `|| true`. If syntax fails, add `select(.tag != null)` to the jq pipeline.

### 7.3 Cross-Cutting Issues

#### 7.3.1 Cloud Build Logs Showing Secret Values

**Symptom:** Cloud Build logs contain `export SANITY_API_READ_TOKEN="skProductionToken123..."`.
**Root Cause:** `options.logging` not set to `CLOUD_LOGGING_ONLY`, or a build step echoes a secret value.
**Impact:** Secret values persist in Cloud Logging for 30+ days. With legacy GCS logging enabled, values are also stored in a GCS bucket with broader IAM access.
**Exact Fix:** `grep "logging:" cloudbuild.yaml` — expected: `logging: CLOUD_LOGGING_ONLY`. `grep -n "echo.*SANITY" cloudbuild.yaml` — remove any matches. `grep "logsBucket" cloudbuild.yaml` should return empty.

#### 7.3.2 .env.local Accidentally Committed to Git

**Symptom:** GitHub shows `.env.local` with visible token values.
**Root Cause / Exact Fix:** See R8 (Section 7.1.9) — `git filter-repo`, rotate token, update Secret Manager, force push. If token was exposed, treat as compromised regardless of history rewrite.

### 7.4 SDLC Quality Gates

The seven gates form a structured checklist: PLAN → BUILD → REVIEW → TEST → STAGE → SHIP → VERIFY. Each catches a specific error category at the cheapest possible stage.

#### 7.4.1 Quality Gates Summary

| Gate | Name   | Question                         | Description                                                                                    | Skip Condition                           |
| ---- | ------ | -------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1    | PLAN   | Do you understand the task?      | Name milestone, identify source doc, define done criteria, list dependencies, estimate effort  | One-line command from a doc already read |
| 2    | BUILD  | Can you undo the work?           | Work on a branch, commit BEFORE state, follow docs literally, scope changes, save GCP output   | Comment-only or doc-only change          |
| 3    | REVIEW | Have you read what you wrote?    | Read `git diff`, check for accidental files, debug code, secrets, commented-out code           | gcloud command not changing repo files   |
| 4    | TEST   | Does it work?                    | Run locally, verify exit criteria, run smoke check and secrets audit; infra: `gcloud describe` | Never skip                               |
| 5    | STAGE  | Is the change committed cleanly? | Commit message follows format, single logical change, branch up to date                        | Infra-only work not touching repo        |
| 6    | SHIP   | Ready to push to `main`?         | Previous milestone done, branch rebased, present at computer, build queue checked              | Infra-only task not pushing code         |
| 7    | VERIFY | Working in production?           | Cloud Build green, service healthy, behavior observable, checklist updated                     | Task did not deploy anything             |

#### 7.4.2 Gate 1 — PLAN

The PLAN gate prevents wasted effort. Confirm: the task belongs to a specific milestone (M1–M7); the source document section is open; the exit criterion is verifiable; the operator knows what the next task requires; effort is estimated. Cross-milestone work is a warning — M3 needs `dist/` from M2, and attempting them in parallel guarantees failure. **Skip:** single command from a document already read.

#### 7.4.3 Gate 2 — BUILD

Ensures every change is reversible. Requirements: work on a feature branch, never `main`; commit the BEFORE state if modifying files; follow source document commands exactly for the first pass; keep changes scoped; save terminal output for GCP commands (resource names and IDs are needed for verification). **Skip:** comment-only or doc-only change.

#### 7.4.4 Gate 3 — REVIEW

The primary defense against secret leakage, debug code, and accidental file inclusion. Read every line of `git diff` before staging and verify: `git status` shows only intended files; no `console.log("debug")`; no credential strings (`git diff --cached | grep -i token` returns empty); no commented-out code; TODOs include issue numbers; filenames match the source exactly — the `scripts/_lib/` vs `src/lib/` distinction is critical, as getting it wrong breaks the security model. **Skip:** a `gcloud` command that does not change repository files.

#### 7.4.5 Gate 4 — TEST

The most frequently skipped and most important gate. **For code changes:** run locally; verify exit criteria using the exact command from the source document; run `npm run smoke:check-routes` for build work; run `npm run audit:secrets` after any build. **For infrastructure:** `gcloud ... describe` the resource; verify IAM with `gcloud projects get-iam-policy`. **For configuration:** `yamllint cloudbuild.yaml`, `jsonlint firebase.json`. Do not skip — Cloud Build failures are slow, noisy, and public.

#### 7.4.6 Gate 5 — STAGE

Ensures commit history is useful for debugging. Commit format: `feat: milestone N - <summary>` with bulleted change lines. Single logical change per commit — three independent things produce three commits. If work has been ongoing, rebase: `git fetch && git rebase origin/main`. **Skip:** infrastructure-only work not touching repo files.

#### 7.4.7 Gate 6 — SHIP

Requirements: previous milestone fully done; feature branch rebased onto `origin/main`; for M5 onward, operator is at their computer (first Cloud Build runs surface issues); check recent builds: `gcloud builds list --region=us-central1 --limit=3`; push branch and merge to `main`. **Skip:** infrastructure-only task not pushing code.

#### 7.4.8 Gate 7 — VERIFY

Requirements: Cloud Build status is `SUCCESS`; `curl -s https://www.yourdomain.com/healthz` returns `200 ok`; the specific change is observable (CSP → `curl -sI ... | grep -i csp`; route → `curl -s -o /dev/null -w "%{http_code}" ...`; content → `curl -s ... | grep -c "<new>"`); no new Sentry errors or alerts; checklist updated with `<!-- done YYYY-MM-DD -->`. **Skip:** task did not deploy anything.

#### 7.4.9 Anti-Patterns Reference

| Anti-Pattern                                                  | Gate That Catches It | Corrective Action                                                                                   |
| ------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| "I'll just push and see if it builds"                         | TEST                 | Run the local build first. Cloud Build is slow and noisy.                                           |
| "I'll fix the lint errors later"                              | REVIEW               | Fix them now. Lint errors compound and obscure real issues.                                         |
| "Let me just edit `main` directly"                            | BUILD                | Create a feature branch. Direct `main` commits are not reversible.                                  |
| "I think this is what the doc said"                           | PLAN                 | Open the source document. Read the exact section. Copy the command verbatim.                        |
| "I'll skip the smoke test, it's only a small change"          | TEST                 | The smoke test takes approximately 3 seconds. Run it.                                               |
| "I'll do M3 in parallel with M2 — they look unrelated"        | PLAN                 | M3 requires `dist/` from M2. These milestones are sequential.                                       |
| Committing a Sanity token, even briefly                       | REVIEW               | Rotate the token immediately. `git push --force` does not remove it from history if anyone fetched. |
| "It's just a tiny config change, I'll skip the commit format" | STAGE                | The format enables future debugging at 11pm. Use it for every commit.                               |
| Running `npm run build` without `audit:secrets` after         | TEST                 | The audit is the final backstop against secret leakage. Always run it.                              |
| Not checking `gcloud builds list` before pushing M5+          | SHIP                 | A failing build in the queue may be unrelated. Verify first.                                        |

These anti-patterns represent the majority of preventable failures observed during Phase 2. Each gate corresponds to a specific failure mode with measurable recovery cost. Catching a secret leak at REVIEW costs minutes; catching it in production costs hours of rotation, history rewriting, and incident communication. Catching a build failure at TEST costs seconds; catching it in Cloud Build costs 5–10 minutes of pipeline execution plus log analysis. The gates exist to make the cheapest detection stage the most likely one.

## 8. Appendices

The following appendices consolidate reference material that is scattered across the project source files. Each appendix is designed as a single-source lookup table for a specific concern: environment configuration, content schemas, the CI/CD pipeline, file inventory, effort planning, and session logging.

---

### 8.1 Appendix A: Environment Variables Quick Reference

#### 8.1.1 Complete Environment Variable Table

The Mangu Publishers project uses eight environment variables, divided into two security classes: **public variables** (prefixed with `VITE_` and inlined into the client bundle) and **secret/server-only variables** (not prefixed and never exposed to the browser). The `VITE_` prefix rule is enforced by the `audit:secrets` script, which scans `dist/assets/` for secret names and fails the build if any are found.

| Variable                  | Vite Prefix? | Source                         | Used By                                       | Required? | Example Value                     |
| ------------------------- | ------------ | ------------------------------ | --------------------------------------------- | --------- | --------------------------------- |
| `VITE_SANITY_PROJECT_ID`  | Yes          | `.env.local` / Cloud Build env | Client JS, `sanity-node-client.ts`            | Required  | `abc123de`                        |
| `VITE_SANITY_DATASET`     | Yes          | `.env.local` / Cloud Build env | Client JS, `sanity-node-client.ts`            | Required  | `production`                      |
| `VITE_SANITY_API_VERSION` | Yes          | `.env.local` / Cloud Build env | Client JS, `sanity-node-client.ts`            | Required  | `2024-01-01`                      |
| `VITE_SITE_URL`           | Yes          | `.env.local` / Cloud Build env | Sitemap generator, SEO meta tags              | Required  | `https://www.mangupublishers.com` |
| `VITE_APP_VERSION`        | Yes          | Cloud Build (`${SHORT_SHA}`)   | Client JS (footer, Sentry release)            | Required  | `a1b2c3d`                         |
| `SANITY_API_READ_TOKEN`   | **No**       | Secret Manager only            | `build-content-snapshot.ts` (build-time only) | Required  | `skProductionToken...`            |
| `SENTRY_AUTH_TOKEN`       | No           | Secret Manager / `.env.local`  | Sentry Vite plugin (source maps)              | Optional  | `sntrys_...`                      |
| `PORT`                    | No           | Cloud Run (auto-injected)      | nginx runtime (`listen ${PORT}`)              | Auto-set  | `8080`                            |

**Key security properties.** The `SANITY_API_READ_TOKEN` variable is the critical security boundary in this project. It is injected **only** into Cloud Build Step 4 (`content-snapshot`) via `secretEnv`, and is not available to any other step, the Docker build context, or the Cloud Run runtime. The `PORT` variable is auto-injected by Cloud Run and must never be manually set. The `VITE_APP_VERSION` variable is automatically set to the 7-character git SHA by Cloud Build during Step 6 (`vite-build`) and is used for cache-busting and Sentry release tracking.

---

### 8.2 Appendix B: Sanity Content Model Reference

#### 8.2.1 Document Type Summary

The Sanity CMS defines three document types: `book`, `author`, and `category`. The `book` type is the primary content entity, with `author` and `category` serving as reference-linked supporting types. All three types are registered in `sanity.config.ts` and are queried at build time by `build-content-snapshot.ts`.

| Document Type | Purpose                        | Key Fields                                                                                                                       | Relationships                                            |
| ------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `book`        | Published books in the catalog | `title`, `slug`, `author` (ref), `description`, `coverImage`, `publishedAt`, `featured`, `body`, `isbn`, `pageCount`, `language` | References `author` (required) and `category` (optional) |
| `author`      | Book authors                   | `name`, `slug`, `bio`, `photo`, `email`, `website`, `social`                                                                     | Referenced by `book.author`; no outgoing references      |
| `category`    | Book categories/genres         | `name`, `slug`, `description`, `color`                                                                                           | Referenced by `book.category` (optional)                 |

The `book` type contains 12 fields, of which 5 are required (`title`, `slug`, `author`, `description`, `coverImage`, `publishedAt`). The `body` field stores content in **Portable Text** format (Sanity's structured JSON block content). The `coverImage` field includes hotspot data for responsive cropping and a low-quality image placeholder (LQIP) for blur-up loading. The `isbn` field is validated with a regex matching both ISBN-10 and ISBN-13 formats. The `language` field defaults to `"en"` and supports English, Swahili, and French via a select list.

The `author` type contains 7 fields, with only `name` and `slug` required. The `bio` field is also Portable Text. The `social` field is a nested object containing `twitter`, `instagram`, and `linkedin` URL fields.

The `category` type contains 4 fields, with `name` and `slug` required. The `color` field uses Sanity's built-in `color` type for UI accent color selection.

#### 8.2.2 GROQ Query Reference

The build pipeline executes five GROQ (Graph-Relational Object Queries) at build time to fetch content from Sanity. All queries are run through `build-content-snapshot.ts` using the `sanity-node-client.ts` client, which authenticates with `SANITY_API_READ_TOKEN`.

**Query 1: Fetch All Books.** `*[_type == "book"] { ... }` — Fetches the complete book dataset with resolved `author` and `category` references. The query expands `coverImage` to include asset metadata (dimensions, LQIP) and returns the full `body` Portable Text array. This is the primary query that populates `contentSnapshot.json`.

**Query 2: Fetch All Authors.** `*[_type == "author"] { ... }` — Fetches all author profiles with resolved `photo` image assets. Used to populate the authors section of the snapshot.

**Query 3: Fetch All Categories.** `*[_type == "category"] { ... }` — Fetches category metadata including the optional `color` field. Used for navigation and category filtering.

**Query 4: Fetch Featured Books (Homepage).** `*[_type == "book" && featured == true] | order(publishedAt desc) [0...6]` — Fetches the 6 most recently published featured books. This query returns a subset of book fields (no `body`, no `isbn`, no `pageCount`) optimized for the homepage hero section.

**Query 5: Fetch Books by Category.** `*[_type == "book" && category._ref == $categoryId] | order(publishedAt desc)` — Fetches books filtered by a specific category. Takes `$categoryId` as a parameter (the `_id` of the category document). Returns a lightweight book representation with author name, description, cover image, and publication date.

---

### 8.3 Appendix C: Cloud Build Step Reference

#### 8.3.1 Complete Build Step Table

The `cloudbuild.yaml` pipeline defines 16 sequential steps. Steps 1–10 constitute the **build phase** (produce and validate `dist/`), Steps 11–13 constitute the **containerization phase** (build, push, and scan the image), and Steps 14–16 constitute the **deployment phase** (deploy to Cloud Run, prune tags, save cache).

| Step ID | Name                           | Docker Image                                    | Entrypoint | Purpose                                                | Critical Notes                                                                                                        |
| ------- | ------------------------------ | ----------------------------------------------- | ---------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 1       | `restore-npm-cache`            | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` | `bash`     | Restore cached `node_modules` from GCS bucket          | Non-blocking: proceeds with cold install if cache miss                                                                |
| 2       | `install`                      | `node:20`                                       | `npm`      | Install dependencies with `npm ci`                     | Uses `--no-audit --no-fund` for speed; writes to `/workspace/.npm`                                                    |
| 3       | `production-audit`             | `node:20`                                       | `bash`     | Audit production deps for HIGH+ CVEs                   | Non-blocking (`\|\| true`); informational only                                                                        |
| 4       | `content-snapshot`             | `node:20`                                       | `bash`     | Run `build:content` to fetch Sanity data               | **Only step with `secretEnv`**. Token scoped here exclusively. Fails on missing `SANITY_API_READ_TOKEN`               |
| 5       | `generate-routes`              | `node:20`                                       | `bash`     | Run `build:routes` to produce `.cache/routes.json`     | Outputs route manifest used by prerender step                                                                         |
| 6       | `vite-build`                   | `node:20`                                       | `npm`      | Run `build:vite` (Vite production build)               | Injects `VITE_APP_VERSION=${SHORT_SHA}`. Produces `dist/` directory                                                   |
| 7       | `prerender`                    | `mcr.microsoft.com/playwright:v1.43.0-jammy`    | `bash`     | Run `build:prerender` to generate static HTML          | Pinned Playwright image for reproducibility. v11 fix applied                                                          |
| 8       | `sitemap`                      | `node:20`                                       | `npm`      | Run `build:sitemap` to generate `sitemap.xml`          | Consumes routes from `.cache/routes.json`                                                                             |
| 9       | `audit-secrets`                | `node:20`                                       | `npm`      | Run `audit:secrets` to scan for leaked tokens          | **P0 enforcement**. Scans `dist/assets/` for secret string patterns. Build fails if found                             |
| 10      | `smoke-test`                   | `node:20`                                       | `npm`      | Run `smoke:check-routes` for route integrity           | v12 addition. Validates prerendered HTML before containerizing                                                        |
| 11      | `docker-build`                 | `gcr.io/cloud-builders/docker`                  | `docker`   | Build container image with nginx                       | Receives pre-built `dist/` only. Contains **zero** build logic or secrets                                             |
| 12      | `docker-push`                  | `gcr.io/cloud-builders/docker`                  | `docker`   | Push SHA-tagged and `latest` tags to Artifact Registry | Uses `--all-tags` to push both tags simultaneously                                                                    |
| 13      | `enforce-vulnerability-policy` | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` | `bash`     | Scan image for HIGH/CRITICAL CVEs                      | **Deployment gate**. Blocks deploy if HIGH or CRITICAL findings exist. Requires `ondemandscanning.googleapis.com` API |
| 14      | `deploy-run`                   | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` | `gcloud`   | Deploy container to Cloud Run                          | Uses SHA-tagged image. Config: `--memory=512Mi`, `--cpu=1`, `--concurrency=80`, `--execution-environment=gen2`        |
| 15      | `prune-tags`                   | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` | `bash`     | Remove old Cloud Run tags                              | Executes `scripts/ops/prune-cloud-run-tags.sh`. Non-blocking (`\|\| true`)                                            |
| 16      | `save-npm-cache`               | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` | `bash`     | Save `node_modules` cache to GCS                       | Uploads `npm-cache.tgz` to Cloud Storage for next build                                                               |

**Build configuration.** The pipeline uses substitutions defined at the top of `cloudbuild.yaml`: `_REGION` (`us-central1`), `_AR_REPO` (`web-images`), `_SERVICE` (`mangu-publishers`), and `_CACHE_BUCKET` (`mangu-publishers-cloudbuild-cache`). Build options specify `E2_HIGHCPU_8` machine type and `CLOUD_LOGGING_ONLY` logging (prevents secret values from appearing in legacy build logs). The timeout is set to 1800 seconds. The `availableSecrets` block binds `sanity-api-read-token` from Secret Manager exclusively to Step 4.

---

### 8.4 Appendix D: File Inventory

#### 8.4.1 Repository Files to Create or Modify

The following files are copied from the Drive folder into the `my_publishing` repository at specific paths. Each file maps to a milestone and has a defined purpose within the build, deploy, or runtime pipeline.

| Filename                       | Milestone | Purpose                                           | Repo Destination                      |
| ------------------------------ | --------- | ------------------------------------------------- | ------------------------------------- |
| `cloudbuild.yaml`              | M5        | CI/CD pipeline definition (16 steps)              | Repo root                             |
| `Dockerfile`                   | M3        | nginx runtime container                           | Repo root                             |
| `nginx.conf.template`          | M3        | nginx configuration with `envsubst`               | Repo root                             |
| `firebase.json`                | M6        | Firebase Hosting rewrite rules + CDN headers      | Repo root                             |
| `artifact-cleanup-policy.json` | M4        | Artifact Registry lifecycle policy                | Repo root                             |
| `node-env.ts`                  | M1        | Zod-validated environment variable parser         | `scripts/_lib/node-env.ts`            |
| `sanity-node-client.ts`        | M1        | Authenticated Sanity client for build scripts     | `scripts/_lib/sanity-node-client.ts`  |
| `prune-cloud-run-tags.sh`      | M7        | Tag pruning script for Cloud Run revision cleanup | `scripts/ops/prune-cloud-run-tags.sh` |

Several additional files must be authored during implementation and are not present in the Drive folder. These include: `scripts/build-content-snapshot.ts` (M2), `scripts/generate-routes.ts` (M2), `scripts/prerender.ts` (M2), `scripts/generate-sitemap.ts` (M2), `scripts/smoke/check-routes.ts` (M5), `src/components/PortableTextRenderer.tsx` (M2), `.dockerignore` (M3), and the Sanity webhook validator (M7). Sample code for each is provided in the Remediation Guide.

#### 8.4.2 Drive Files to Download

The following files from the Google Drive folder are referenced during implementation. They should be downloaded, renamed if necessary (Drive sometimes misidentifies `.ts` files as `video/vnd.dlna.mpeg-tts`), and placed at the corresponding repository paths.

| Drive Filename                 | Purpose                                         | Repo Destination                      |
| ------------------------------ | ----------------------------------------------- | ------------------------------------- |
| `cloudbuild.yaml`              | Production CI/CD pipeline                       | Repo root                             |
| `Dockerfile`                   | Hardened nginx container (non-root, gen2)       | Repo root                             |
| `nginx.conf.template`          | nginx config with CSP, Gzip, security headers   | Repo root                             |
| `firebase.json`                | Firebase Hosting SPA routing + CDN config       | Repo root                             |
| `artifact-cleanup-policy.json` | Registry cleanup (keep last 30 revisions)       | Repo root                             |
| `node-env.ts`                  | Environment variable validation (Zod schemas)   | `scripts/_lib/node-env.ts`            |
| `sanity-node-client.ts`        | Sanity client with token auth for build scripts | `scripts/_lib/sanity-node-client.ts`  |
| `prune-cloud-run-tags.sh`      | Automated tag pruning (called from Step 15)     | `scripts/ops/prune-cloud-run-tags.sh` |

---

### 8.5 Appendix E: Estimated Effort

#### 8.5.1 Effort Table by Milestone

The following estimates assume a solo developer working evenings and weekends at a realistic pace. A "session" is defined as one contiguous block of focused work (approximately 2–4 hours). Estimates account for the reality that first-time Cloud Build runs always surface unexpected issues, OAuth flows interrupt workflow, and Sanity schema customization requires iterative testing against real data.

| Milestone | Description                      | Realistic Sessions | Key Dependencies                      |
| --------- | -------------------------------- | ------------------ | ------------------------------------- |
| M1        | Local Security Hardening         | 1–2                | None (first milestone)                |
| M2        | Build Pipeline Scripts           | 2–4                | M1 (`node-env.ts` must exist)         |
| M3        | Runtime Container                | 1                  | M2 (`dist/` output must exist)        |
| M4        | GCP Foundation                   | 1–2                | None (can parallel with M2/M3)        |
| M5        | Cloud Build End-to-End           | 2–4                | M1, M2, M3, M4 (all prior milestones) |
| M6        | Firebase Hosting + Custom Domain | 1                  | M5 (Cloud Run service must be live)   |
| M7        | Production Guardrails            | 3–6                | M6 (site must be deployed)            |

#### 8.5.2 Critical Path Analysis

The critical path to launch follows a strict sequential dependency chain: **M1 -> M2 -> M3 -> M4 -> M5 -> M6**. Within this chain, M4 (GCP Foundation provisioning) is the only milestone that can execute in parallel with M2 and M3, since it involves API enablement, Artifact Registry creation, and Secret Manager configuration that does not depend on local build artifacts. However, M5 requires all four prior milestones to be complete because the Cloud Build pipeline (Step 11 onward) needs the Docker container (M3), the build scripts (M2), the validated environment (M1), and the GCP infrastructure (M4).

Summing the M1 through M6 estimates, the total effort to launch is **8–17 sessions**. M7 adds **3–6 additional sessions** for hardening. The sequential milestone rule must be strictly observed: do not begin M2 until M1 is fully committed, do not begin M3 until M2 produces a valid `dist/` directory, and so on. Violating this rule makes failures ambiguous (is the error from the current milestone or the one that was skipped?) and typically increases total effort by 30–50%.

---

### 8.6 Appendix F: Daily Work Log Template

#### 8.6.1 Session Log Template

Each working session should begin with copying the log template into a dated file (e.g., `logs/2026-05-12.md`) and filling in the header fields before writing any code. The template enforces a consistent documentation discipline that prevents re-orientation time at the start of each session and preserves decision context across multi-day gaps.

The template contains the following structured fields:

**Header fields.** `Working on milestone` (e.g., M2), `Current branch` (the active Git branch), `Where I left off last time` (copied from the previous session's stopping point or "first session of this milestone"), and `Goal for this session` (one concrete sentence defining success for this block of work).

**Execution fields.** `What I did` — a checklist of steps completed, with boxes ticked inline. Partially completed items remain unchecked with a "PARTIAL" annotation. `What worked` — techniques, commands, or approaches that succeeded and should be reused. `What broke / where I got stuck` — failures with enough context to avoid re-debugging the same issue. `Open questions / things to research` — deferred decisions or unknowns that surfaced during the session.

**State fields.** `Where I'm stopping` — a specific stopping point description (e.g., "M2 step 2.4 done; step 2.5 not started; `playwright install chromium` was just running when I stopped"), not a vague milestone reference. `Next session — first thing to do` — a single concrete action that can be re-read in under 5 seconds to resume with momentum.

**Reference fields.** `Reference: doc sections I touched today` — an index of which source documents were consulted, creating a personal knowledge trail. `Reference: commits made today` — a list of commit SHAs with messages, providing auditability and rollback target identification.

**Rationale for each section.** The template's field structure is designed to prevent specific failure modes that are common in multi-session solo projects. The "Where I left off" section eliminates the need to re-read entire checklists to find the current position. The session goal prevents drift into unfocused exploration. The "What worked" and "What broke" sections preserve debugging knowledge across weeks. The "Open questions" section captures deferred concerns that would otherwise surface at 3 AM. The explicit stopping point and next-step fields enable immediate resumption in the next session without re-orientation overhead. Commit references provide both personal auditability and the ability to quickly identify rollback targets if a deployment fails.

**Suggested folder structure.** Store session logs in a dedicated `logs/` directory under the Phase 2 documentation root, using either one file per session (`logs/2026-05-12.md`) or a single running log (`logs/all_sessions.md` with dated sections appended). Either approach is valid; consistency is the only requirement.
