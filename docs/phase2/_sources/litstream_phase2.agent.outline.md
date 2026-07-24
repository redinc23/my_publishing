# Mangu Publishers Phase 2 — Complete Buildout Planning Document

## Executive Summary

### Project Purpose

#### Mangu Publishers is a content publishing platform requiring Phase 2 to go from local development to production launch on a custom domain over HTTPS

### Scope Definition

#### Phase 2 covers milestones **M1–M6** plus split production guardrails **M7a** / **M7b** (observability vs stabilization), spanning security hardening, build pipeline, containerization, GCP infrastructure, CI/CD, Firebase Hosting, and launch guardrails

### Success Criteria

#### Site is live at https://www.custom-domain.com with automated builds, zero secret leakage, monitoring, and content-driven rebuilds

### Target Audience

#### Engineering team executing Phase 2 buildout; DevOps operators; future maintainers

## 1. Business Requirements Document (~2500 words, 3 tables)

### 1.1 Product Overview

#### 1.1.1 Mangu Publishers is a content publishing platform (books, authors, categories) where editors manage content in Sanity Studio

#### 1.1.2 Content is fetched at build time, pre-rendered into static HTML, and served via CDN — no runtime API calls to Sanity

#### 1.1.3 The architecture prioritizes security, performance, and operational simplicity over dynamic runtime capabilities

### 1.2 Business Goals

#### 1.2.1 Goal 1: Launch a publicly accessible website on a custom domain over HTTPS within a defined Phase 2 scope

#### 1.2.2 Goal 2: Establish automated CI/CD pipeline where every push to main triggers a build → test → deploy sequence

#### 1.2.3 Goal 3: Ensure zero secret exposure to the browser, Docker layers, Cloud Run runtime, or Cloud Build logs

#### 1.2.4 Goal 4: Enable content editors to publish changes that trigger automatic site rebuilds within ~60 seconds

#### 1.2.5 Goal 5: Implement monitoring, alerting, and cost controls for production operations

### 1.3 In-Scope Features

#### 1.3.1 Feature table: milestones **M1–M6** + **M7a/M7b** deliverables — M1 Local Security Hardening through split Production Guardrails (table)

#### 1.3.2 Build pipeline producing complete dist/ with prerendered HTML, hashed assets, and sitemap

#### 1.3.3 Hardened nginx container serving static files only — no runtime secrets, no Node.js process at runtime

#### 1.3.4 Firebase Hosting with custom domain, TLS termination, CDN edge caching, and SPA routing

#### 1.3.5 Sanity webhook validator with HMAC signature verification and replay protection

#### 1.3.6 Sentry error tracking with git-SHA-based release identification

#### 1.3.7 Cloud Monitoring uptime checks and alert policies for 5xx rate, latency, memory, and instance count

#### 1.3.8 Billing budget alerts at 50%, 75%, and 90% thresholds

#### 1.3.9 Artifact Registry cleanup policies and Cloud Run tag pruning automation

### 1.4 Out-of-Scope Features (Explicit Exclusions)

#### 1.4.1 Authentication / user accounts — not part of Phase 2

#### 1.4.2 Search functionality on the site — deferred to Phase 3

#### 1.4.3 Comments, ratings, or user-generated content — excluded from this phase

#### 1.4.4 Email subscriptions or newsletters (Formspree contact form only, in **M7b**)

#### 1.4.5 Mobile app, analytics dashboards, A/B testing, internationalization

### 1.5 Success Metrics (Definition of Done)

#### 1.5.1 Definition of Done table: 14 acceptance criteria mapped to P0 test IDs (table)

#### 1.5.2 Push to main triggers Cloud Build within 60 seconds; build runs green end-to-end

#### 1.5.3 HTTPS site loads, /healthz returns 200, deep links work, no 404s from SPA routing

#### 1.5.4 Zero secret leakage verified across 5 test dimensions: entire **`dist/`**, Cloud Run env, Docker layers, Cloud Build logs (CLOUD_LOGGING_ONLY), CSP headers

#### 1.5.5 Immutable cache headers on hashed assets; source map URLs return 404; CSP excludes api.sanity.io

#### 1.5.6 Container runs as non-root (UID 1001); Sentry receives events tagged with git SHA; monitoring checks are green

## 2. Functional Requirements Document (~3500 words, 5 tables)

### 2.1 Functional Architecture Overview

