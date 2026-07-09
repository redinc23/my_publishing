---
name: Full project hardening plan
status: archived-superseded
superseded_by: mangu_publishers_master_ricef.md
overview: 'ARCHIVED SNAPSHOT (May 2026). Merged into Master RICEF. Retained for file-level audit detail. Use mangu_publishers_master_ricef.md + operator_walkthrough_supplement.md for current execution.'
todos:
  - id: delete-save
    content: Delete environment.local.sh.save from disk (contains real GCP Project ID)
    status: completed
  - id: pr1-docker
    content: 'PR1: Uncomment COPY public in Dockerfile; verify via Cloud Build'
    status: completed
  - id: pr2-rename
    content: 'PR2: grep sweep mangu-platform -> mangu-publishers; regen lockfile; update .env example headers'
    status: completed
  - id: pr3-hygiene
    content: 'PR3: Add *.save to .gitignore; land ENV_SETUP_WALKTHROUGH + README warning; scrub real IDs'
    status: completed
  - id: pr4-ci-node20
    content: 'PR4: ci.yml Node 20 + checkout/setup-node v4; engines.node; next.config images cleanup; vercel.json env removal'
    status: completed
  - id: backlog-issues
    content: File 12 GitHub issues for backlog items (health probes, rollback tags, secret scanning, webhook secret, etc.)
    status: completed
  - id: pr-triage
    content: Triage 30 open PRs -- close stale drafts, prune 25 merged remote branches
    status: completed
  - id: month-followup
    content: 'This month: health probes, migration automation, secret scanning expansion, canonical prod decision'
    status: completed
isProject: false
---

# Full Project Hardening Plan -- mangu-publishers

> **Superseded by** [mangu_publishers_master_ricef.md](mangu_publishers_master_ricef.md). Retained as a detailed technical audit snapshot; many checklist items are already completed.

## 1. Project Identity

- **Repository:** `redinc23/my_publishing` (GitHub, private)
- **Package name:** `mangu-publishers` (in local working tree; `mangu-platform` still committed on `main`)
- **Cloud Run service:** `mangu-publishers` ([cloudbuild.yaml](cloudbuild.yaml) `_SERVICE_NAME`)
- **Branch:** `main` (up to date with origin)
- **Framework:** Next.js 14.2.35, App Router, `output: 'standalone'`
- **Runtime:** React 18.3.1, TypeScript 5.3.3 (strict), Tailwind 3.4.1
- **Backend:** Supabase (auth + DB + storage), Stripe (payments), Resend (email), OpenAI (resonance engine)
- **Deploy targets:** Cloud Run via Cloud Build **and** Vercel via GitHub Actions **and** AWS Amplify config present (triple pipeline -- unresolved)
- **Source modules:** 77 app files, 66 components, 53 lib modules, 10 type files, 11 API routes, 1 middleware
- **Database:** 12 Supabase migrations (Jan 2026), manual-only deployment
- **Tests:** 3 unit suites (12 tests), 1 e2e spec (not in CI)
- **Open PRs:** 30 (19 DRAFT, oldest ~4 months), **0 open issues**
- **Stale branches:** 25 merged remote branches never deleted

---

## 2. Local Build Health (all passing)

| Check      | Command              | Result                       |
| ---------- | -------------------- | ---------------------------- |
| Type-check | `npm run type-check` | PASS                         |
| Lint       | `npm run lint`       | PASS (0 warnings)            |
| Unit tests | `npm test`           | PASS (3 suites, 12/12 tests) |
| Build      | `npm run build`      | PASS (standalone output)     |
| Middleware | compiled             | 70.3 kB                      |

**Local toolchain:** Node 24.10.0, npm 11.6.0, gcloud 567.0.0. Docker is **not installed** locally -- Docker verification must happen in Cloud Build or on another machine.

---

## 3. Root File Inventory and Status

### Configuration files (all present and valid)

