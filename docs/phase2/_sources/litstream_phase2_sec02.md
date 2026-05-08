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

| Document Type | Purpose | Key Fields | Validation | Relationships |
|---------------|---------|------------|------------|---------------|
| **book** | Published books in the catalog | title, slug, author, description, coverImage, publishedAt, featured, category, body, isbn, pageCount, language | title: required, max 200 chars; slug: required; author: required reference; description: required, max 500 chars; coverImage: required; isbn: ISBN-10/13 regex; pageCount: integer 1-5000 | author -> author (required); category -> category (optional) |
| **author** | Book authors | name, slug, bio, photo, email, website, social | name: required, max 100; slug: required; email: email format | Referenced by book documents |
| **category** | Book genres/categories | name, slug, description, color | name: required, max 50; slug: required; description: max 300 chars | Referenced by book documents |

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

| Step | Script | Input | Output | Dependencies |
|------|--------|-------|--------|--------------|
| 1 — Content Snapshot | `npm run build:content` | Sanity CMS via authenticated API | `src/generated/contentSnapshot.json` | `SANITY_API_READ_TOKEN`; `scripts/_lib/node-env.ts`; `scripts/_lib/sanity-node-client.ts` |
| 2 — Route Generation | `npm run build:routes` | `contentSnapshot.json` | `.cache/routes.json` | Static routes (`/`, `/about`, `/contact`) + dynamic routes from content |
| 3 — Vite Build | `npm run build:vite` | React source, `contentSnapshot.json` | `dist/index.html`, hashed `dist/assets/*.{js,css}` | VITE_* env vars |
| 4 — Prerender | `npm run build:prerender` | `dist/index.html`, `.cache/routes.json` | `dist/{route}/index.html` for every route | Playwright Chromium; local server on port 4173 |
| 5 — Sitemap | `npm run build:sitemap` | `.cache/routes.json`, `VITE_SITE_URL` | `dist/sitemap.xml` | Route manifest; site URL |

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

#### 2.4.1 VITE_ Prefix Rule and Variable Classification

Vite inlines all `VITE_*` environment variables into the client JavaScript bundle at compile time via `import.meta.env.VITE_*`. This design enables public configuration in browser code, but creates a critical security boundary: any secret assigned a `VITE_` prefix is exposed to every visitor, visible in DevTools and stored permanently in the JS bundle.

| Variable | VITE_ Prefix | Source | Used By | Classification |
|----------|-------------|--------|---------|---------------|
| `VITE_SANITY_PROJECT_ID` | Yes | `.env.local` / Cloud Build | Client JS, build scripts | **Public** — visible in CDN URLs |
| `VITE_SANITY_DATASET` | Yes | `.env.local` / Cloud Build | Client JS, build scripts | **Public** — non-sensitive name |
| `VITE_SANITY_API_VERSION` | Yes | `.env.local` / Cloud Build | Client JS, build scripts | **Public** — version string |
| `VITE_SITE_URL` | Yes | `.env.local` / Cloud Build | Sitemap, SEO meta | **Public** — canonical domain |
| `VITE_APP_VERSION` | Yes | Cloud Build (`SHORT_SHA`) | Client JS, Sentry release | **Public** — git SHA |
| `SANITY_API_READ_TOKEN` | **No** | Secret Manager only | `build-content-snapshot.ts` | **Secret** — NEVER use VITE_ prefix |
| `SENTRY_AUTH_TOKEN` | **No** | Secret Manager (optional) | Sentry Vite plugin | **Secret** — source map upload only |
| `PORT` | **No** | Cloud Run (auto-set) | nginx runtime | **Non-secret** — auto-set to 8080 |

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

| Requirement | Implementation | Verification |
|-------------|---------------|--------------|
| No secret uses VITE_ prefix | `SANITY_API_READ_TOKEN` has no prefix; old name renamed across codebase | `grep -rn "VITE_SANITY_API_READ_TOKEN" src/` returns empty |
| Token required | Zod `z.string().min(1)` on `SANITY_API_READ_TOKEN` | Build crashes with exit 1 if missing |
| Token scoped to one step | `secretEnv` only on Cloud Build step 4 | `grep "secretEnv" cloudbuild.yaml` shows single occurrence |
| Audit catches leaks | `audit:secrets` runs as Cloud Build step 9 | Pipeline fails if token string found in `dist/assets/` |
| Files excluded | `.gitignore` and `.dockerignore` cover all generated files and secrets | Git and Docker contexts are clean |
| Logs protected | `CLOUD_LOGGING_ONLY` in build options | No legacy GCS log bucket writes |

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
    "rewrites": [{
      "source": "**",
      "run": { "serviceId": "mangu-publishers", "region": "us-central1", "pinTag": true }
    }]
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

| Step | ID | Name | Purpose | Image |
|------|-----|------|---------|-------|
| 1 | restore-npm-cache | Restore cache | Pull npm cache from GCS | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` |
| 2 | install | Install deps | `npm ci` with cache dir | `node:20` |
| 3 | production-audit | npm audit | Non-blocking audit output | `node:20` |
| 4 | content-snapshot | Content fetch | Fetch Sanity content via secret token | `node:20` |
| 5 | generate-routes | Route gen | Read snapshot; write `.cache/routes.json` | `node:20` |
| 6 | vite-build | Vite build | Bundle React; inject `VITE_APP_VERSION=${SHORT_SHA}` | `node:20` |
| 7 | prerender | Prerender | Playwright visits routes; write HTML shells | `mcr.microsoft.com/playwright:v1.43.0-jammy` |
| 8 | sitemap | Sitemap | Generate `dist/sitemap.xml` | `node:20` |
| 9 | audit-secrets | Secret audit | `grep dist/assets/` for token; fail if found | `node:20` |
| 10 | smoke-test | Smoke test | Verify all routes have prerendered HTML | `node:20` |
| 11 | docker-build | Docker build | Build nginx container with SHA+latest tags | `gcr.io/cloud-builders/docker` |
| 12 | docker-push | Docker push | Push both tags to Artifact Registry | `gcr.io/cloud-builders/docker` |
| 13 | enforce-vulnerability-policy | CVE scan | Scan image; block on HIGH/CRITICAL | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` |
| 14 | deploy-run | Deploy | Deploy SHA-tagged image to Cloud Run | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` |
| 15 | prune-tags | Tag prune | Remove old Cloud Run tags; keep 50 | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` |
| 16 | save-npm-cache | Save cache | Upload npm cache to GCS | `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` |

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