#### 2.1.1 System diagram: Sanity CMS → Build Scripts → Vite Build → Prerender → dist/ → Docker → Cloud Run → Firebase Hosting → End User

#### 2.1.2 The runtime is a pure static file server (nginx) — all dynamic behavior happens at build time

#### 2.1.3 Content update flow: Sanity publish → webhook POST → validator → Cloud Build trigger → new deployment

### 2.2 Content Management (Sanity CMS)

#### 2.2.1 Three document types: book, author, category — full schema with field definitions, validation rules, and relationships (table)

#### 2.2.2 Book schema: title, slug, author reference, description, coverImage, publishedAt, featured flag, category reference, body (Portable Text), ISBN, pageCount, language

#### 2.2.3 Author schema: name, slug, bio (Portable Text), photo, email, website, social links object

#### 2.2.4 Category schema: name, slug, description, accent color

#### 2.2.5 GROQ queries for build pipeline: all books with resolved author/category references, all authors, all categories, featured books, books by category

#### 2.2.6 Portable Text handling: raw JSON stored in snapshot at build time; rendered to React components at runtime via @portabletext/react

#### 2.2.7 Sanity image URL construction from cdn.sanity.io with transformation parameters

### 2.3 Build Pipeline Functional Requirements

#### 2.3.1 Build step sequence table: step name, script, input, output, dependencies (table)

#### 2.3.2 Step 1 — build:content: Fetch all content from Sanity via authenticated client; write src/generated/contentSnapshot.json with contentHash (SHA-256), buildCommit, sanityDataset, generatedAt, books[], authors[], categories[]

#### 2.3.3 Step 2 — build:routes: Read contentSnapshot.json; generate static routes (/, /about, /contact) and dynamic routes (/books/{slug}, /authors/{slug}); write .cache/routes.json

#### 2.3.4 Step 3 — build:vite: Run Vite production build; output hashed JS/CSS assets to dist/assets/; generate dist/index.html

#### 2.3.5 Step 4 — build:prerender: Start local static server on port 4173; use Playwright Chromium to visit each route and capture rendered HTML; write dist/{route}/index.html for every route

#### 2.3.6 Step 5 — build:sitemap: Read .cache/routes.json; generate dist/sitemap.xml with all URLs, changefreq weekly, priority 1.0 for root, 0.8 for others

#### 2.3.7 Combined build script chains all five steps in order with fail-fast behavior

### 2.4 Security Functional Requirements

#### 2.4.1 VITE* prefix rule: variables starting with VITE* are inlined into client JS; secret variables MUST NOT use this prefix (table: which vars use VITE\_ vs which don't)

#### 2.4.2 SANITY_API_READ_TOKEN is required via Zod validation (z.string().min(1)) — build crashes if missing

#### 2.4.3 Token scoping: Secret Manager injects token ONLY into Cloud Build step 4 (content-snapshot); no other step, Docker build, or Cloud Run runtime has access

#### 2.4.4 audit:secrets npm script: scan entire **`dist/`** for SANITY_API_READ_TOKEN (not only dist/assets/); exit 1 if found — Cloud Build step 9

#### 2.4.5 .gitignore excludes contentSnapshot.json, .env.local, and .env*.local; .dockerignore excludes scripts/, .env*, and generated files

#### 2.4.6 CLOUD_LOGGING_ONLY prevents secret values from appearing in legacy Cloud Build log buckets

### 2.5 Container Functional Requirements

#### 2.5.1 Dockerfile contains NO build commands: no npm install, no npm run build, no fallback — only COPY dist/ + validation

#### 2.5.2 Hard validation: test -f /usr/share/nginx/html/index.html || exit 1 — fails the Docker build if dist/ is missing

#### 2.5.3 Non-root execution: UID 1001 / GID 1001; nginx pid file written to /tmp (writable by non-root)

#### 2.5.4 Base image: nginx:1.27-alpine; port 8080; Cloud Run sets PORT env var consumed via envsubst

### 2.6 Hosting & Routing Functional Requirements

#### 2.6.1 Firebase Hosting configuration: public-placeholder directory (empty), all routes rewritten to Cloud Run service with pinTag: true

#### 2.6.2 SPA fallback: nginx try_files serves index.html for all non-asset routes; client-side router handles deep links

#### 2.6.3 /healthz endpoint: returns 200 "ok" with Cache-Control: no-store