- [package.json](package.json) -- **Modified (unstaged):** name changed to `mangu-publishers`. Has 25 deps, 17 devDeps. No `engines` field (gap).
- [tsconfig.json](tsconfig.json) -- Clean. Strict mode, bundler resolution, `@/*` path alias.
- [next.config.js](next.config.js) -- Clean but has `images.domains: ['localhost']` (dev-only leak to prod).
- [tailwind.config.ts](tailwind.config.ts) -- Clean.
- [postcss.config.js](postcss.config.js) -- Clean.
- [jest.config.js](jest.config.js) -- Clean. Uses `next/jest`, jsdom env, `@/` alias. **Version skew:** `jest@^29.7.0` vs `jest-environment-jsdom@^30.2.0` (major mismatch, may cause subtle test failures).
- [playwright.config.ts](playwright.config.ts) -- Clean. Points to `tests/e2e/`, 3 browser projects. Note: `webServer.command` is `npm run dev` which runs `validate-env` first -- needs env vars satisfied or server won't start in CI.
- [.eslintrc.json](.eslintrc.json) -- Clean.
- [.prettierrc](.prettierrc) -- Clean.
- [middleware.ts](middleware.ts) -- Clean. Supabase SSR auth with role-based access for admin/author/partner routes.
- [vercel.json](vercel.json) -- Clean but has **stale** `@supabase-url` / `@supabase-anon-key` env refs (deprecated Vercel syntax).

### Deployment files

- [Dockerfile](Dockerfile) -- **Modified (unstaged, BLOCKER):** `COPY --from=builder /app/public ./public` is **commented out**. Uses `node:20-alpine`.
- [.dockerignore](.dockerignore) -- Clean. Excludes `.git`, `.github`, `.next`, `node_modules`, `.env*`.
- [cloudbuild.yaml](cloudbuild.yaml) -- Clean. 7 steps: npm-ci, lint-typecheck, next-build, secret-audit, docker-build, docker-push, deploy-cloud-run, verify-deploy. Uses Node 20. Already references `mangu-publishers`.
- [.github/workflows/ci.yml](.github/workflows/ci.yml) -- Clean but **drifted:** Node 18, `actions/checkout@v3`, `actions/setup-node@v3`. Deploy job uses `amondnet/vercel-action@v20`.
- [.github/workflows/admin-setup.yml](.github/workflows/admin-setup.yml) -- Clean. Already `@v4` + Node 20.
- [.github/workflows/bug-to-issue.yml](.github/workflows/bug-to-issue.yml) -- Clean. Already `@v4` + Node 20.
- [amplify.yml](amplify.yml) -- **Legacy.** AWS Amplify config. Does **not** run lint, type-check, or test (only `npm ci` + `npm run build`). Does not pin Node version. `baseDirectory: .next` may not match Amplify Gen2 hosting expectations. Consider removing if Amplify is no longer a target.
- `pages/` directory -- Contains legacy `404.tsx`, `500.tsx`, `_document.tsx` (Next.js Pages Router). These coexist with App Router but may cause confusion.

### Environment files

- [.env.local](.env.local) -- Present, has 8 keys set (Supabase, Stripe, site URL). **Not committed** (correctly gitignored).
- [.env.local.example](.env.local.example) -- Present. Well-documented with Phase 1/Phase 2 markers. Still says "MANGU Platform" in header.
- [.env.production.example](.env.production.example) -- Present. Template for GCP Cloud Run production. Still says "MANGU Platform" in header.
- [docs/phase2/\_intake/environment.example.sh](docs/phase2/_intake/environment.example.sh) -- Present. Phase 2 intake template.
- `docs/phase2/_intake/environment.local.sh` -- Present, gitignored via `docs/phase2/_intake/.gitignore`.
- `docs/phase2/_intake/environment.local.sh.save` -- **SECURITY RISK.** Untracked but contains **real GCP Project ID**. Must delete immediately.

### Gitignore gaps

