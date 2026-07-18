# Operator QA Log

Automated checks from plan execution. Manual browser steps still required for auth/checkout.

## Phase 2 (Freeze) + Phase 3 (Recovery) + baseline refresh v1.2.0 (agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 2 (freeze/governance) and Phase 3 Steps 3.4–3.6 (PR closure, branch hygiene, migration triage), executed via GitHub API after authority PR #206 (`0f30649`) and recovery vehicle PR #185 (`16dc1d7`) merged to `main`. Refreshes `docs/NEXT_GO.md` to v1.2.0 / baseline `16dc1d7` per CCR-020/G12. No local/gcloud/supabase/stripe access — external facts remain DOC-ONLY.

| UTC        | Actor              | Env  | SHA / ref                                                | Test-Gate         | Action                           | Expected                                                                            | Actual                                                                                                                                                                                                                | Result                                                    | Artifact / follow-up                                    |
| ---------- | ------------------ | ---- | -------------------------------------------------------- | ----------------- | -------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| 2026-07-18 | agent (GitHub API) | repo | main @ `16dc1d7`                                         | G13               | Confirm authority on main        | `docs/NEXT_GO.md` tracked in release tree                                           | Present via PR #206 (`0f30649`); ADR-001 present at `docs/adr/ADR-001-canonical-platform.md`                                                                                                                          | **G13 TRUE**                                              | `docs/NEXT_GO.md` §6                                    |
| 2026-07-18 | agent              | repo | main @ `16dc1d7`                                         | Step 2.1          | Create launch freeze notice      | Freeze issue with permitted change classes + held items                             | Issue #209 created (permitted classes; #145 + 7 dependabot majors held; #142 deferred)                                                                                                                                | PASS                                                      | issue #209                                              |
| 2026-07-18 | agent              | repo | —                                                        | Step 2.2          | Post HOLD comments on held PRs   | #145 + dependabot majors carry HOLD; #142 deferred                                  | HOLD comments posted on #145, #167, #160, #155, #154, #152, #133, #129; defer comment on #142                                                                                                                         | PASS                                                      | PR comment IDs 5009267082–5009268622                    |
| 2026-07-18 | agent              | repo | recovery `16dc1d7` (PR #185 merged 2026-07-17T23:31:27Z) | Step 3.4 / P0-002 | Close 8 duplicate autofix PRs    | Closed as superseded, referencing recovery merge, only after #185 merged            | #173, #174, #178, #179, #180, #181, #182, #183 closed with superseded comment citing `16dc1d7`                                                                                                                        | PASS                                                      | 8 PRs closed; issue #189                                |
| 2026-07-18 | agent              | repo | origin                                                   | Step 3.5 / P0-002 | Prune orphaned autofix branches  | Delete 24 `cursor/ci-autofix-automation-*` orphans; keep `-709e`/#207, `-609e`/#208 | `git push --delete` → HTTP 403 (sandbox proxy scopes push to designated branch); no MCP delete-branch tool                                                                                                            | **BLOCKED — handed to operator**                          | `docs/NEXT_GO.md` §3.4 (exact command + 24-branch list) |
| 2026-07-18 | agent              | repo | #184 head base `3d9ea3c`                                 | Step 3.6 / P0-004 | Triage migration-reorder PR #184 | Independent decision recorded                                                       | Diff touches **no** `supabase/migrations/` files; adds competing 1,465-line `NEXT_GO.md`; portal edits superseded by 2026-07-17 wave → recommend close as superseded; ordering handled by #185 `--include-all` + #192 | TRIAGED (recommend close; left open for operator confirm) | PR #184 comment 5009279483                              |
| 2026-07-18 | agent              | repo | main @ `16dc1d7`                                         | CCR-020 / G12     | Refresh authority baseline       | v1.1.0 → v1.2.0; baseline `3d9ea3c` → `16dc1d7`; phase/gate states current          | §1 version 1.2.0; §3 refreshed (12 open PRs, G13 TRUE); §4 Phases 1–2 COMPLETE, 3 IN PROGRESS; §6 G13 TRUE, G12 PARTIAL                                                                                               | PASS (this PR)                                            | authority refresh PR                                    |

**Notes:** CI on `16dc1d7` is RED (reported) — #207/#208 target format-check, Trivy secret-scan, webkit E2E flake, and Cloud Build env residuals; **G2 stays FALSE** until required checks are green on the exact deployed SHA (Phase 5). Freeze rule 4 requires consolidating #207/#208 to one vehicle per failure signature before merge. Prior rows below preserved verbatim (append-only, CCR-002).

## Phase 1 — Authority, baseline refresh, traceability (agent-run, 2026-07-18)

**Scope:** Master Execution Specification v1.0 Phase 1 (Steps 1.1–1.5). Executed via GitHub API by the agent; no local/gcloud/supabase/stripe access — external-system facts are DOC-ONLY/REPORTED as classified in `docs/NEXT_GO.md` §2.

| UTC        | Actor              | Env      | SHA / deploy ID                                                                       | Test-Gate               | Action                                                         | Expected                                                                                           | Actual                                                                                                                                                                                                                                                                                                                                                                                 | Result                      | Artifact / follow-up                              |
| ---------- | ------------------ | -------- | ------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------- |
| 2026-07-18 | agent (GitHub API) | repo     | `3d9ea3c77e2829125a950b10a9d2a658d212d58a` (origin/main, commit 2026-07-17T14:52:30Z) | Step 1.2 / G12          | Refresh volatile baseline                                      | Baseline matches or supersedes source snapshot 2026-07-17                                          | main SHA matches source snapshot exactly; 19 open PRs; 96 branches (25 `cursor/ci-autofix-automation-*`, 9 with open PRs); 0 tags; 0 releases; 19 workflows; 25 local migration files (tip `20260717114300_order_items_select_own.sql`); `docs/NEXT_GO.md` absent; `docs/adr/` absent; `scripts/verify-gcp-production.sh` + `scripts/grant-cloudrun-secret-access.sh` MISSING on main  | PASS (baseline refreshed)   | `docs/NEXT_GO.md` §3; issue #202 (P0-020)         |
| 2026-07-18 | agent              | repo     | branch `release/next-go-authority`                                                    | Step 1.1 / P0-019 / G13 | Commit authority document `docs/NEXT_GO.md` + ADR-001 PROPOSED | Authority establishes NO-GO, decision rule, evidence model, gate matrix                            | Committed; open to protected main as authority PR                                                                                                                                                                                                                                                                                                                                      | IN PROGRESS until PR merges | authority PR; issues #196 (P0-019), #190 (P0-003) |
| 2026-07-18 | agent              | repo     | —                                                                                     | Step 1.4 / traceability | Create issue-backed P0 map (20 items)                          | Every P0 has owner, dependencies, acceptance criteria, evidence location, rollback notes           | 20 issues created: #186 (P0-007), #187 (P0-001), #188 (P0-006), #189 (P0-002), #190 (P0-003), #191 (P0-009), #192 (P0-004), #193 (P0-008), #194 (P0-005), #195 (P0-011), #196 (P0-019), #197 (P0-012), #198 (P0-018), #199 (P0-015), #200 (P0-017), #201 (P0-013), #202 (P0-020), #203 (P0-016), #204 (P0-014), #205 (P0-010)                                                          | PASS                        | issues #186–#205; `docs/NEXT_GO.md` §5            |
| 2026-07-18 | agent              | repo     | —                                                                                     | Step 1.5                | Lock operating rules + launch scope                            | Rules in authority doc; README/QUICK_START link authority; false production-ready claims corrected | `docs/NEXT_GO.md` §7–§8 locked; QUICK_START "PRODUCTION READY" banner replaced with authority link (CCR-018); README deployment section links authority                                                                                                                                                                                                                                | IN PROGRESS until PR merges | authority PR                                      |
| 2026-07-18 | agent              | external | —                                                                                     | CCR-017                 | Classify external claims                                       | GCP/Supabase/Stripe/DNS/Sentry claims marked DOC-ONLY pending in-system verification               | GCP `delta-wonder-488420-i3`/`us-central1`/`mangu-publishers`: DOC-ONLY; hosted migration count: DOC-ONLY (25 local VERIFIED; note 2026-07-17 row below reports hardening migrations applied hosted via MCP); Stripe webhook/Secret Manager: DOC-ONLY; www via Vercel + apex TLS mismatch: REPORTED 2026-07-09 (stale); Actions billing lock: REPORTED 2026-07-08 (re-verify next run) | DOCUMENTED                  | `docs/NEXT_GO.md` §3.3                            |

**Notes:** Prior rows below are preserved verbatim (append-only, CCR-002). The 2026-07-17 unit/type-check results remain REPORTED against an uncommitted working tree (base `326bb60`) — not release evidence; Phase 4 reruns on the exact candidate SHA (CCR-005). Manual table rows 1–10 remain unchecked ⇒ G10 FALSE.

## Full-site validation and hardening wave (agent-run, 2026-07-17)

**Scope:** working tree vs baseline `326bb60` — **57 files changed, +1,799 / −269** (excluding `node_modules`). Not yet committed.

| Check      | Command              | Result                                                                                           |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| Unit tests | `npm test`           | **PASS 63/63** (baseline was 42; new suites for auth, API, entitlement, analytics, portal fixes) |
| Type-check | `npm run type-check` | **PASS** — `tsc --noEmit` clean after fixing author analytics `Book` typing                      |

**Changes landed this wave:**

- **SEO / a11y:** canonical + Open Graph metadata fixes across consumer pages; accessible labels added (SearchBar, NewsletterCTA, AudioPlayer, Footer, BookFilters).
- **Auth hardening:** sessionless verification-email resend; honest provider quota errors on register; reset-password confirm restricted to recovery flow only.
- **API hardening:** `/api/resonance/track` input validation + rate limiting; `/api/upload` MIME allowlist; `/api/resonance/similar` safe error responses.
- **Reader / data access:** reading entitlement checks (`lib/reading/entitlement.ts`); library scoped to completed orders; author ownership checks (`lib/supabase/author-ownership.ts`); `analytics_sessions` RLS tightened + `public_profiles` view (migration `20260717114047_tighten_analytics_sessions_rls.sql`).
- **Admin / partner portals:** `profiles.role` escalation protection (migration `20260717114020_protect_profiles_role.sql`); admin book update via admin client; honest error states instead of silent empty tables (`app/admin/_lib/query-error.tsx`, `partner-unavailable.tsx`); ARC rejected filter; pagination clamps.
- **Build config:** `next.config.js` Sentry wrapping gated on Sentry env; `@next/bundle-analyzer` pinned 14.2.35.

**Resolved 2026-07-17:** migrations **`20260717114047`** and **`20260717114020`** (plus `public_read_authors`, `fix_review_stats_trigger`, `revoke_anon_update_reading_progress`) applied to hosted Supabase via MCP — RLS/role protections are live.

**Known operational issues (this machine):**

- Local Windows `node_modules` corruption when multiple agents run `npm ci`/`npm install` concurrently — install solo, repair with `npm install`.
- `@supabase/auth-js` now requires Node **>=22** — older local Node versions fail install/runtime.
- Dev server must run **solo on port 3001** (concurrent dev servers conflict).

## Pre-launch verification (2026-07-09)

Command: `bash scripts/pre-launch-verify.sh` via Git Bash (`C:\Program Files\Git\bin\bash.exe`). Node **v24.14.0** (satisfies `.nvmrc` / `engines`). Final green run: `export SKIP_NPM_CI=1` (Windows: bare `npm ci` in repo root often `ENOTEMPTY` when multiple agents install concurrently; gate skips when `node_modules/.bin/next` exists).

| Gate           | Command / check                          | Result   | Notes                                               |
| -------------- | ---------------------------------------- | -------- | --------------------------------------------------- |
| Node version   | `.nvmrc` (20)                            | **PASS** | v24.14.0                                            |
| Dependencies   | `npm ci` (or skip)                       | **PASS** | SKIP path; `npm install` repair when needed         |
| Env validation | `npm run validate-env`                   | **PASS** | exit 0 (`.env.local` present)                       |
| Type-check     | `npm run type-check`                     | **PASS** | `tsc --noEmit` exit 0                               |
| Lint           | `npm run lint`                           | **PASS** | exit 0                                              |
| Format         | `npm run format:check`                   | **PASS** | exit 0 (`.prettierignore` restored)                 |
| Unit tests     | `npm test`                               | **PASS** | **7** suites, **42** tests                          |
| Migrations     | `scripts/verify-migrations.sh`           | **PASS** | **15** files                                        |
| Build          | `npm run build` (CI mock env)            | **PASS** | `next build` exit 0 after `rm -rf .next`            |
| Secret scan    | `.next/static`, `.next/server`, `public` | **PASS** | tightened pattern (no env-var name false positives) |
| HTML sanity    | `public/**/*.html`                       | **PASS** | **1** file                                          |

**Pre-launch script exit:** **0** — **11 passed, 0 failed**.

**Secrets hygiene:** `git check-ignore -v .env.local` → `.gitignore:18:.env*.local`. Tracked env files: `.env.example`, `.env.local.example`, `.env.production.example` only (no live secrets).

### Playwright E2E (2026-07-09)

Command: `npm run test:e2e -- --project=chromium` with CI mock env from [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) (`USE_MOCKS=true`, placeholder Supabase/Stripe keys, `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000`). Run from repo root after `npx playwright install chromium`.

| Result             | Evidence                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FAIL** (partial) | exit **1** — **26 passed**, **3 failed** — `auth-flow.spec.ts` (invalid credentials, duplicate email, reset-password success UI); `fetch failed` / `ENOTFOUND placeholder.supabase.co` on webServer |

## Phase 3 + PR #136 review + Phase 4 gate (agent-run, 2026-07-09)

**Supabase project:** `mangu-publishers` / `tkzvikozrcynhwsqtkqp`

| Sub-stage                                                                                   | Result                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[PASS] 3 / 0.3.c` Î“Ã‡Ã¶ public base table count                                           | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'` Î“Ã¥Ã† **36** (exact match). No migration bundle needed. Did not re-run `verify-rls` (known false positive on orders/reading_progress).                                                                                                                                                                  |
| `[REVIEW] PR #136` Î“Ã‡Ã¶ `fix(ci): resolve deploy, bug-to-issue, and Cloud Build failures` | **Partial accept.** Safe: pin `@actions/core@1.11.1` in `bug-to-issue.yml`; gate optional Vercel deploy on `vars.VERCEL_PROJECT_ID` + `continue-on-error`. **Reject as-is:** `cloudbuild.yaml` silent placeholder/`USE_MOCKS` fallbacks Î“Ã‡Ã¶ would bake mock `NEXT_PUBLIC_*` into Docker/Cloud Run if a trigger omits substitutions. Superseded by fail-closed check + `./scripts/gcloud-build-submit.sh` path. |
| `[BLOCKED] 4.1` Î“Ã‡Ã¶ GCP auth                                                             | Cloud agent has **no** `gcloud` credentials. Phase 4 requires interactive `gcloud auth login` as **`renee@mangu-publishers.com`** (not `books@`) on project `delta-wonder-488420-i3`.                                                                                                                                                                                                                             |
| `[OBS]` Î“Ã‡Ã¶ Current public surface                                                       | `www.mangu-publishers.com` responds via **Vercel** (`server: Vercel`). `/api/live` fresh (2026-07-09). `/api/health?ready=1` Î“Ã¥Ã† `degraded` / Stripe **warn** ("Stripe not configured"). Apex `mangu-publishers.com` TLS SAN mismatch from this environment; redirects to `www`. Canonical target remains **Cloud Run** per `docs/CANONICAL_PRODUCTION.md`.                                                    |
| `[HOLD]` Î“Ã‡Ã¶ Dependabot #125Î“Ã‡Ã´#134                                                   | Hold until after launch (preserves validated dependency state).                                                                                                                                                                                                                                                                                                                                                   |

**Code landed this run (branch `cursor/phase4-pr136-review-7a40`):**

- Take PR #136 safe CI workflow fixes (`bug-to-issue.yml`, `ci.yml`).
- Harden `cloudbuild.yaml` `next-build` to **fail closed** if `_NEXT_PUBLIC_*` substitutions are empty/placeholder (no silent mocks).
- Grant script: add Upstash secrets to optional accessor list (Phase 4.3 historical failure).
- `e2e.yml`: add CI mock env so Playwright webServer can boot (fixes PR #136 Playwright red).

**Operator next (Phase 4 Î“Ã‡Ã¶ Copilot Pro / local machine with `renee@`):**

```bash
gcloud auth login   # must be renee@mangu-publishers.com
gcloud config set project delta-wonder-488420-i3
# ensure .env.local has real secrets (not Phase 2 placeholders)
./scripts/sync-gcp-secrets-from-env.sh
./scripts/grant-cloudrun-secret-access.sh
gcloud secrets list
# verify accessor on upstash-redis-rest-url + upstash-redis-rest-token
./scripts/gcloud-build-submit.sh
./scripts/verify-gcp-production.sh
curl -sS https://www.mangu-publishers.com/api/live
curl -sS "https://www.mangu-publishers.com/api/health?ready=1"
# record KNOWN_GOOD_REVISION from:
gcloud run services describe mangu-publishers --region us-central1 --format='value(status.latestReadyRevisionName)'
```

Do **not** merge PR #136Î“Ã‡Ã–s `cloudbuild.yaml` placeholder fallbacks. Prefer this branch (or cherry-pick its safe workflow hunks only).

## Phase 2 Î“Ã‡Ã¶ Local Validation Gate (agent-run, 2026-07-09)

**Environment:** Node v20.20.2, npm v10.8.2, Next.js 14.2.35, sandbox (GCP Cloud Run target)

| Sub-stage                                                                                                                                                                                                                                                                                                                                                                                                                             | Result                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[PASS] 2.0.a` Î“Ã‡Ã¶ Node version                                                                                                                                                                                                                                                                                                                                                                                                    | v20.20.2 satisfies `.nvmrc` / `engines >= 20`.                                                                                                                                                                                                            |
| `[PASS] 2.0.b` Î“Ã‡Ã¶ npm ci clean install from package-lock.json; Node v20.20.2.                                                                                                                                                                                                                                                                                                                                                     | No lockfile drift; 1021 packages installed; 17 audit vulns all in `next@14.2.35` chain, deferred (same as previous run).                                                                                                                                  |
| `[PASS] 2.0.c` Î“Ã‡Ã¶ Stale `.next` cache removed (`rm -rf .next`).                                                                                                                                                                                                                                                                                                                                                                   |                                                                                                                                                                                                                                                           |
| `[PASS] 2.0.d` Î“Ã‡Ã¶ `.env.local` created from `.env.local.example` shape; confirmed git-ignored (`git check-ignore -v .env.local`). Placeholder values: real Supabase project URL, dummy JWT-shaped anon + service-role keys, `pk_test_`/`sk_test_` dummy Stripe keys, `STRIPE_WEBHOOK_SECRET` blank (Phase 5), `NEXT_PUBLIC_SITE_URL=https://mangu-publishers.com`, Upstash dummy URL + token. Real secrets remain operator-local. |                                                                                                                                                                                                                                                           |
| `[PASS] 2.0.e` Î“Ã‡Ã¶ `npm run validate-env` exited 0 (placeholder-shaped env; real secrets remain operator-local).                                                                                                                                                                                                                                                                                                                   | One expected warning: "Stripe webhook secret missing" because Stripe keys are present but `STRIPE_WEBHOOK_SECRET` is blank per Phase 5 checklist. No errors; validator correctly marks Stripe webhook as optional/warning-only.                           |
| `[PASS] 2.1.a` Î“Ã‡Ã¶ type-check passed.                                                                                                                                                                                                                                                                                                                                                                                              | `tsc --noEmit` exited 0, zero errors.                                                                                                                                                                                                                     |
| `[PASS] 2.1.b` Î“Ã‡Ã¶ lint passed.                                                                                                                                                                                                                                                                                                                                                                                                    | `next lint` Î“Ã‡Ã¶ no ESLint warnings or errors.                                                                                                                                                                                                          |
| `[PASS] 2.1.c` Î“Ã‡Ã¶ unit tests passed (6 suites, 25 tests).                                                                                                                                                                                                                                                                                                                                                                         | All 25 tests pass across 6 suites. Two expected console.warn lines from `lib/rate-limit.ts` (Redis not set in test env Î“Ã‡Ã¶ benign).                                                                                                                    |
| `[PASS] 2.1.d` Î“Ã‡Ã¶ next build succeeded.                                                                                                                                                                                                                                                                                                                                                                                           | 53 pages generated (static + dynamic); `next build` exited 0. Two webpack Edge Runtime warnings for `@supabase/ssr` and `@upstash/redis` (pre-existing, known, not blocking). Secret audit: no `sk_test_`/`sk_live_`/`whsec_` patterns in `.next` output. |
| `[PASS] 2.1.e` Î“Ã‡Ã¶ `bash scripts/launch-readiness.sh` passed.                                                                                                                                                                                                                                                                                                                                                                      | npm ci Î“Ã¥Ã† type-check Î“Ã¥Ã† lint Î“Ã¥Ã† 25/25 unit tests Î“Ã¥Ã† 15 migration files Î“Ã¥Ã† build Î“Ã¥Ã† lockfile @upstash check Î“Ã¥Ã† secret audit Î“Ã‡Ã¶ all PASS. No gcloud gates in this script; no SKIPPED items required.                        |

**Fixes applied this run:** None required. All sub-stages passed on first attempt.

**Notes:**

- `STRIPE_WEBHOOK_SECRET` left blank intentionally Î“Ã‡Ã¶ Phase 5 populates this per checklist.
- `npm audit` 17 vulnerabilities (10 high) in `next@14.2.35` chain Î“Ã‡Ã¶ same as 2026-07-08 entry; fix requires Next 16 (breaking), deferred to engineering.
- `verify-rls` not run per task constraints (Phase 3, known false positive flagged in checklist).
- No gcloud/Supabase/Stripe network operations attempted per task constraints (Phases 3Î“Ã‡Ã´5).

## Automated (agent-run, 2026-07-08)

| Check                        | Command / URL                                                     | Result                                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch readiness gate        | `bash scripts/launch-readiness.sh`                                | PASS (npm ci, type-check, lint, 25/25 unit tests, 15 migrations, build, lockfile, secret audit)                                                                                         |
| Type-check                   | `npm run type-check`                                              | PASS (after adding `@types/jest`; was failing on `lib/supabase/queries.test.ts`)                                                                                                        |
| E2E (chromium)               | `npx playwright test --project=chromium`                          | PASS 26/26 runnable, 3 skipped (need real Supabase creds)                                                                                                                               |
| Prod liveness                | `curl https://mangu-publishers.com/api/live`                      | HTTP 200                                                                                                                                                                                |
| Prod readiness               | `curl "https://mangu-publishers.com/api/health?ready=1"`          | HTTP 200 `healthy` Î“Ã‡Ã¶ env, database, auth, migrations, stripe all `pass`                                                                                                            |
| Prod RBAC                    | `curl -I https://mangu-publishers.com/admin/dashboard`            | 307 Î“Ã¥Ã† `/login` (unauthenticated blocked)                                                                                                                                           |
| Prod webhook guard           | `POST /api/webhook` without signature                             | HTTP 400 `Missing signature` (correct rejection)                                                                                                                                        |
| Prod routes                  | `/`, `/books`, `/comics`, `/papers`, `/login`, `/register`        | All HTTP 200                                                                                                                                                                            |
| Prod env bake                | scan served JS for `localhost:3000`                               | Clean Î“Ã‡Ã¶ `NEXT_PUBLIC_SITE_URL` baked correctly                                                                                                                                     |
| Secret scan                  | ripgrep for `sk_live_`, `sk_test_`, `whsec_`, JWTs, `re_`, `AIza` | Clean Î“Ã‡Ã¶ zero secrets in repo                                                                                                                                                       |
| npm audit                    | `npm audit --audit-level=high`                                    | 17 vulns (10 high) Î“Ã‡Ã¶ all in `next@14.2.35` chain; fix requires Next 16 (breaking). Deferred to engineering.                                                                        |
| GitHub Actions               | `gh run list`                                                     | **BLOCKED: account locked due to billing issue** Î“Ã‡Ã¶ no jobs start. Workflow-file bug (`secrets.*` in job `if:`) fixed on this branch; runs will stay red until billing is resolved. |
| Prod RLS: profiles (anon)    | PostgREST query with public anon key                              | PASS Î“Ã‡Ã¶ `[]`, no rows leak                                                                                                                                                          |
| Prod RLS: draft books (anon) | PostgREST query with public anon key                              | PASS Î“Ã‡Ã¶ `[]`, drafts hidden                                                                                                                                                         |
| Prod RLS: orders (anon)      | PostgREST query with public anon key                              | PASS Î“Ã‡Ã¶ `[]`, orders hidden                                                                                                                                                         |
| Prod migrations              | table probes (missing table returns PGRST205; these return `[]`)  | Applied Î“Ã‡Ã¶ `profiles`, `books`, `orders` exist; matches `migrations: pass` from `/api/health?ready=1`                                                                               |
| Prod catalog                 | published books (anon)                                            | `[]` Î“Ã‡Ã¶ catalog empty; seed data pending (matches QA item 7 note)                                                                                                                   |

### Fixes landed this run (branch `cursor/launch-readiness-fixes-6de2`)

- `secrets.*` removed from job-level `if:` in `ci.yml` / `deploy.yml` (invalidated both workflows Î“Ã‡Ã¶ every run failed in 0s)
- `/books`, `/comics`, `/papers` crash fixed: cookie-based Supabase client was used inside `unstable_cache` (`getBooksPage`, `getAuthorSummary`) Î“Ã‡Ã¶ now uses admin client with explicit `visibility='public'` filter
- `/admin/books/new` route created (was a linked 404; known issue in error table) with admin-only `createBookAdmin` action
- `updateBookAdmin` role check fixed (`profiles.user_id`, not `profiles.id` Î“Ã‡Ã¶ admins were rejected)
- E2E selector bugs fixed (strict-mode violations, `/api/health` startup-probe status)
- `@types/jest` added so `tsc --noEmit` passes

## Automated (agent-run)

### 2026-07-11 Î“Ã‡Ã¶ Phase 12 fix sprint (C1Î“Ã‡Ã´C10)

All ten near-term fixes from the master checklist are done (code + docs). Evidence:

| Check            | Command                                                                     | Result                                                                                                        |
| ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Type-check       | `npm run type-check`                                                        | PASS (2026-07-11)                                                                                             |
| Lint             | `npm run lint`                                                              | PASS Î“Ã‡Ã¶ no warnings or errors (2026-07-11)                                                                |
| Unit tests       | `npm test`                                                                  | PASS 42/42, 7 suites (2026-07-11; baseline was 25/6 Î“Ã‡Ã¶ added fail-closed rate-limit + growth-rate suites) |
| Production build | CI-style env (`USE_MOCKS=true` + placeholder Supabase vars) `npm run build` | PASS Î“Ã‡Ã¶ 54/54 pages (2026-07-11)                                                                          |

Changes: C8 unified fail-closed rate limiter (`lib/rate-limit.ts`; legacy `lib/utils/rate-limit.ts` + `lib/middleware/rate-limit.ts` deleted); C2 `/authors` index page; C5 duplicate ErrorBoundary removed; C6 growth rate (null-safe previous-period compare); C7 SHA-256 upload dedup; C9 strict env validation (Stripe/Upstash required unless mocks); C10 `vercel-deploy.yml` retired (Vercel also removed from ci.yml by PR #144); C1 verified; C3/C4 migration docs corrected (15-file order). Note: no `.env.local` exists on this machine Î“Ã‡Ã¶ build gate used the same env shape as `ci.yml`.

| Check                      | Command / URL                                           | Result                                                           |
| -------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| Type-check                 | `npm run type-check`                                    | PASS (2026-05-31)                                                |
| Lint                       | `npm run lint`                                          | PASS (2026-05-31)                                                |
| Unit tests                 | `npm test`                                              | PASS 12/12 (2026-05-31)                                          |
| Env validation             | `npm run validate-env`                                  | PASS (2026-05-31)                                                |
| Production build           | `USE_MOCKS=true npm run build`                          | PASS (2026-05-19)                                                |
| Local health               | `curl localhost:3000/api/health`                        | PASS (mock mode, 2026-05-19)                                     |
| GitHub Actions secrets     | `gh secret list`                                        | 5 secrets configured                                             |
| PR #73 merge               | `gh pr merge 73`                                        | Merged to `main`                                                 |
| Homepage assets push       | commit `ff23d55`                                        | Pushed to `origin/main` (2026-05-31)                             |
| Prod smoke `/`             | `curl https://mangu-publishers.com/`                    | HTTP 200 (old deploy still live, 2026-05-31)                     |
| Prod smoke `/api/health`   | `curl https://mangu-publishers.com/api/health`          | HTTP 200 `{"status":"ok",...}` (2026-05-31)                      |
| Prod smoke static homepage | `curl https://mangu-publishers.com/homepage/v_a_1.html` | HTTP 404 until Cloud Run redeploy (2026-05-31)                   |
| Cloud Build deploy         | `./scripts/gcloud-build-submit.sh`                      | **BLOCKED:** `gcloud auth login` required (token refresh failed) |

## Manual (operator Î“Ã‡Ã¶ browser)

| #   | Test                               | Pass   | Date | Notes                                      |
| --- | ---------------------------------- | ------ | ---- | ------------------------------------------ |
| 1   | Register at `/register`            | Î“Ã¿Ã‰ |      |                                            |
| 2   | Profile row in Supabase `profiles` | Î“Ã¿Ã‰ |      |                                            |
| 3   | Login / logout                     | Î“Ã¿Ã‰ |      |                                            |
| 4   | Password reset                     | Î“Ã¿Ã‰ |      |                                            |
| 5   | Non-admin blocked from `/admin`    | Î“Ã¿Ã‰ |      |                                            |
| 6   | Admin `/admin/health`              | Î“Ã¿Ã‰ |      |                                            |
| 7   | Browse `/books`                    | Î“Ã¿Ã‰ |      | Requires migrations + seed                 |
| 8   | Stripe test checkout `4242Î“Ã‡Âª`  | Î“Ã¿Ã‰ |      | [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md) |
| 9   | Stripe webhook event received      | Î“Ã¿Ã‰ |      | Dashboard Î“Ã¥Ã† Webhooks                  |
| 10  | New static homepage loads at `/`   | Î“Ã¿Ã‰ |      | After Cloud Run redeploy with `ff23d55`    |

## Infrastructure (operator Î“Ã‡Ã¶ cloud)

| Item                | Script / action                                                  | Status                                                        |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| GCP secrets         | `./scripts/sync-gcp-secrets-from-env.sh`                         | **Blocked:** run `gcloud auth login` locally, then re-run     |
| GCP deploy          | `./scripts/gcloud-build-submit.sh`                               | **Blocked:** same Î“Ã‡Ã¶ auth token refresh failed 2026-05-31 |
| GCP smoke           | `./scripts/verify-gcp-production.sh`                             | Partial: domain live; redeploy needed for new homepage        |
| Supabase migrations | `./scripts/bundle-migrations.sh` Î“Ã¥Ã† SQL Editor               | Operator-dependent                                            |
| Canonical prod      | `docs/CANONICAL_PRODUCTION.md`                                   | **Done** Î“Ã‡Ã¶ Cloud Run; issue #70 closed                   |
| Stripe prod webhook | `https://mangu-publishers.com/api/webhook` Î“Ã¥Ã† Secret Manager | See [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md)                |

## Phase 2 intake

| Artifact               | Status                                             |
| ---------------------- | -------------------------------------------------- |
| `environment.local.sh` | Created with `PROJECT_ID`; fill domain/slugs/RACI  |
| `FIELDS_TO_GATHER.md`  | Template Î“Ã‡Ã¶ operator to complete               |
| `12-ownership-raci.md` | Worksheet placeholders remain until names provided |

## Redeploy checklist (operator Î“Ã‡Ã¶ run after `gcloud auth login`)

```bash
gcloud auth login
gcloud config set project delta-wonder-488420-i3
./scripts/gcloud-build-submit.sh
./scripts/verify-gcp-production.sh
curl -I https://mangu-publishers.com/
curl -I https://mangu-publishers.com/homepage/v_a_1.html
curl -sS https://mangu-publishers.com/api/health | head -c 500
```

Expected after redeploy: `/` redirects or serves new homepage; `/homepage/v_a_1.html` returns HTTP 200.