#### 2.6.4 Immutable asset caching: /assets/\* returns Cache-Control: public, max-age=31536000, immutable

#### 2.6.5 Source map blocking: \*.map URLs return 404 (source maps uploaded to Sentry then deleted from dist/)

#### 2.6.6 Security headers: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

#### 2.6.7 CSP connect-src does NOT include api.sanity.io (runtime never contacts Sanity); CSP img-src includes cdn.sanity.io (for Portable Text images)

### 2.7 CI/CD Functional Requirements

#### 2.7.1 Cloud Build trigger on ^main$ branch via Developer Connect GitHub integration

#### 2.7.2 16-step pipeline: restore cache → install → audit → content snapshot → routes → Vite build → prerender → sitemap → secret audit → smoke test → Docker build → push → vulnerability scan → deploy → tag prune → save cache

#### 2.7.3 Vulnerability scan blocks deployment on HIGH/CRITICAL CVE findings

#### 2.7.4 Cloud Run deployment parameters: memory=512Mi (gen2 minimum), concurrency=80, min-instances=0, max-instances=10, execution-environment=gen2, no-default-url

### 2.8 Monitoring & Alerting Functional Requirements

#### 2.8.1 Sentry: release tracking with VITE_APP_VERSION=${SHORT_SHA}; hidden source maps uploaded then deleted from dist/

#### 2.8.2 Cloud Monitoring uptime check on /healthz every 60 seconds with 10-second timeout

#### 2.8.3 Alert policies align with **Decision 7**: 5xx rate > 5% / 5 min, p99 latency > 2000ms / 5 min, memory > 85% / 5 min, instance count ≥ 8 sustained 10 min (near maxScale=10)

#### 2.8.4 Billing budget alerts at 50%, 75%, 90% of monthly budget

#### 2.8.5 Artifact Registry cleanup: keep 15 most recent tagged images, delete untagged after 3 days

#### 2.8.6 Cloud Run tag pruning: retain 50 most recent tags, remove older ones after each deploy

## 3. Technical Architecture & Design Decisions (~3000 words, 4 tables)

### 3.1 System Architecture Overview

#### 3.1.1 Architecture diagram: GitHub → Developer Connect → Cloud Build → (Secret Manager + Sanity API) → dist/ → Docker → Artifact Registry → Cloud Run → Firebase Hosting (CDN + Custom Domain) → End User

#### 3.1.2 Content update path: Sanity Studio → Webhook → Validator → Cloud Build Trigger → New Build → New Deployment

#### 3.1.3 All runtime traffic: User → Firebase Hosting Edge → Cloud Run → nginx → static files (no Sanity API calls at runtime)

### 3.2 Technology Stack

#### 3.2.1 Frontend: React 19 + Vite + Tailwind CSS + TypeScript

#### 3.2.2 Content: Sanity CMS with GROQ queries; @portabletext/react for rendering

#### 3.2.3 Build tooling: tsx for script execution, Playwright for prerendering, serve for local static server

#### 3.2.4 Container: nginx:1.27-alpine, non-root UID 1001

#### 3.2.5 Infrastructure: GCP Cloud Run (gen2), Firebase Hosting, Artifact Registry, Secret Manager, Cloud Build, Cloud Monitoring

#### 3.2.6 Observability: Sentry for error tracking, Cloud Monitoring for uptime and alerts

### 3.3 Environment Variable Architecture

#### 3.3.1 Complete env var table: name, Vite prefix, source, used by, required, example value (table)

#### 3.3.2 Public vars (VITE\_ prefix): VITE_SANITY_PROJECT_ID, VITE_SANITY_DATASET, VITE_SANITY_API_VERSION, VITE_SITE_URL, VITE_APP_VERSION — safe for client bundles

#### 3.3.3 Secret vars (NO VITE\_ prefix): SANITY_API_READ_TOKEN (Secret Manager only), SENTRY_AUTH_TOKEN (optional)

#### 3.3.4 Auto-set vars: PORT (Cloud Run injects automatically, nginx consumes via envsubst)

#### 3.3.5 Variable lifecycle across environments: local dev (.env.local) → Cloud Build (secretEnv + env) → Cloud Run (none or non-secret only)

### 3.4 Architecture Decision Records

#### 3.4.1 ADR-001: nginx-static over Node.js runtime — zero runtime secrets, minimal attack surface, faster cold starts, lower memory; tradeoff: no SSR at runtime