- [.gitignore](.gitignore) already covers `*.swp`, `*~`, `.DS_Store`, and `docs/phase2/_intake/environment.local.sh`.
- **Missing:** `*.save` pattern. Editor crash recovery files can sneak in.
- [docs/phase2/\_intake/.gitignore](docs/phase2/_intake/.gitignore) covers `environment.local.sh`, `worksheet-export.*`, `*.pdf` but **not `*.save`**.

### Root scripts (shell)

- `deploy_master.sh`, `setup.sh`, `setup-envs.sh`, `cleanup-envs.sh`, `verify-setup.sh` -- Utility scripts, review whether still current.
- `repos.txt` -- Multi-repo list, likely for nexus tooling.

### Legacy / cleanup candidates

- `AMPLIFY_READY.md` -- AWS Amplify readiness doc (likely stale).
- `COMPLETE_FILE_LIST.md` -- Static file listing (stale as repo evolves).
- `nexus_analysis/` -- Analysis output directory (should be gitignored or archived).
- `tools/copilot_deep_dive.py` -- One-off analysis script.

---

## 4. Application Architecture

### Route groups (App Router)

- **(consumer):** 14 pages -- books, genres, authors, discover, library, audio, reading, readers-hub, about, contact. Mixed public/authenticated.
- **(portals)/author:** 4 pages -- dashboard, analytics, submit, projects. Role: author or admin.
- **(portals)/partner:** 4 pages -- dashboard, catalogs, orders, arc-requests. Role: partner or admin.
- **admin:** 6 pages -- dashboard, books, users, orders, manuscripts, health. Role: admin.
- **(auth):** 4 pages -- login, register, reset-password, verify-email. Public.
- **checkout:** 1 page. Authenticated.
- **dashboard:** 2 pages -- books analytics, my-reviews. Authenticated.

### API routes (11 endpoints + 1 auth callback)

- `/api/health` -- Comprehensive health check (env, DB, auth, Stripe, migrations). **Already exists and is thorough.** Note: references `20260116000000_create_books_table.sql` in comments but **that migration file does not exist** on disk (books likely in `initial_schema.sql`).
- `/api/checkout` -- Stripe checkout session creation.
- `/api/webhook` -- Stripe webhook handler. **Requires `STRIPE_WEBHOOK_SECRET` which is NOT in `cloudbuild.yaml --set-secrets`.**
- `/api/upload` -- File upload.
- `/api/session` -- Session management.
- `/api/analytics/track`, `/api/analytics/stream` -- Analytics.
- `/api/resonance/track`, `/api/resonance/embed`, `/api/resonance/recommend`, `/api/resonance/similar` -- AI recommendation engine. **Requires `OPENAI_API_KEY` which is NOT in `cloudbuild.yaml --set-secrets`.**
- `/callback` -- OAuth auth callback (under `app/(auth)/callback/route.ts`, NOT under `/api/`).

### Admin health page info exposure

`app/admin/health/page.tsx` surfaces presence and partial previews of `NEXT_PUBLIC_SUPABASE_URL`, `STRIPE_SECRET_KEY`, and booleans for `OPENAI_API_KEY` / `RESEND_API_KEY`. Anyone with admin role can see config state. Consider restricting what it displays in production.

### Hardcoded fallback URLs

- `app/sitemap.ts` and `app/robots.ts` fall back to `https://mangu.com` when `NEXT_PUBLIC_SITE_URL` is unset.
- Multiple files fall back to `http://localhost:3000` (email templates, checkout, Stripe redirects, reset-password).
- `app/(consumer)/contact/page.tsx` hardcodes `mailto:support@mangu.com`.

### Components (66 TSX files)

Well-organized into: `ui/` (18 shadcn primitives), `shared/` (7 layout components), `analytics/` (8), `books/` (7), `cards/` (4), `players/` (3), `social/` (2), `forms/`, `landing/`, `layout/`, `providers/`, `admin/`. **Duplicate:** `components/common/ErrorBoundary.tsx` and `components/shared/ErrorBoundary.tsx` -- consolidate or clarify intent.

