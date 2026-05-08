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

| Tool | Version / Spec | Installation Command | Verification |
|------|---------------|---------------------|------------|
| Node.js | 20.x (LTS) | `nvm install 20 && nvm use 20` | `node --version` |
| tsx | latest (global) | `npm install -g tsx` | `tsx --version` |
| firebase-tools | latest (global) | `npm install -g firebase-tools` | `firebase --version` |
| gcloud CLI | latest | Google Cloud SDK installer | `gcloud version` |
| Docker Desktop | 4.x or later | docker.com/products/docker-desktop | `docker --version` |
| jq | 1.6 or later | `brew install jq` (macOS) or `apt install jq` (Linux) | `jq --version` |

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

| File | Milestone Used | Purpose |
|------|---------------|---------|
| `cloudbuild.yaml` | M5 | 16-step Cloud Build pipeline definition |
| `Dockerfile` | M3 | nginx container build specification |
| `nginx.conf.template` | M3 | nginx runtime configuration with CSP and SPA fallback |
| `firebase.json` | M6 | Firebase Hosting rewrite configuration |
| `artifact-cleanup-policy.json` | M4, M7 | Artifact Registry lifecycle policy |
| `node-env.ts` | M1 | Zod-based environment validation (build-time only) |
| `sanity-node-client.ts` | M1 | Build-time Sanity client with `useCdn: false` |
| `prune-cloud-run-tags.sh` | M7 | Cloud Run traffic tag pruning script |

Store `_drive_files/` in the home or projects directory — not inside the repository. This prevents accidental commits of configuration files that belong at specific paths within the repo.

---

### 4.2 Milestone 1 — Local Security Hardening

**Goal:** The `SANITY_API_READ_TOKEN` is never exposed to the browser bundle. All secret-handling infrastructure is verified locally before any cloud infrastructure work begins.

Milestone 1 addresses the most critical security vulnerability in the Phase 1 codebase: the Sanity read token is prefixed with `VITE_`, which causes Vite to inline the value into client-side JavaScript at build time. The fix renames the variable, introduces Zod-based validation, establishes defensive ignore files, and adds an automated audit script that runs on every build.

| # | Task | Operation | Verification |
|---|------|-----------|-------------|
| 1.1 | Rename `VITE_SANITY_API_READ_TOKEN` → `SANITY_API_READ_TOKEN` | `find . -type f -exec sed -i 's/VITE_SANITY_API_READ_TOKEN/SANITY_API_READ_TOKEN/g' {} +` | `grep -rn "VITE_SANITY_API_READ_TOKEN" .` returns empty |
| 1.2 | Create `scripts/_lib/` directory | `mkdir -p scripts/_lib` | `ls -la scripts/_lib/` succeeds |
| 1.3 | Copy `node-env.ts` from Drive | `cp _drive_files/node-env.ts scripts/_lib/node-env.ts` | Zod validation throws on missing token |
| 1.4 | Copy `sanity-node-client.ts` from Drive | `cp _drive_files/sanity-node-client.ts scripts/_lib/sanity-node-client.ts` | Imports from `node-env.ts`; `useCdn: false`, `perspective: "published"` |
| 1.5 | Add `.gitignore` entries | Append 3 lines to `.gitignore` | `grep` checks confirm all entries present |
| 1.6 | Create `.dockerignore` | `cat > .dockerignore << 'EOF'` (heredoc with 11 lines) | `cat .dockerignore` shows correct content |
| 1.7 | Add `audit:secrets` npm script | Add to `package.json` scripts block | `npm run audit:secrets` exits 0 |

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

| # | Task | Script File | npm Script | Output |
|---|------|-------------|------------|--------|
| 2.1 | Update `package.json` scripts block | — | 8 entries in `"scripts"` | Pipeline definition |
| 2.2 | Create `build-content-snapshot.ts` | `scripts/build-content-snapshot.ts` | `build:content` | `src/generated/contentSnapshot.json` |
| 2.3 | Create `generate-routes.ts` | `scripts/generate-routes.ts` | `build:routes` | `.cache/routes.json` |
| 2.4 | Create `prerender.ts` | `scripts/prerender.ts` | `build:prerender` | `dist/{route}/index.html` |
| 2.5 | Create `generate-sitemap.ts` | `scripts/generate-sitemap.ts` | `build:sitemap` | `dist/sitemap.xml` |
| 2.6 | Create `check-routes.ts` | `scripts/smoke/check-routes.ts` | `smoke:check-routes` | Console pass/fail |
| 2.7 | Create `.env.local` | `.env.local` | — | Local environment config |
| 2.8 | Run full pipeline | — | `npm run build` | Complete `dist/` directory |

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

| Field | Source | Purpose |
|-------|--------|---------|
| `buildCommit` | `process.env.VITE_APP_VERSION` or `"local"` | Traceability: identifies which commit produced the build |
| `sanityDataset` | `env.VITE_SANITY_DATASET` | Identifies which Sanity dataset was the content source |
| `generatedAt` | `new Date().toISOString()` | Timestamp for cache invalidation decisions |
| `contentHash` | SHA-256 of the serialized snapshot JSON | Cache-busting key for downstream consumers |

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