#### 3.4.2 ADR-002: No VITE\_ prefix on SANITY_API_READ_TOKEN — prevents Vite from inlining the secret into client JS; token only accessible to Node.js build scripts

#### 3.4.3 ADR-003: 512Mi memory for Cloud Run gen2 — gen2 minimum requirement; 256Mi would cause deployment failure; corrected from v11 spec

#### 3.4.4 ADR-004: Infrastructure-first over content-first — parallel workstreams, early pipeline validation, failure isolation

#### 3.4.5 ADR-005: public-placeholder directory for Firebase Hosting — single source of truth (all content from Cloud Run), no asset duplication

#### 3.4.6 ADR-006: CLOUD_LOGGING_ONLY in Cloud Build — prevents secret leakage in legacy GCS log buckets

#### 3.4.7 ADR-007: No fallback build in Dockerfile — deterministic builds, no secrets in Docker context, smaller image size; requires pre-built dist/

### 3.5 Cloud Build Pipeline Architecture

#### 3.5.1 Pipeline step reference table: step #, ID, name, purpose, critical config (table)

#### 3.5.2 Security-critical step sequencing: content-snapshot (step 4, sole secret consumer) → build steps → secret audit (step 9) → Docker build (step 11)

#### 3.5.3 Substitution variables: \_REGION, \_AR_REPO, \_SERVICE, \_CACHE_BUCKET — set in cloudbuild.yaml

#### 3.5.4 Machine type: E2_HIGHCPU_8; timeout: 1800s; logging: CLOUD_LOGGING_ONLY

### 3.6 Container Architecture

#### 3.6.1 nginx configuration: listen ${PORT}, /healthz location, CSP headers, immutable cache for /assets/\*, .map 404, SPA try_files fallback

#### 3.6.2 Dockerfile layers: FROM nginx:1.27-alpine → create user/group 1001 → WORKDIR → COPY dist/ → validate index.html exists → USER 1001 → EXPOSE 8080 → nginx with envsubst

#### 3.6.3 Cloud Run service configuration: concurrency=80, minScale=0, maxScale=10, cpu-throttling, execution-environment=gen2, no-default-url, labels=env=prod,app=mangu-publishers

## 4. Milestone Implementation Plan (~4000 words, 7 tables)

### 4.1 Milestone 0 — Pre-flight Setup

#### 4.1.1 Account verification checklist: GitHub repo access, Sanity project access, GCP project + billing, domain registrar access

#### 4.1.2 Local tool installation: Node.js 20 via nvm, global npm installs (tsx, firebase-tools), gcloud CLI auth, Docker Desktop, jq

#### 4.1.3 One-time repo audit: 6 commands to assess current repo state; save output for reference

#### 4.1.4 Stage Drive files locally: download all 8 code/config files to \_drive_files/ directory

### 4.2 Milestone 1 — Local Security Hardening

#### 4.2.1 Task table: rename token, create scripts/\_lib, update .gitignore, create .dockerignore, add audit:secrets script (table)

#### 4.2.2 Rename VITE_SANITY_API_READ_TOKEN → SANITY_API_READ_TOKEN across all files; verify with grep

#### 4.2.3 Create scripts/\_lib/ and copy node-env.ts (Zod validation) + sanity-node-client.ts (build-time Sanity client with useCdn:false, perspective:published)

#### 4.2.4 .gitignore additions: src/generated/contentSnapshot.json, .env.local, .env\*.local

#### 4.2.5 .dockerignore contents: node_modules/, .git/, .env*, *.md, docs/, scripts/, src/generated/contentSnapshot.json, .cache/, .vscode/, .idea/, \*.log

#### 4.2.6 Exit criteria: audit:secrets passes (exit 0), grep returns empty, node-env.ts throws on missing token

### 4.3 Milestone 2 — Build Pipeline Scripts

#### 4.3.1 Task table: update package.json scripts, create 5 build scripts, create .env.local, run full pipeline (table)

#### 4.3.2 package.json scripts block: build:content, build:routes, build:vite, build:prerender, build:sitemap, combined build, audit:secrets, smoke:check-routes

#### 4.3.3 build-content-snapshot.ts: Sanity client fetches books/authors/categories; writes snapshot with contentHash (SHA-256), buildCommit, sanityDataset