### Lib modules (47 files)

- `actions/` (11) -- Server actions for books, analytics, reviews, follows, payouts, revenue, etc.
- `services/` (6) -- Cache, export queue, performance monitor, realtime analytics, AI insights, analytics tracker.
- `utils/` (14) -- Validation, formatting, rate limiting, env validation, mock data, etc.
- `supabase/` (4) -- Client, server, admin, queries.
- `stripe/` (4) -- Client, server, validate-config, webhooks.
- `hooks/` (4) -- use-books, use-media-query, use-recommendations, use-toast.
- `email/`, `middleware/`, `resonance/`, `validations/`.

### Database (12 Supabase migrations)

From `20260116` to `20260122` covering: initial schema, analytics, storage policies, sessions, materialized views, revenue, payouts, pricing, critical fixes, performance, profile trigger, social features. **Not automated in any pipeline.**

**Documentation drift:** Root `README.md` migration list omits `20260121000000_profile_trigger.sql` and `20260122000000_social_features.sql`. Multiple docs and the health route reference `20260116000000_create_books_table.sql` which **does not exist** as a separate file (books schema likely lives inside `initial_schema.sql`).

### Tests

- **Unit:** 3 suites -- `analytics-optimizer.test.ts`, `queries.test.ts`, `BookCard.test.tsx`. 12 tests total.
- **E2E:** 1 spec -- `purchase-flow.spec.ts`. **Not run in CI** (ci.yml only runs `npm test`).
- **Coverage:** Very thin relative to 66 components + 47 lib modules.

---

## 5. CI/CD Pipeline Drift (the critical inconsistency)

| Environment      | Node        | Actions  | Deploy Target |
| ---------------- | ----------- | -------- | ------------- |
| Dockerfile       | 20-alpine   | N/A      | Cloud Run     |
| cloudbuild.yaml  | 20          | N/A      | Cloud Run     |
| ci.yml (test)    | **18**      | **@v3**  | --            |
| ci.yml (deploy)  | --          | **@v3**  | Vercel        |
| admin-setup.yml  | --          | @v4 (20) | --            |
| bug-to-issue.yml | --          | @v4 (20) | --            |
| Local machine    | **24.10.0** | N/A      | --            |

**Risk:** Tests pass on Node 18 in CI but the production container runs Node 20. Native addon or API differences (e.g., `fetch`, `crypto.subtle`) could cause prod-only failures that CI never catches.

---

## 6. Blockers (must fix before next deploy)

### BLOCKER 1: Docker image missing `public/` directory

- **File:** [Dockerfile](Dockerfile) line 31
- **Impact:** Any static asset in `public/` (favicon, robots.txt, site verification, PWA manifest) silently 404s in Cloud Run.
- **Root cause:** Line was commented out as a workaround; `public/.gitkeep` was later added (commit `7b8ac5b`) making the workaround unnecessary.
- **Fix:** Uncomment `COPY --from=builder /app/public ./public`.
- **Verify:** `docker run --rm --entrypoint sh <image> -c 'ls -la /app/public'` shows `.gitkeep`.

### BLOCKER 2: `.save` file with real infrastructure identifiers

- **File:** `docs/phase2/_intake/environment.local.sh.save` (untracked)
- **Impact:** Contains real GCP Project ID `delta-wonder-488420-i3`. If accidentally `git add .`'d, it ships to GitHub.
- **Fix:** Delete the file. Add `*.save` to `.gitignore`.
- **Defense in depth:** The intake-local `.gitignore` should also get `*.save`.

---

## 7. What Is Working Well