| # | Task | Operation | Verification |
|---|------|-----------|-------------|
| 3.1 | Copy `Dockerfile` from Drive | `cp _drive_files/Dockerfile .` | `ls Dockerfile` succeeds |
| 3.2 | Copy `nginx.conf.template` from Drive | `cp _drive_files/nginx.conf.template .` | `ls nginx.conf.template` succeeds |
| 3.3 | Build image with `dist/` present | `docker build -t mangu-publishers-test .` | Build succeeds |
| 3.4 | Verify hard-fail without `dist/` | `mv dist dist-backup && docker build -t mangu-publishers-fail .` | Build fails with missing-file error |
| 3.5 | Run container locally | `docker run -d -p 8080:8080 --name mangu-publishers-local mangu-publishers-test` | Container starts, `docker ps` shows it |
| 3.6 | Verify health check | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/healthz` | Returns `200` |
| 3.7 | Verify CSP excludes Sanity API | `curl -sI http://localhost:8080/ \| grep -i "content-security-policy"` | Does NOT contain `api.sanity.io` |
| 3.8 | Verify asset cache headers | `curl -sI http://localhost:8080/assets/{hashed-file}` | `Cache-Control: public, max-age=31536000, immutable` |
| 3.9 | Verify source map 404 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/assets/index.js.map` | Returns `404` |
| 3.10 | Verify non-root user | `docker exec mangu-publishers-local id` | Shows `uid=1001` |

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

| # | Task | gcloud Command(s) | Verification |
|---|------|-------------------|-------------|
| 4.1 | Set environment variables | `export` block (8 variables) | All variables non-empty in `env` |
| 4.2 | Enable 10 GCP APIs | `gcloud services enable` (10 APIs) | `gcloud services list --enabled` shows all 10 |
| 4.3 | Create Artifact Registry | `gcloud artifacts repositories create` + cleanup policy | `gcloud artifacts repositories describe` succeeds |
| 4.4 | Create Secret Manager secret | `gcloud secrets create sanity-api-read-token` | `gcloud secrets versions access latest` returns token |
| 4.5 | Create Cloud Build service account | `gcloud iam service-accounts create` + 5 role grants + secret binding | `gcloud iam service-accounts describe` succeeds |
| 4.6 | Create cache bucket | `gcloud storage buckets create` + IAM binding | `gcloud storage buckets describe` succeeds |
| 4.7 | Developer Connect GitHub link | `gcloud developer-connect connections create` + `git-repository-links create` | OAuth flow completes; link shows in console |
| 4.8 | Cloud Build trigger | `gcloud builds triggers create developer-connect` | `gcloud builds triggers describe mangu-publishers-main` succeeds |

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

| # | Task | Operation | Verification |
|---|------|-----------|-------------|
| 5.1 | Copy `cloudbuild.yaml` from Drive | `cp _drive_files/cloudbuild.yaml .` | File present at repo root |
| 5.2 | Pre-flight checks on `cloudbuild.yaml` | 6 grep-based verifications | All checks match expected values |
| 5.3 | Commit and push to `main` | `git add && git commit && git push` | Build triggers within 60 seconds |
| 5.4 | Monitor 16-step pipeline | `gcloud builds log <BUILD_ID>` | All 16 steps complete (green) |
| 5.5 | Verify deployed service | `gcloud run services describe` + `curl` | Memory 512Mi, port 8080, URL returns 200 |
| 5.6 | Verify no secret leakage | `gcloud logging read` query | No results for token name in logs |
| 5.7 | Verify image tags in AR | `gcloud artifacts docker images list` | Both `SHORT_SHA` and `latest` tags present |

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

| Step | ID | Purpose | Key Details |
|------|-----|---------|-------------|
| 1 | `restore-npm-cache` | Restore npm cache from GCS bucket | `gsutil cp` from `${_CACHE_BUCKET}` |
| 2 | `install` | Install Node.js dependencies | `npm ci` with cache at `/workspace/.npm` |
| 3 | `production-audit` | Run `npm audit` (non-blocking) | `--audit-level=high`, `|| true` |
| 4 | `content-snapshot` | Fetch Sanity content | **Only step with `secretEnv: [SANITY_API_READ_TOKEN]`** |
| 5 | `generate-routes` | Build `.cache/routes.json` from snapshot | `npm run build:routes` |
| 6 | `vite-build` | Vite production build | Sets `VITE_APP_VERSION=${SHORT_SHA}` |
| 7 | `prerender` | Playwright Chromium renders all routes | Uses pinned `mcr.microsoft.com/playwright:v1.43.0-jammy` |
| 8 | `sitemap` | Generate `dist/sitemap.xml` | `npm run build:sitemap` |
| 9 | `audit-secrets` | Verify no secrets in `dist/assets/` | Exits 1 if `SANITY_API_READ_TOKEN` found in bundle |
| 10 | `smoke-test` | Verify all routes have `index.html` | `npm run smoke:check-routes` |
| 11 | `docker-build` | Build nginx container from `dist/` | Tags with both `SHORT_SHA` and `latest` |
| 12 | `docker-push` | Push image to Artifact Registry | `--all-tags` pushes both tags |
| 13 | `enforce-vulnerability-policy` | CVE scan blocks on HIGH/CRITICAL | Exits 1 if CRITICAL or HIGH findings detected |
| 14 | `deploy-run` | Deploy to Cloud Run | `--memory=512Mi --no-default-url --execution-environment=gen2` |
| 15 | `prune-tags` | Remove old Cloud Run traffic tags | Calls `scripts/ops/prune-cloud-run-tags.sh` |
| 16 | `save-npm-cache` | Save npm cache to GCS bucket | `gsutil cp` to `${_CACHE_BUCKET}` |

Steps 1–10 constitute the **build phase**: they produce `dist/` and verify its integrity. Steps 11–14 constitute the **deploy phase**: they containerize, scan, and deploy. Steps 15–16 are **cleanup phase**: they maintain resource hygiene and cache state.

The vulnerability scan (step 13) is a deploy gate. If the scan finds HIGH or CRITICAL CVEs in the container image, it prints a block message and exits with code 1, preventing the Cloud Run deploy step from executing. This is a P0 acceptance criterion (CVE-GATE).

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

| # | Task | Operation | Verification |
|---|------|-----------|-------------|
| 6.1 | Create `public-placeholder/` | `mkdir -p public-placeholder && touch public-placeholder/.gitkeep` | Directory exists, tracked by git |
| 6.2 | Copy `firebase.json` from Drive | `cp _drive_files/firebase.json .` | `public: "public-placeholder"`, rewrite to `mangu-publishers` with `pinTag: true` |
| 6.3 | Initialize Firebase Hosting | `firebase init hosting` | Select existing project, `public-placeholder`, SPA yes, no GitHub auto-deploys |
| 6.4 | Deploy Firebase Hosting | `firebase deploy --only hosting` | Default Firebase URL serves the site |
| 6.5 | Add custom domain | Firebase Console → Hosting → Add custom domain | DNS records added at registrar |
| 6.6 | Verify launch | 7 verification checks (HTTPS, deep links, headers, cache, SPA) | All checks pass |

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

| # | Task | Operation | Verification |
|---|------|-----------|-------------|
| 7.1 | Sentry release tracking | `npm install --save-dev @sentry/vite-plugin @sentry/react`; update `vite.config.ts`; add `SENTRY_AUTH_TOKEN` to Secret Manager | Sentry dashboard shows events tagged with SHA |
| 7.2 | Sanity webhook validator | Deploy Cloud Run Function with HMAC verification + replay protection | Publish in Sanity triggers build within 60s; unsigned request returns 401 |
| 7.3 | Cloud Monitoring uptime check | `gcloud monitoring uptime create mangu-publishers-healthz` | Green check on `/healthz` in Monitoring Console |
| 7.4 | Alert policies | Create 4 policies: 5xx rate, p99 latency, memory, instance count | Policies show as active in Alerting Console |
| 7.5 | Billing budget alerts | Cloud Console → Billing → Budgets & alerts | Notifications at 50%, 75%, 90% |
| 7.6 | Artifact Registry cleanup | Verify policy from M4.3 | `gcloud artifacts repositories describe` shows policy |
| 7.7 | Cloud Run tag pruning | Copy `prune-cloud-run-tags.sh`; run or schedule | Excess tags removed; most recent 50 retained |
| 7.8 | Portable Text renderer | `npm install @portabletext/react`; create `PortableTextRenderer.tsx` | Renders Sanity rich text correctly |
| 7.9 | Replace Netlify Forms | Sign up for Formspree; update contact form POST endpoint | Form submissions arrive at configured destination |

#### 4.8.1 Sentry Release Tracking and Hidden Source Maps

Install the Sentry packages:

```bash
npm install --save-dev @sentry/vite-plugin @sentry/react
```

Update `vite.config.ts` to include the `sentryVitePlugin`:

```typescript
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  build: { sourcemap: true },
  plugins: [
    // ... existing plugins
    sentryVitePlugin({
      org: "your-sentry-org",
      project: "mangu-publishers",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: "./dist/**",
        ignore: ["./node_modules/**"],
        filesToDeleteAfterUpload: "./dist/**/*.map",
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

| Alert | Condition | Threshold | Rationale |
|-------|-----------|-----------|-----------|
| 5xx error rate | `metric.type=run.googleapis.com/request_count` with response class 5xx | > 5% over 5 minutes | Detects server errors affecting users |
| p99 latency | `metric.type=run.googleapis.com/request_latencies` | > 2000ms over 10 minutes | Detects performance degradation |
| Memory utilization | `metric.type=run.googleapis.com/container/memory/utilizations` | > 85% over 10 minutes | Prevents OOM kills |
| Instance count | `metric.type=run.googleapis.com/container/instance_count` | >= 8 over 5 minutes | Signals traffic spike or runaway process (maxScale=10) |

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