#### 4.3.4 generate-routes.ts: Reads snapshot; outputs static + dynamic routes to .cache/routes.json

#### 4.3.5 prerender.ts: Playwright Chromium visits each route on local server; writes dist/{route}/index.html

#### 4.3.6 generate-sitemap.ts: Reads routes; writes dist/sitemap.xml with proper XML structure

#### 4.3.7 smoke/check-routes.ts: Verifies every route in routes.json has corresponding index.html in dist/

#### 4.3.8 .env.local template with all required variables and security annotations

#### 4.3.9 Exit criteria: dist/ complete (index.html, sitemap.xml, hashed assets, prerendered shells), snapshot has required fields, smoke check passes, audit passes

### 4.4 Milestone 3 — Runtime Container

#### 4.4.1 Task table: copy Dockerfile + nginx.conf.template, build image, verify hard-fail, verify runtime behavior (table)

#### 4.4.2 Dockerfile: nginx:1.27-alpine, non-root 1001, COPY dist/, hard validation, EXPOSE 8080

#### 4.4.3 nginx.conf.template: /healthz, CSP, immutable cache, .map 404, SPA fallback, listen ${PORT}

#### 4.4.4 Build succeeds with dist/ present; fails hard without dist/

#### 4.4.5 Runtime verification: health check 200, CSP excludes api.sanity.io, asset cache immutable, container runs as uid=1001, SPA fallback works

#### 4.4.6 Exit criteria: all runtime verification checks pass

### 4.5 Milestone 4 — GCP Foundation

#### 4.5.1 Task table: set env vars, enable APIs, create Artifact Registry, create Secret Manager secret, create build SA, create cache bucket, Developer Connect, build trigger (table)

#### 4.5.2 Environment variables: PROJECT_ID, REGION, SERVICE, AR_REPO, CACHE_BUCKET, BUILD_SA_NAME, PROJECT_NUMBER, BUILD_SA, GITHUB_REPO_URL

#### 4.5.3 10 required GCP APIs: run, cloudbuild, artifactregistry, secretmanager, developerconnect, firebase, firebasehosting, logging, monitoring, ondemandscanning

#### 4.5.4 Artifact Registry: Docker repo web-images with immutable tags; cleanup policy (keep 15 tagged, delete untagged after 3 days)

#### 4.5.5 Secret Manager: sanity-api-read-token created from actual token value; build SA granted secretAccessor scoped to this secret only

#### 4.5.6 Cloud Build service account: cloudbuild-mangu-publishers with 5 project roles + Secret Manager access

#### 4.5.7 Cache bucket: mangu-publishers-cloudbuild-cache in us-central1; build SA has objectAdmin

#### 4.5.8 Developer Connect: GitHub OAuth flow, repo link creation (browser-interactive step)

#### 4.5.9 Cloud Build trigger: mangu-publishers-main on ^main$ via Developer Connect using custom build SA

#### 4.5.10 Exit criteria: all resources verifiable via gcloud describe commands; push to main triggers a build

### 4.6 Milestone 5 — Cloud Build End-to-End

#### 4.6.1 Task table: copy cloudbuild.yaml, pre-flight checks, push to main, monitor 16-step pipeline, verify deployed service (table)

#### 4.6.2 cloudbuild.yaml pre-flight: memory=512Mi, CLOUD_LOGGING_ONLY, secretEnv only on content-snapshot, --no-default-url, correct step ordering, vulnerability scan present

#### 4.6.3 16-step pipeline walkthrough: cache restore → install → audit → content snapshot → routes → Vite build → prerender → sitemap → secret audit → smoke test → Docker build → push → CVE scan → deploy → tag prune → cache save

#### 4.6.4 Verify deployed service: memory 512Mi, port 8080, service URL returns 200, /healthz returns 200

#### 4.6.5 Verify no secret leakage in logs; verify image has SHA + latest tags in Artifact Registry

#### 4.6.6 Exit criteria: Cloud Build green end-to-end, service healthy, no secrets in logs, image tagged correctly

### 4.7 Milestone 6 — Firebase Hosting & Custom Domain (LAUNCH)

#### 4.7.1 Task table: create public-placeholder, copy firebase.json, init hosting, deploy, add custom domain, verify (table)

#### 4.7.2 public-placeholder/ with .gitkeep; firebase.json with rewrites to mangu-publishers Cloud Run service, pinTag: true