- **Build pipeline locally:** type-check, lint (0 warnings), test (12/12), build all pass cleanly on current main.
- **Health endpoint (`/api/health`):** Comprehensive -- checks env vars, Supabase DB connection, auth service, Stripe config, migration table presence. Returns structured JSON with per-check latency. 358 lines of defensive code.
- **Middleware:** Supabase SSR auth with role-based access (admin, author, partner) and proper cookie handling via `@supabase/ssr`. Graceful fallback when env vars missing.
- **Cloud Build pipeline:** 7-step pipeline (npm-ci, lint+typecheck, build, secret-audit, docker-build, docker-push, deploy+verify). Already aligned on Node 20 and `mangu-publishers` naming.
- **Environment validation:** `validate-env.ts` runs before `npm run dev`, catches missing required vars early with helpful messages. Uses `lib/utils/env-validation.ts` which is also called by the health endpoint.
- **Supabase client setup:** Uses `@supabase/ssr` with proper cookie handling in `lib/supabase/server.ts`. Admin client in `lib/supabase/admin.ts` for service-role operations.
- **Component organization:** Clean domain-driven folders (analytics, books, cards, players, social) plus shadcn `ui/` primitives. 66 components total.
- **Security headers:** HSTS, X-Frame-Options, CSP via `next.config.js` headers function. Duplicated in `amplify.yml` for that deploy target.
- **Stripe validation:** `lib/stripe/validate-config.ts` validates key formats and tests API connectivity at health check time.
- **`.env.local.example` and `.env.production.example`:** Well-documented with Phase 1/Phase 2 markers and inline comments explaining where to get each value.
- **Intake docs:** Structured workflow (walkthrough, fields checklist, example template) with gitignored local files.
- **TypeScript config:** Strict mode, bundler module resolution, `@/*` path alias, incremental compilation.
- **ESLint:** `no-explicit-any: error` and `no-unused-vars: error` -- good strictness baseline.

## 7a. Environment Variable Matrix

| Env var                              | Type   | .env.local | Dockerfile ARG | cloudbuild --set-env/secrets | vercel.json | ci.yml | Code consumption                                    |
| ------------------------------------ | ------ | ---------- | -------------- | ---------------------------- | ----------- | ------ | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | Public | Yes        | Yes            | Yes (env)                    | Yes (@)     | Secret | Supabase clients, middleware, health, scripts       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Public | Yes        | Yes            | Yes (env)                    | Yes (@)     | Secret | Clients, middleware, health, validation             |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Yes        | Yes            | Yes (env)                    | **No**      | **No** | Stripe client, health, validation                   |
| `NEXT_PUBLIC_SITE_URL`               | Public | Yes        | Yes            | Yes (env)                    | **No**      | **No** | Sitemap, robots, emails, checkout, Stripe redirects |
| `SUPABASE_SERVICE_ROLE_KEY`          | Secret | Yes        | No             | Yes (secret)                 | No          | Secret | Admin client, migrations, seed                      |
| `STRIPE_SECRET_KEY`                  | Secret | Yes        | No             | Yes (secret)                 | No          | **No** | Server Stripe, payouts, health                      |
| `STRIPE_WEBHOOK_SECRET`              | Secret | Yes        | No             | **No (gap!)**                | No          | No     | Webhook route, validation                           |
| `OPENAI_API_KEY`                     | Secret | No         | No             | **No (gap!)**                | No          | No     | Resonance embeddings, seed                          |
| `RESEND_API_KEY`                     | Secret | No         | No             | Yes (secret)                 | No          | No     | Email send                                          |
| `USE_MOCKS`                          | Config | No         | No             | No                           | No          | `true` | Env validation                                      |
| `NODE_ENV`                           | Config | Yes        | Set in runner  | No                           | No          | No     | Error boundary, standard                            |

---

## 8. What Is Missing or Incomplete

