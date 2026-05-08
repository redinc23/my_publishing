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

The `SANITY_API_READ_TOKEN` must not be exposed to five attack surfaces: (1) the browser bundle (`dist/assets/` contains no token strings), (2) Docker image layers (Dockerfile has no `ARG`/`ENV` for the token), (3) Cloud Run runtime (no `SANITY_API_READ_TOKEN` env var on the deployed service), (4) Cloud Build logs (`CLOUD_LOGGING_ONLY` with single-step `secretEnv` scoping), and (5) CSP headers (`connect-src` excludes `api.sanity.io`, proving no runtime Sanity connections). This goal is the central security thesis and is verified by the `audit:secrets` script and five independent P0 test dimensions.

#### 1.2.4 Goal 4: Automatic Content Rebuilds within ~60 Seconds

Content editors publishing changes in Sanity Studio must see those changes on the live site within approximately 60 seconds. A webhook validator (Cloud Run Function or second Cloud Run service) receives Sanity events, verifies HMAC signatures, implements replay protection (rejecting duplicate payload IDs within 10 minutes), and triggers Cloud Build via `gcloud builds triggers run mangu-publishers-main`. Unsigned requests return HTTP 401/403 and trigger no rebuild.

#### 1.2.5 Goal 5: Monitoring, Alerting, and Cost Controls

Establish production observability and cost governance. **Sentry** tracks errors with git-SHA release identification. **Cloud Monitoring** checks `/healthz` every 60 seconds and alerts on four conditions: 5xx error rate > 5%, p99 latency > 2000ms, memory utilization > 85%, and instance count >= 8 (approaching `maxScale=10`). **Cost controls** include billing budget alerts at 50%, 75%, and 90%, Artifact Registry cleanup policies, and automated Cloud Run tag pruning (`KEEP=50`).

### 1.3 In-Scope Features

#### 1.3.1 Feature Table: Seven Milestones

| Milestone | Name | Deliverables | Exit Criteria |
|---|---|---|---|
| M1 | Local Security Hardening | Token rename (`VITE_` prefix removal); `scripts/_lib/node-env.ts` (Zod validation, required token); `scripts/_lib/sanity-node-client.ts` (`useCdn: false`, `perspective: "published"`); `.gitignore` and `.dockerignore`; `audit:secrets` script | `audit:secrets` exits 0; grep for token in `dist/assets/` returns empty; `node-env.ts` throws on missing token |
| M2 | Build Pipeline Scripts | Five npm scripts (`build:content`, `build:routes`, `build:vite`, `build:prerender`, `build:sitemap`); content snapshot with `contentHash`, `buildCommit`, `sanityDataset`; route generator; prerenderer (Playwright Chromium); sitemap generator; smoke test script | `dist/` contains `index.html`, hashed assets, prerendered HTML shells, `sitemap.xml`; snapshot has all three provenance fields |
| M3 | Runtime Container | `Dockerfile` (`nginx:1.27-alpine`, UID 1001, hard-fail without `dist/`); `nginx.conf.template` (CSP, `/healthz`, immutable cache, SPA fallback, `.map` 404) | `docker build` succeeds; fails without `dist/`; `/healthz` returns 200; CSP excludes `api.sanity.io`; container runs as UID 1001 |
| M4 | GCP Foundation | Artifact Registry `web-images` with cleanup policy; Secret Manager secret `sanity-api-read-token`; Cloud Build SA `cloudbuild-mangu-publishers`; GCS cache bucket; Developer Connect GitHub link; Cloud Build trigger on `^main$` | All `gcloud describe` commands succeed; push to `main` starts Cloud Build |
| M5 | Cloud Build End-to-End | `cloudbuild.yaml` with 16 steps; vulnerability scan gate; `--memory=512Mi --no-default-url` deploy flags | Full pipeline green; Cloud Run URL returns 200; no token in logs; image tagged with `SHORT_SHA` and `latest` |
| M6 | Firebase Hosting | `firebase.json` (rewrite all routes to Cloud Run, `pinTag: true`); `public-placeholder/`; custom domain with TLS; CDN edge caching | `https://www.yourdomain.com/` loads over HTTPS; deep links return 200; security headers present |
| M7 | Production Guardrails | Sentry release tracking with hidden source maps; Sanity webhook validator (HMAC + replay protection); Cloud Monitoring uptime check and alert policies; billing budget alerts at 50/75/90%; Artifact Registry cleanup; Cloud Run tag pruning (`KEEP=50`); Portable Text renderer; Formspree contact form | Sentry shows events tagged with SHA; webhook triggers build within ~60s; monitoring green; budget alerts active |

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

| # | Excluded Feature | Rationale | Deferral Target |
|---|---|---|---|
| 1 | Authentication / user accounts | No authenticated visitor experience required for public content site | Phase 3 |
| 2 | Search functionality | No search index, API, or UI component; prerendered HTML is crawlable by external search engines | Phase 3 |
| 3 | Comments, ratings, user-generated content | Platform is strictly publisher-to-consumer with no visitor input channels | Phase 3 or later |
| 4 | Email subscriptions / newsletters | Formspree contact form (M7) is unidirectional messaging only; no subscriber management | Phase 3 or later |
| 5 | Mobile native applications | No iOS or Android app development | Future phase |
| 6 | Analytics dashboards | Basic GCP Cloud Monitoring metrics only; no custom analytics UI | Phase 3 |
| 7 | A/B testing | No experiment framework or traffic splitting for feature comparison | Future phase |
| 8 | Internationalization | Language field in Sanity schema only; no multi-locale routing or content translation | Phase 3 |