#### 4.7.3 firebase init hosting (select existing project, use public-placeholder, SPA yes, no GitHub auto-deploys)

#### 4.7.4 firebase deploy --only hosting; test default Firebase URL

#### 4.7.5 Add custom domain in Firebase Console; add DNS records; wait for verification + cert provisioning

#### 4.7.6 Launch verification: HTTPS 200, deep links 200, /healthz 200, security headers present, source map 404, asset cache immutable, browser click-through test

#### 4.7.7 Exit criteria: site live on custom domain over HTTPS with all functional requirements verified

### 4.8 Milestone 7a — Observability, webhook path, primary alerting

#### 4.8.1 Task table: Sentry, webhook validator, Cloud Monitoring uptime check, alert policies tied to Decision 7, Artifact Registry cleanup / tag pruning hooks

#### 4.8.2 Sentry: install @sentry/vite-plugin + @sentry/react; configure vite.config.ts with source map upload; optional **`SENTRY_AUTH_TOKEN`** in Secret Manager (scoped only to build/upload steps — never runtime/Docker context alongside **`SANITY_API_READ_TOKEN`**)

#### 4.8.3 Sanity webhook validator: Cloud Run / Functions deployment; HMAC verification + replay protection; triggers Cloud Build on valid signed requests; unsigned returns 401

#### 4.8.4 Cloud Monitoring uptime check on `/healthz`; billing budgets 50/75/90

#### 4.8.5 Exit criteria: **`06`** **P0-8** path exercised at least once with timing notes (**target ~60s typical**, worst-case **`<= 10 min`** / **`<= 20 min`** publish→visibility); **P0-7** and **P0-9** evidence stubs satisfied

### 4.9 Milestone 7b — Production stabilization + UX polish

#### 4.9.1 Portable Text renderer: `@portabletext/react`; Formspree replaces Netlify Forms when applicable

#### 4.9.2 Final alert-route drills, noisy-policy tuning, post-cutover checklist completion

#### 4.9.3 Exit criteria: remaining checklist rows in `14-evidence-and-signoff-log.md`; operator sign-off recorded

## 5. Acceptance Criteria & Test Protocol (~2500 words, 2 tables)

### 5.1 P0 Test Suite Overview

#### 5.1.1 Canonical **`P0-1`…`P0-9`** inventory lives in **`06`**. This outline chapter references frozen narrative sections below for historical alignment only — map legacy headings via **`change-log-and-decisions.md` Decision 5**

#### 5.1.2 Canonical IDs: **P0-1** secrets · **P0-2** build-before-docker · **P0-3** deep links · **P0-4** security headers · **P0-5** health · **P0-6** Cloud Run shape · **P0-7** CI gates incl. CVE scan **after push** · **P0-8** webhook rebuild · **P0-9** observability + cost

### 5.2 P0-1: No Browser-Bundled Secrets

#### 5.2.1 Test A: **`rg`/`grep` entire `dist/`** for SANITY_API_READ_TOKEN — expected: no output

#### 5.2.2 Test B: grep dist/assets/ for base64 token patterns — expected: no Sanity token matches

#### 5.2.3 Test C: Check Cloud Run runtime env for token — expected: no SANITY_API_READ_TOKEN

#### 5.2.4 Test D: Inspect Docker image layers with docker save | strings | grep — expected: no output

#### 5.2.5 Test E: Verify CLOUD_LOGGING_ONLY in cloudbuild.yaml

### 5.3 P0-2: Build Before Docker

#### 5.3.1 Test A: Verify step ordering in cloudbuild.yaml — build steps before docker-build

#### 5.3.2 Test B: Remove dist/ and attempt Docker build — expected: fails with missing index.html error

#### 5.3.3 Test C: Dockerfile must not perform npm/app build (canonical inverted check in **`06`**)

### 5.4 P0-3: Static Runtime

#### 5.4.1 Test A: /healthz returns 200; Test B: container image contains nginx (not node)

#### 5.4.2 Test C: CSP connect-src does not contain api.sanity.io; Test D: no secret env vars at runtime

### 5.5 P0-4: GitHub + Developer Connect

#### 5.5.1 Test A: trigger exists and describes correctly; Test B/C: push to main triggers build within ~60 seconds

### 5.6 P0-5: Firebase Hosting Rewrite