| Item                                                     | Priority | Details                                                                                                              |
| -------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| Cloud Run health probes                                  | P1       | Health route exists but `--startup-probe` / `--liveness-probe` not in deploy command                                 |
| Automated DB migrations                                  | P1       | No `supabase db push` in any pipeline; manual only                                                                   |
| `engines.node` in package.json                           | P1       | No version pinning for contributors or CI                                                                            |
| Secret scanning (comprehensive)                          | P2       | Only checks `.next/static` for Stripe patterns; misses server dir and other secret types                             |
| Docker image tagging                                     | P2       | Only `:SHORT_SHA`; no rollback-friendly `:main` or `:latest` tag                                                     |
| E2E tests in CI                                          | P2       | Playwright config + 1 spec exist but not invoked in ci.yml                                                           |
| Canonical prod decision                                  | P2       | Both Vercel and Cloud Run deploy to production -- no documented source of truth                                      |
| Test coverage                                            | P2       | 3 suites / 12 tests for 113 source modules                                                                           |
| Pre-commit hooks                                         | P3       | No husky/lint-staged; `*.save` files can sneak in                                                                    |
| Branch cleanup                                           | P3       | 25 merged remote branches never deleted                                                                              |
| PR triage                                                | P3       | 30 open PRs, most 4+ months old, 19 are DRAFT                                                                        |
| `OPENAI_API_KEY` in pipeline                             | P3       | Resonance endpoints exist but key not injected in either deploy                                                      |
| `STRIPE_WEBHOOK_SECRET` in Cloud Run deploy              | **P1**   | Not in `--set-secrets` in cloudbuild.yaml -- webhook signature verification will fail silently                       |
| `OPENAI_API_KEY` in Cloud Run deploy                     | P2       | Resonance endpoints exist but key not in `--set-secrets`                                                             |
| Jest / jest-environment-jsdom version skew               | P2       | `jest@^29.7.0` vs `jest-environment-jsdom@^30.2.0` -- major version mismatch                                         |
| Duplicate ErrorBoundary components                       | P3       | `components/common/ErrorBoundary.tsx` and `components/shared/ErrorBoundary.tsx`                                      |
| Migration doc drift                                      | P2       | README omits 2 migrations; docs reference nonexistent `create_books_table.sql`                                       |
| `validate-env` not in build/CI                           | P2       | Only runs on `npm run dev`, not on `npm run build` or in CI pipeline                                                 |
| Admin health page info exposure                          | P3       | Shows partial secret previews to anyone with admin role                                                              |
| Hardcoded fallback URLs                                  | P3       | `https://mangu.com`, `mailto:support@mangu.com`, `localhost:3000` fallbacks in prod code                             |
| `.env.local.example` / `.env.production.example` headers | P3       | Still say "MANGU Platform"                                                                                           |
| Legacy files                                             | P3       | `amplify.yml`, `AMPLIFY_READY.md`, `COMPLETE_FILE_LIST.md`, `nexus_analysis/`, `pages/` dir                          |
| CI missing Stripe/site URL for build                     | P2       | `ci.yml` does not pass `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SITE_URL` -- build inlines empty strings |

---

## 9. PR Sequence (immediate hardening)

### PR1 -- Restore Docker COPY public

- **Branch:** `fix/docker-copy-public`
- **Files:** [Dockerfile](Dockerfile) only (1 line)
- **Change:** Uncomment `COPY --from=builder /app/public ./public`
- **Verify:** Docker build + `ls -la /app/public` in container (requires Docker -- do in Cloud Build if not available locally)
- **Risk:** Minimal. `public/.gitkeep` is tracked; directory always exists in build context.
- **Blocker:** Docker not installed locally. Verification must happen via Cloud Build post-merge or on another machine.

### PR2 -- Complete rename mangu-platform to mangu-publishers

- **Branch:** `chore/rename-to-mangu-publishers`
- **Files:** [package.json](package.json), [package-lock.json](package-lock.json), [README.md](README.md), [QUICK_START.md](QUICK_START.md), optionally [.env.local.example](.env.local.example) and [.env.production.example](.env.production.example) headers
- **Discovery:** `grep -rn "mangu-platform"` finds 1 remaining hit in [docs/phase2/DEV_HANDOFF_NEXTJS_ALIGNMENT.md](docs/phase2/DEV_HANDOFF_NEXTJS_ALIGNMENT.md) (historical reference "formerly mangu-platform") -- intentional, leave as-is
- **Lockfile:** Regenerate via `rm package-lock.json && npm install` rather than hand-editing
- **Verify:** `node -e "console.log(require('./package.json').name)"` returns `mangu-publishers`; `npm ci && npm run type-check && npm run lint && npm run build` all pass
- **Risk:** Low. Name-only change, no logic.