### 1.5 Success Metrics (Definition of Done)

#### 1.5.1 Definition of Done Table

Phase 2 is complete when all 14 acceptance criteria below are satisfied. Each criterion maps to a P0 test ID from the Verification Protocol (Section 4 of the Implementation Package).

| # | Acceptance Criterion | P0 Test ID | Verification Method |
|---|---|---|---|
| 1 | Push to `main` triggers Cloud Build within 60s; build runs green | P0-4 | `gcloud builds list` shows SUCCESS within 60s of push; all 16 steps pass |
| 2 | `https://www.yourdomain.com/` loads over HTTPS | P0-5 | `curl -sI` returns `HTTP/2 200` |
| 3 | `/healthz` returns HTTP 200 | P0-3 | `curl` to `/healthz` returns `200 ok` |
| 4 | Deep links load correctly with no server 404 | P0-5, P0-7 | `curl` to deep link returns 200; SPA fallback serves `index.html` |
| 5 | `grep -R SANITY_API_READ_TOKEN dist/assets/` returns empty | P0-1 | Direct grep scan produces empty output |
| 6 | Cloud Run runtime contains no `SANITY_API_READ_TOKEN` | P0-1 | `gcloud run services describe` shows no secret in env |
| 7 | Hashed assets return `Cache-Control: public, max-age=31536000, immutable` | P0-7 | `curl -sI` on `/assets/*.js` or `/assets/*.css` returns correct header |
| 8 | Source map URLs return HTTP 404 | P0-7 | `curl` to any `.map` URL returns 404 |
| 9 | CSP `connect-src` excludes `*.api.sanity.io` | P0-3 | Response headers show CSP without `api.sanity.io` in `connect-src` |
| 10 | Container runs as non-root (UID 1001) | P0-7 | `docker exec <container> id` returns `uid=1001` |
| 11 | Sanity content publish triggers rebuild within ~60s | WEBHOOK | Publish in Sanity; verify Cloud Build starts within 60s |
| 12 | Sentry receives errors tagged with git SHA as release | — | Sentry dashboard shows `release = SHORT_SHA` |
| 13 | Cloud Monitoring uptime check on `/healthz` is green | — | Console shows green checkmark |
| 14 | Billing budget alerts at 50%, 75%, 90% | — | Billing Console shows budget with three thresholds |

#### 1.5.2 CI/CD Trigger and End-to-End Build Success

The automated pipeline triggers within 60 seconds of any push to `main` and executes all 16 steps. The pipeline completes without manual intervention, produces a deployed Cloud Run service, and generates an Artifact Registry image tagged with the git short SHA and `latest`. The vulnerability scan (step 13) blocks deployment on HIGH or CRITICAL CVEs. Logging mode is `CLOUD_LOGGING_ONLY`.

#### 1.5.3 HTTPS Site Availability, Health Checks, and Deep Link Routing

The launched site serves all content over HTTPS with TLS from Firebase Hosting. The `/healthz` endpoint returns HTTP 200 with `Cache-Control: no-store`. Deep links return prerendered HTML shells (HTTP 200), and unknown paths fallback to `index.html` for client-side SPA routing rather than server 404. Firebase's `pinTag: true` routes through the tagged Cloud Run revision.

#### 1.5.4 Zero Secret Leakage across Five Test Dimensions

Secret exposure testing covers five dimensions: **(1)** Browser bundle: grep scan of `dist/assets/` returns empty; **(2)** Cloud Run environment: `gcloud run services describe` confirms no token env var; **(3)** Docker layers: `docker save` piped through `strings` and `grep` finds no tokens; **(4)** Cloud Build logs: `CLOUD_LOGGING_ONLY` and single-step `secretEnv` scoping prevent log exposure; **(5)** CSP headers: `connect-src` excludes `*.api.sanity.io`, proving no runtime Sanity calls. All five dimensions must pass.

#### 1.5.5 Immutable Caching, Source Map Protection, and CSP Enforcement

Hashed JS/CSS assets in `dist/assets/` are served with `Cache-Control: public, max-age=31536000, immutable`. Source map files are deleted from `dist/` by the Sentry plugin after upload; `.map` requests return HTTP 404. The Content Security Policy excludes `api.sanity.io` from all directives, confirming no runtime Sanity API calls.

#### 1.5.6 Container Security, Sentry Integration, and Monitoring Health

The container runs as non-root (UID 1001). Sentry receives errors tagged with the git short SHA. Cloud Monitoring shows a green uptime check for `/healthz`, and all four alert policies (5xx rate, p99 latency, memory, instance count) are active with notification channels. Artifact Registry cleanup and billing budget alerts are confirmed active.
