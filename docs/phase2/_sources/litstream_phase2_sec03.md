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