### PR3 -- Intake docs + .save hygiene

- **Branch:** `docs/env-setup-walkthrough`
- **Files:** [.gitignore](.gitignore), [docs/phase2/\_intake/README.md](docs/phase2/_intake/README.md), `docs/phase2/_intake/ENV_SETUP_WALKTHROUGH.md` (new)
- **Pre-branch:** Delete `environment.local.sh.save` from disk immediately
- **Gitignore change:** Add `*.save` (only -- `*.swp`, `*~`, `.DS_Store` already present)
- **Scrub check:** Verify `ENV_SETUP_WALKTHROUGH.md` has zero real identifiers (grep for `delta-wonder`, real Supabase URLs, etc.)
- **Verify:** `touch test.save && git check-ignore -v test.save && rm test.save`
- **Risk:** Minimal. Docs-only plus one gitignore line.

### PR4 -- Align CI with Node 20 + config cleanup (after PR1-3)

- **Branch:** `chore/align-ci-node-and-pin-runtime`
- **Files:** [.github/workflows/ci.yml](.github/workflows/ci.yml), [package.json](package.json), [next.config.js](next.config.js), [vercel.json](vercel.json)
- **ci.yml changes:**
  - `actions/checkout@v3` to `@v4` in **both** `test` and `deploy` jobs
  - `actions/setup-node@v3` to `@v4` in `test` job
  - `node-version: 18` to `20`
  - Add `cache: npm` under setup-node
- **package.json:** Add `"engines": { "node": ">=20.0.0 <21.0.0" }`
- **next.config.js:** Remove `images.domains: ['localhost']`, keep `remotePatterns`
- **vercel.json:** Remove `env` block with stale `@`-prefixed secrets
- **Verify:** Full pipeline on Node 20 locally: `rm -rf node_modules && npm ci && npm run type-check && npm run lint && npm test && npm run build`
- **Risk:** Medium. Changing CI Node version can surface latent dep issues. Worth its own PR so revert is clean.

---

## 10. Backlog Issues (file on GitHub with owners)