#### 5.6.1 Test A: custom domain resolves HTTPS 200; Test B: deep links return 200 (SPA fallback)

#### 5.6.2 Test C: Firebase/Google headers present; Test D: firebase.json uses public-placeholder

### 5.7 P0-6: Cloud Run Deploy Flags

#### 5.7.1 Configuration verification table: max-instances=10, min-instances=0, gen2, 512Mi, port=8080, allow-unauthenticated

### 5.8 P0-7: nginx SPA Behavior

#### 5.8.1 Test A: hashed assets return immutable cache header; Test B: all five security headers present

#### 5.8.2 Test C: .map URLs return 404; Test D: deep links return SPA HTML

### 5.9 CVE-GATE: Vulnerability Scan (canonical **P0-7** sub-check)

#### 5.9.1 Verify enforce-vulnerability-policy step after docker-push; HIGH/CRITICAL blocks deploy

### 5.10 WEBHOOK: Sanity Rebuild Triggers (canonical **P0-8**)

#### 5.10.1 Test A: Sanity publish triggers Cloud Build (**target ~60s typical**; worst-case SLO in **`06`**/**`13`**); Test B: unsigned request returns 401

#### 5.10.2 Test C: replay of same signed payload within replay window rejected as duplicate

## 6. Operational Runbook (~2500 words, 4 tables)

### 6.1 Verifying a Cloud Build Run

#### 6.1.1 Check build status via gcloud builds list; stream logs via gcloud builds log

#### 6.1.2 Step-by-step log verification checklist: all 16 steps with expected output patterns (table)

#### 6.1.3 Verify build artifacts in Artifact Registry; verify no secrets in logs

### 6.2 Checking Cloud Run Service Health

#### 6.2.1 Describe service configuration: verify memory, port, concurrency, scaling, execution environment (table of expected values)

#### 6.2.2 Health check via service URL; check security headers; monitor traffic distribution

#### 6.2.3 Check request count, memory utilization, and other metrics via Cloud Monitoring

### 6.3 Rollback Procedure

#### 6.3.1 List revisions with gcloud run revisions list; identify last good revision

#### 6.3.2 Roll back traffic: gcloud run services update-traffic with --to-revisions

#### 6.3.3 Verify rollback via curl; optionally delete bad revision after confirmation

### 6.4 Manual Rebuild Triggers

#### 6.4.1 Method comparison table: Cloud Build submit, trigger run, empty commit, Sanity webhook (table)

#### 6.4.2 Method 1: gcloud builds submit with config and substitutions

#### 6.4.3 Method 2: gcloud builds triggers run mangu-publishers-main --branch=main

#### 6.4.4 Method 3: git commit --allow-empty and push to main

#### 6.4.5 Method 4: Sanity webhook (automated after **M7a** webhook deployment)

### 6.5 Token Rotation Procedure

#### 6.5.1 Generate new Sanity token with Viewer role; add to Secret Manager as new version

#### 6.5.2 Verify Cloud Build uses latest version; trigger test build

#### 6.5.3 Disable old version after 24h; delete old Sanity token after 7 days

### 6.6 Billing and Cost Monitoring

#### 6.6.1 Check billing budgets and alert thresholds; view current month spend

#### 6.6.2 Check Artifact Registry image count; verify cleanup policy status

#### 6.6.3 Manual image cleanup commands if needed

### 6.7 Tag Pruning Operations

#### 6.7.1 Automatic execution via Cloud Build step 15; manual execution with env vars

#### 6.7.2 Verify tag count after pruning; optional Cloud Scheduler weekly job

## 7. Risk Assessment & Troubleshooting (~3000 words, 3 tables)

### 7.1 Risk Register

#### 7.1.1 Risk matrix table: risk ID, description, probability, impact, mitigation, owner (table)

#### 7.1.2 R1: Secret leakage via VITE\_ prefix — mitigation: audit:secrets script, Zod validation, grep checks

#### 7.1.3 R2: Cloud Run deployment failure (256Mi memory) — mitigation: ADR-003 correction to 512Mi

#### 7.1.4 R3: Developer Connect OAuth interruption — mitigation: verify GitHub owner rights, allow retry

#### 7.1.5 R4: Immutable tag conflict on :latest push — mitigation: remove --immutable-tags or push SHA-only

#### 7.1.6 R5: Vulnerability scan blocking deployment — mitigation: update base image, acceptable-risk override

