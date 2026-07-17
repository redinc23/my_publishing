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