1. **[P1] Cloud Run rollback strategy** -- Tag images `:main` in addition to `:SHORT_SHA`; document `gcloud run services update-traffic` rollback commands in [07-operational-runbook.md](docs/phase2/07-operational-runbook.md)
2. **[P1] Container health probes** -- Add `--startup-probe` and `--liveness-probe` to `gcloud run deploy` step in [cloudbuild.yaml](cloudbuild.yaml); the `/api/health` route already exists
3. **[P1] Automate Supabase migrations** -- Add `supabase db push` to a pipeline step or explicitly document the manual process in [13-cutover-day-runbook.md](docs/phase2/13-cutover-day-runbook.md)
4. **[P1] Add `STRIPE_WEBHOOK_SECRET` to Cloud Run `--set-secrets`** -- Without it, `app/api/webhook/route.ts` cannot verify Stripe webhook signatures. Also add `OPENAI_API_KEY` if resonance endpoints are expected to work.
5. **[P2] Expand secret scanning** -- Current: only `.next/static` for Stripe patterns. Expand to `.next/server`, `public/`, add Supabase JWT / Resend / AWS / Google API key patterns, or adopt `gitleaks`/`trufflehog`
6. **[P2] Eliminate double npm run build** -- `next-build` step in Cloud Build + Docker builder stage both run `npm run build`; choose one path
7. **[P2] Decide Vercel vs Cloud Run vs Amplify canonical prod** -- Three production deploy paths exist (ci.yml -> Vercel, cloudbuild.yaml -> Cloud Run, amplify.yml -> Amplify). Document which is authoritative, env var source-of-truth, and deprecate the rest.
8. **[P2] Fix Jest version skew** -- Align `jest` and `jest-environment-jsdom` to same major version (both 29.x or both 30.x)
9. **[P2] Fix migration documentation drift** -- Update README migration list (add `profile_trigger`, `social_features`); fix or remove references to nonexistent `create_books_table.sql` in health route comments and docs
10. **[P2] Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` to CI env** -- ci.yml build step inlines empty strings for these since they aren't provided as secrets/env; Stripe client and sitemap/robots will have wrong values in CI build output
11. **[P3] GitHub repo rename decision** -- `my_publishing` vs `mangu-publishers`
12. **[P3] Pre-commit hooks** -- `husky` + `lint-staged` to reject `*.save`, secret patterns, `environment.local*`

---

## 11. GitHub Hygiene

- **30 open PRs** -- 19 DRAFT, oldest from January 2026 (~4 months). Most from automated agents (copilot/_, codex/_, cursor/\*). Recommend closing stale drafts that are superseded by `main` changes.
- **25 merged remote branches** never deleted. Run `git remote prune origin` then delete stale remote branches.
- **0 open issues** -- All tracking is informal. The 8 backlog items above should become GitHub issues.

---

## 12. Execution Checklist

**Today (PR1-3, independent, any order):**

- [ ] Delete `environment.local.sh.save` from disk
- [ ] PR1: Restore Docker COPY public -- branch, edit, verify (Cloud Build), commit, push, merge
- [ ] PR2: Rename sweep -- branch, grep, edit, regen lockfile, verify, commit, push, merge
- [ ] PR3: Intake docs + .gitignore -- branch, add `*.save`, scrub walkthrough, verify, commit, push, merge
- [ ] After all three merged: confirm Cloud Build green, confirm Cloud Run revision live

**This week:**

- [ ] PR4: Node 20 + @v4 + engines + next.config + vercel.json cleanup
- [ ] File 8 backlog issues on GitHub with owners and priority labels
- [ ] Triage 30 open PRs (close stale drafts)
- [ ] Prune 25 merged remote branches

**This month:**

- [ ] Health probes + rollback tags (P1 backlog)
- [ ] Add `STRIPE_WEBHOOK_SECRET` (and optionally `OPENAI_API_KEY`) to `cloudbuild.yaml --set-secrets`
- [ ] Supabase migration automation or documented manual process
- [ ] Expanded secret scanning or gitleaks adoption
- [ ] Decide Vercel vs Cloud Run vs Amplify canonical path -- deprecate the losers
- [ ] Fix Jest version skew (`jest@29` vs `jest-environment-jsdom@30`)
- [ ] Fix migration documentation drift (README + health route comments)
- [ ] Add missing `NEXT_PUBLIC_*` vars to CI env or document why they're intentionally empty
- [ ] Expand test coverage (currently 3 suites / 12 tests for 113+ modules)
- [ ] Consolidate duplicate ErrorBoundary components
- [ ] Review legacy files: `amplify.yml`, `AMPLIFY_READY.md`, `COMPLETE_FILE_LIST.md`, `pages/` directory

---

## 13. Sanity Gates (run before every push)

```bash
# No sensitive files tracked
git ls-files | grep -E '\.(save|swp|local)$|environment\.local' && echo "STOP" || echo "OK"

# No obsolete name (after PR2)
grep -rn "mangu-platform" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git . && echo "REVIEW" || echo "OK"

# Dockerfile actively copies public/ (after PR1)
grep -qE '^[[:space:]]*COPY[[:space:]].*\/app\/public' Dockerfile && echo "OK" || echo "STOP"

# Full local pipeline
npm run type-check && npm run lint && npm test && npm run build && echo "ALL PASS" || echo "FAILED"
```