#### 7.1.7 R6: Playwright timeout in Cloud Build — mitigation: increase timeout, upgrade Playwright image

#### 7.1.8 R7: Webhook content not updating site — mitigation: clear npm cache, verify token dataset access

#### 7.1.9 R8: .env.local committed to git — mitigation: git filter-repo, rotate token, force push

### 7.2 Milestone-Specific Troubleshooting

#### 7.2.1 M1 troubleshooting: Zod validation error, incomplete token rename, audit:secrets failure (symptom/cause/fix for each)

#### 7.2.2 M2 troubleshooting: Sanity unauthorized error, Playwright browser not installed, prerender hang, smoke test missing files

#### 7.2.3 M3 troubleshooting: Docker COPY failure, missing index.html, health check 404, container running as root

#### 7.2.4 M4 troubleshooting: Artifact Registry permission denied, Secret Manager IAM failure, Developer Connect OAuth failure, trigger SA not found

#### 7.2.5 M5 troubleshooting: Cloud Run memory rejection, --no-default-url flag rejection, secretEnv not injecting, immutable tag conflict, vulnerability blocking, Playwright timeout

#### 7.2.6 M6 troubleshooting: Firebase public directory not found, 404 on all routes

#### 7.2.7 **M7a/M7b** troubleshooting: webhook content stale (P0-8), Sentry / dual-secret (`SANITY_API_READ_TOKEN` vs optional `SENTRY_AUTH_TOKEN`) source map upload failure, tag pruning jq error

### 7.3 Cross-Cutting Issues

#### 7.3.1 Cloud Build logs showing secret values — fix: verify CLOUD_LOGGING_ONLY, remove echo commands

#### 7.3.2 .env.local accidentally committed — fix: git filter-repo, rotate token, update .gitignore

### 7.4 SDLC Quality Gates

#### 7.4.1 Seven gates: PLAN → BUILD → REVIEW → TEST → STAGE → SHIP → VERIFY (table with description and skip conditions)

#### 7.4.2 Gate 1 PLAN: understand milestone, source doc, done criteria, dependencies, effort estimate

#### 7.4.3 Gate 2 BUILD: work on branch, commit BEFORE state, follow docs literally, scope changes, save GCP output

#### 7.4.4 Gate 3 REVIEW: read git diff, no accidental files, no debug code, no secrets, no commented-out code

#### 7.4.5 Gate 4 TEST: run locally, verify exit criteria, run smoke check, run secrets audit

#### 7.4.6 Gate 5 STAGE: commit message format, single logical change, branch up to date

#### 7.4.7 Gate 6 SHIP: previous milestone done, rebased, not heading to bed for first runs, push and merge

#### 7.4.8 Gate 7 VERIFY: Cloud Build green, service healthy, behavior observable in production, update checklist

#### 7.4.9 Anti-patterns table: common mistakes and which gate catches them

## 8. Appendices (~2000 words, 4 tables)

### 8.1 Appendix A: Environment Variables Quick Reference

#### 8.1.1 Complete env var table: all 8 variables with name, prefix status, source, consumer, required flag, example (table)

### 8.2 Appendix B: Sanity Content Model Reference

#### 8.2.1 Document type summary: book, author, category with key fields and relationships (table)

#### 8.2.2 GROQ query reference: all 5 queries with purpose and parameters

### 8.3 Appendix C: Cloud Build Step Reference

#### 8.3.1 All 16 steps with ID, name, Docker image, entrypoint, purpose, critical notes (table)

### 8.4 Appendix D: File Inventory

#### 8.4.1 Repo files to create/modify: filename, milestone, purpose, source (table)

#### 8.4.2 Drive files to download: filename, purpose, destination in repo

### 8.5 Appendix E: Estimated Effort

#### 8.5.1 Effort table by milestone: realistic session count for solo evening/weekend pace

#### 8.5.2 Critical path: M1→M2→M3→M4→M5→M6 = 8–17 sessions; **M7a**/**M7b** add ~3–6 more combined

### 8.6 Appendix F: Daily Work Log Template

#### 8.6.1 Session log template: milestone, branch, goals, what was done, what worked, what broke, open questions, stopping point, next steps, references, commits

# References

## litstream_phase2.agent.outline.md

- **Type**: Report outline
- **Description**: This outline file
- **Path**: /mnt/agents/output/litstream_phase2.agent.outline.md
