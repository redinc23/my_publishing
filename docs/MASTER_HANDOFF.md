# MASTER HANDOFF — The Everything Doc

> One document to rule them all. Features, upgrades, deployment, operations, checklists,
> env vars, scripts, database, CI/CD, known issues, roadmap — for **Mangu Publishers**
> (this repo) plus the **NEXUS go-live checklist** (Cloudflare + Vercel + Railway).
>
> Paste this to any operator, agent, or teammate and they should be able to take over.

---

## Table of Contents

- [Part 1 — Mangu Publishers: What This Is](#part-1--mangu-publishers-what-this-is)
- [Part 2 — Complete Feature Inventory](#part-2--complete-feature-inventory)
- [Part 3 — What Works Today vs. What Needs Setup](#part-3--what-works-today-vs-what-needs-setup)
- [Part 4 — Environment Variables (All of Them)](#part-4--environment-variables-all-of-them)
- [Part 5 — Database: Migrations, Buckets, RLS, Seed](#part-5--database-migrations-buckets-rls-seed)
- [Part 6 — Scripts Reference (npm + shell)](#part-6--scripts-reference-npm--shell)
- [Part 7 — CI/CD & Deployment Targets](#part-7--cicd--deployment-targets)
- [Part 8 — Security & Middleware](#part-8--security--middleware)
- [Part 9 — One-Time Operator Bootstrap (Go-Live)](#part-9--one-time-operator-bootstrap-go-live)
- [Part 10 — Site Management Workflow (3 Loops)](#part-10--site-management-workflow-3-loops)
- [Part 11 — Production Smoke Tests / QA Checklist](#part-11--production-smoke-tests--qa-checklist)
- [Part 12 — Known Issues, Gaps & Gotchas](#part-12--known-issues-gaps--gotchas)
- [Part 13 — Upgrades & Roadmap (Phase 2 and Beyond)](#part-13--upgrades--roadmap-phase-2-and-beyond)
- [Part 14 — Values to Collect (Copy/Paste Block)](#part-14--values-to-collect-copypaste-block)
- [Part 15 — Documentation Map](#part-15--documentation-map)
- [Part 16 — NEXUS Go-Live Checklist (Domain + Cloudflare + Vercel + Railway)](#part-16--nexus-go-live-checklist-domain--cloudflare--vercel--railway)
- [Part 17 — NEXUS Analyzer Toolkit (in this repo)](#part-17--nexus-analyzer-toolkit-in-this-repo)
- [Part 18 — Definition of Done](#part-18--definition-of-done)

---

## Part 1 — Mangu Publishers: What This Is

| Item | Value |
|------|-------|
| Product | Digital publishing marketplace: books, comics, papers, audiobooks; author/partner/admin portals |
| Repo | `redinc23/my_publishing` |
| Production branch | `main` |
| Stack | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Supabase (Postgres + Auth + Storage) · Stripe · Upstash Redis · OpenAI (opt) · Resend (opt) |
| Canonical production | **GCP Cloud Run** via `cloudbuild.yaml` (see `docs/CANONICAL_PRODUCTION.md`) |
| Alternate deploy targets | Vercel (`vercel.json`), AWS Amplify (`amplify.yml`) — legacy/secondary |
| GCP project | `delta-wonder-488420-i3` |
| Cloud Run service | `mangu-publishers` (region `us-central1`) |
| Supabase project ref | `tkzvikozrcynhwsqtkqp` |
| Production domain | `https://mangu-publishers.com` |
| Health endpoints | `/api/live` (liveness), `/api/health?ready=1` (full readiness) |
| Stripe webhook URL | `https://mangu-publishers.com/api/webhook` |

**The three layers of "fully functional":**

1. **Layer 1 — Code** (mostly done): app, auth, catalog, Stripe, admin UI, 15 migrations, security hardening.
2. **Layer 2 — Operator setup** (required before real users): real Supabase + Stripe + GCP secrets, migrations applied, seed/admin data, webhook wired.
3. **Layer 3 — Launch polish**: CI fixes, QA pass, monitoring, backups.

---

## Part 2 — Complete Feature Inventory

### 2.1 Public / consumer pages (`app/(consumer)/`)

| Route | Status | What it does |
|-------|--------|--------------|
| `/` | Live | Landing: hero, stats, features, CTA |
| `/books` | Live | Book catalog — search, filter, sort, pagination |
| `/books/[slug]` | Live | Book detail: cover, Vimeo trailer, audio player, tabs, similar books, purchase CTA |
| `/comics` + `/comics/[slug]` | Live | Comic catalog + detail (`content_type=comic`) |
| `/papers` + `/papers/[slug]` | Live | Papers catalog + detail (`content_type=paper`) |
| `/genres` + `/genres/[genre]` | Live | Genre listing with counts; books by genre |
| `/authors/[id]` | Live | Author profile + published books (**no `/authors` index page — see Part 12**) |
| `/audio` + `/audio/[id]` | Live | Audiobooks (books with `audio_url`) |
| `/discover` | Live | Hub → recommendations & book clubs |
| `/discover/recommendations` | Partial | "Recommended for You" — trending fallback until `OPENAI_API_KEY` set |
| `/discover/book-clubs` | Placeholder | "Coming soon" |
| `/readers-hub` | Placeholder | Library/history/wishlist cards |
| `/library` | Live (auth) | User's purchased books, from orders |
| `/reading/[bookId]` | Live (auth) | In-browser reader with reading progress |
| `/about`, `/contact` | Live | Static pages |

### 2.2 Auth (`app/(auth)/`)

| Route | What it does |
|-------|--------------|
| `/login` | Email/password login (server actions) |
| `/register` | Registration; profile auto-created via DB trigger |
| `/reset-password` + `/reset-password/confirm` | Password reset request + confirm |
| `/verify-email` | Email verification + resend |
| `/callback` | OAuth / magic-link code exchange |

### 2.3 Commerce

| Route/Endpoint | What it does |
|----------------|--------------|
| `/checkout` | Pre-checkout summary → Stripe Checkout session |
| `POST /api/checkout` | Creates Stripe Checkout session for a book |
| `POST /api/webhook` | Stripe webhook: signature verify, idempotency (`webhook_events` table), order fulfillment |

### 2.4 Author portal (`app/(portals)/author/` — roles `author`/`admin`)

| Route | Status |
|-------|--------|
| `/author/dashboard` | Live — stats, manuscripts, books overview |
| `/author/submit` | Live — manuscript submission + file upload |
| `/author/projects` + `/author/projects/[id]` | Live — manuscript list + detail |
| `/author/analytics` | Placeholder |

### 2.5 Partner portal (`app/(portals)/partner/` — roles `partner`/`admin`)

All currently placeholders / stubs: `/partner/dashboard`, `/partner/orders`, `/partner/orders/[id]`, `/partner/catalogs`, `/partner/arc-requests` (ARC program).

### 2.6 Admin dashboard (`app/admin/` — role `admin`)

| Route | Status |
|-------|--------|
| `/admin/dashboard` | Live — user/book/order counts, recent engagement |
| `/admin/books` + `/admin/books/[id]/edit` | Live — book management + edit |
| `/admin/books/new` | **Missing** — linked from admin books page but route doesn't exist (404) |
| `/admin/manuscripts` | Live — manuscript review |
| `/admin/users` | Live — user/profile management |
| `/admin/orders` | Live — order management |
| `/admin/health` | Live — UI over `/api/health?ready=1` |

### 2.7 User dashboard & social

| Route | What it does |
|-------|--------------|
| `/dashboard/my-reviews` | User's reviews (CRUD via server actions) |
| `/dashboard/books/[id]/analytics` | Per-book analytics (Chart.js/Recharts) |
| `/users/[userId]/reviews` | Public review listing |

### 2.8 API surface (`app/api/`)

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/health` | GET | Startup probe; `?ready=1` = full readiness (env, DB, auth, migrations, Stripe) |
| `/api/live` | GET | Cloud Run liveness (process-only) |
| `/api/checkout` | POST | Stripe Checkout session |
| `/api/webhook` | POST, GET | Stripe webhooks + fulfillment |
| `/api/upload` | POST | Upload to Supabase `manuscripts` bucket (50 MB max) |
| `/api/session` | GET | Current user + profile JSON |
| `/api/analytics/track` | POST, GET, OPTIONS | Validated analytics event ingestion + rate limiting |
| `/api/analytics/stream` | GET | SSE real-time analytics for a book |
| `/api/resonance/recommend` | POST, GET, OPTIONS | AI recommendations (OpenAI + pgvector when configured) |
| `/api/resonance/similar` | GET | Similar books (genre-based fallback today) |
| `/api/resonance/embed` | POST | Generate/store book embeddings (`resonance_vectors`) |
| `/api/resonance/track` | POST | Engagement events (`engagement_events`) |

### 2.9 Server actions (`lib/actions/`)

`books.ts` (CRUD + cache revalidation) · `upload.ts` · `users.ts` · `reviews.ts` · `revenue.ts` · `payouts.ts` (author payouts) · `reading-list.ts` · `follows.ts` · `analytics.ts` · `ai-insights.ts` · `export-data.ts`

### 2.10 SEO & metadata

- `app/sitemap.ts` — dynamic sitemap from published books
- `app/robots.ts` — disallows `/admin/`, `/api/`, `/dashboard/`

### 2.11 Key UI components (`components/`)

- **Layout:** Header, Footer, Navigation, MobileNav, AuthGuard
- **Books:** BookCard, ReviewSection, ReviewForm, BookUploadForm, StarRating
- **Analytics:** AnalyticsDashboard, ViewsChart, LiveReaders, GeographyMap, AIInsightsPanel
- **Social:** ActivityFeed, ReadingList
- **Media:** AudioPlayer, VimeoPlayer, VideoHero
- **UI kit:** full Radix/shadcn primitives under `components/ui/`
- **Static homepage prototype:** `public/homepage/v_a_1.html` + `enhancements.js/css` (see `docs/HOMEPAGE_STRATEGY.md`)

---

## Part 3 — What Works Today vs. What Needs Setup

### Works today (no operator action)

| Capability | Status |
|------------|--------|
| Site loads at mangu-publishers.com | Yes |
| Static/marketing pages | Yes |
| UI shell (nav, mobile drawer, homepage sections) | Yes |
| Security headers, CSP, middleware | Yes |
| Mock mode (`USE_MOCKS=true` — dev without real DB) | Yes |

### Needs real credentials + setup before users can use it

| Capability | What's required |
|------------|-----------------|
| Sign up / login | Real Supabase URL + keys; email config in Supabase dashboard |
| Browse real books | Migrations applied + seed data or admin-created books |
| Buy a book | Stripe keys + webhook → `https://mangu-publishers.com/api/webhook` |
| Read purchased content | Supabase storage buckets + RLS (from migrations) |
| Author submit manuscript | Storage policies + `author` role |
| Admin dashboard | Admin user in DB + RBAC |
| Distributed rate limiting | Upstash Redis (without it auth limits are weaker; see `finding-1/`) |
| AI recommendations | `OPENAI_API_KEY` (Phase 2, ~10–15 min) |
| Email notifications | `RESEND_API_KEY` (Phase 2, ~10–15 min) |

### What each blocker-fix gives you (and doesn't)

| Action | Gets you… | Does NOT get you… |
|--------|-----------|-------------------|
| Merge debug-cleanup PR | Clean health endpoint, no debug leaks on probes | Users, books, payments |
| Fix `ci.yml` / `deploy.yml` | Reliable auto-test + auto-deploy on push | Content in the database |
| GCP redeploy | Latest code live on Cloud Run | Working Stripe/Supabase until secrets set |
| Migrations + seed | Real catalog, profiles, purchases tables | Marketing traffic or SEO |
| Manual QA | Confidence it works | Ongoing monitoring by itself |

---

## Part 4 — Environment Variables (All of Them)

Authoritative template: `.env.local.example`. Validate with `npm run validate-env`.

### Phase 1 — required for launch

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin/service role (webhooks, migrations, seeds) — **never expose client-side** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_test_` / `pk_live_`) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_…`) |
| `NEXT_PUBLIC_SITE_URL` | App base URL (no trailing slash) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL — **required in production** for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |

### Phase 2 — optional add-ons

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Resonance Engine embeddings + AI recommendations |
| `RESEND_API_KEY` | Transactional email |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (server/client) |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sentry source-map uploads in CI |
| `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` | Vercel Analytics |

### Dev / CI toggles

| Variable | Purpose |
|----------|---------|
| `USE_MOCKS` | Bypass external services (`true` in CI) |
| `SKIP_EMAILS` | Skip email sending in dev |
| `NODE_ENV` | `development` / `production` / `test` |

### Infra identifiers (non-secret, `docs/phase2/_intake/environment.example.sh`)

`PROJECT_ID`, `REGION`, `SERVICE_NAME`, `AR_REPO`, `CUSTOM_DOMAIN`, `BILLING_ACCOUNT_ID`, `PORT`, `RELEASE_SHA`, `KNOWN_GOOD_REVISION`

---

## Part 5 — Database: Migrations, Buckets, RLS, Seed

### 5.1 Migrations (`supabase/migrations/` — apply in filename order)

| # | File | What it does |
|---|------|--------------|
| 1 | `20260116000000_initial_schema.sql` | Core schema: `profiles`, `authors`, `books`, `book_content`, `reading_sessions`, `reading_progress`, `resonance_vectors`, `engagement_events`, `manuscripts`, `partners`, `arc_requests`, `orders`, `order_items`, `subscriptions`, `notifications`; pgvector/pg_trgm/unaccent; RLS everywhere |
| 2 | `20260117000000_analytics_events.sql` | Partitioned `analytics_events` (2025–2027 + default) |
| 3 | `20260117000001_analytics_sessions.sql` | Aggregated session tracking |
| 4 | `20260117000002_book_stats_materialized.sql` | `book_stats_daily` + materialized view refresh |
| 5 | `20260117000003_revenue_tracking.sql` | `book_sales` with Stripe fields |
| 6 | `20260117000004_author_payouts.sql` | `author_payouts`, `payout_items` |
| 7 | `20260117000005_book_pricing.sql` | Regional prices, discounts, pay-what-you-want |
| 8 | `20260117000006_storage_policies.sql` | Storage buckets + policies + virus-scan placeholder trigger |
| 9 | `20260118000000_critical_fixes.sql` | Visibility/role/RLS fixes, `webhook_events`, `export_jobs`, `audit_logs` |
| 10 | `20260120000006_performance_optimizations.sql` | Composite indexes, full-text search, triggers |
| 11 | `20260121000000_profile_trigger.sql` | Auto-create profile on `auth.users` insert |
| 12 | `20260122000000_social_features.sql` | `reviews`, `review_votes`, `comments`, `user_follows`, `reading_lists`, `user_activities` |
| 13 | `20260619124500_add_content_type_to_books.sql` | `content_type` column (books/comics/papers) |
| 14 | `20260619162409_add_content_type.sql` | ⚠️ Duplicate/overlapping `content_type` migration |
| 15 | `20260619170000_add_retailer_urls.sql` | External retailer URLs (Amazon, Kindle, Audible, …) |

Apply methods: `npm run db:migrate`, `./scripts/bundle-migrations.sh` → Supabase SQL Editor, or `scripts/apply-supabase-migrations.sh` (`supabase db push`). See `docs/MIGRATIONS.md`.

### 5.2 Storage buckets

| Bucket | Public | Limit | Types |
|--------|--------|-------|-------|
| `book-covers` | Yes | 5 MB | JPEG, PNG, WebP, GIF |
| `manuscripts` | No | 100 MB | PDF, DOC, DOCX, TXT |
| `published-epubs` | Yes | 50 MB | EPUB |

### 5.3 RLS & roles

- RLS enabled on all major tables; verify with `npm run verify-rls`
- Roles: `reader`, `author`, `partner`, `admin` (in `profiles.role`; enforced in `middleware.ts` + `lib/middleware/auth.ts`)

### 5.4 Seed

```bash
npm run db:seed -- --create-profiles --minimal   # flags: --minimal, --skip-embeddings, --create-profiles
```

---

## Part 6 — Scripts Reference (npm + shell)

### npm scripts

| Script | Command / purpose |
|--------|-------------------|
| `npm run dev` | validate-env + `next dev` |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `type-check` / `test` / `test:e2e` | Quality gates (ESLint, tsc, Jest, Playwright) |
| `npm run validate-env` | Env var validation |
| `npm run db:seed` / `db:migrate` / `verify-rls` | Database ops |
| `npm run analyze` | Bundle analyzer build |

### `scripts/` directory

| Script | Purpose |
|--------|---------|
| `launch-readiness.sh` | **Local launch gate**: type-check + lint + test + build |
| `bootstrap-operator-access.sh` | End-to-end operator bootstrap (CLI auth, env, GCP, Stripe) |
| `bundle-migrations.sh` | Concatenate migrations for Supabase SQL Editor |
| `apply-supabase-migrations.sh` | `supabase db push` to linked prod project |
| `run-migrations.ts` / `seed-database.ts` / `verify-rls.ts` / `validate-env.ts` | tsx entry points behind npm scripts |
| `verify-migrations.sh` | Pre-deploy gate: migration files exist & non-empty |
| `sync-gcp-secrets-from-env.sh` | Push `.env.local` secrets → GCP Secret Manager |
| `grant-cloudrun-secret-access.sh` | Grant Cloud Run SA access to secrets |
| `gcloud-build-submit.sh` | Submit `cloudbuild.yaml` with env from `.env.local` |
| `verify-gcp-production.sh` | Post-deploy smoke: secrets + Cloud Run health |
| `create-stripe-webhook.sh` | Create live Stripe webhook at `/api/webhook` |
| `backup-db.sh` | Supabase CLI database dump |
| `update-supabase-anon-key.sh` | Rotate anon key in `.env.local` |
| `setup-env-interactive.sh` | Interactive `.env.local` wizard |
| `ci-local.sh` | Mirror GitHub Actions CI locally |
| `nexus_analyzer.py` / `nexus-rollout.sh` | NEXUS forensic analyzer (see Part 17) |

### Root shell scripts

| Script | Purpose |
|--------|---------|
| `setup.sh` | Full environment bootstrap (deps, env scan, install, migrations, build) |
| `deploy_master.sh` | Interactive GCP production launch sequence |
| `setup-envs.sh` / `verify-setup.sh` | Multi-repo GitHub environment provisioning via `GH_PAT` + `repos.txt` |
| `cleanup-envs.sh` | Environment cleanup |

---

## Part 7 — CI/CD & Deployment Targets

### GitHub workflows (`.github/workflows/`)

| Workflow | Trigger | Purpose | Health |
|----------|---------|---------|--------|
| `ci.yml` | push main/develop, PR main | type-check, lint, jest, build; optional Vercel deploy | ⚠️ **Broken**: uses `secrets.*` in job-level `if:` (GitHub disallows) — deploy job may silently skip |
| `deploy.yml` | push main, manual | Cloud Run deploy | ⚠️ **Broken**: same secrets-in-`if` anti-pattern; also injects secrets as plain env vars instead of Secret Manager |
| `supabase-migrate.yml` | migration push on main, manual | `supabase db push` | OK (needs `SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN` secrets) |
| `vercel-deploy.yml` | push/PR main | Lint + build (dummy creds) | Passing but no tests; secondary host only |
| `auto-merge.yml` | PR/check events | Auto-merge green PRs labeled `auto-merge` or from AI bots | OK |
| `bug-to-issue.yml` | after CI completes | Files issue after 3 consecutive CI failures | Useless until `ci.yml` is fixed |
| `codeql.yml` | push/PR + weekly cron | CodeQL (JS/TS, Python, Actions) | OK |
| `copilot-setup-steps.yml` | manual | Copilot env setup with mocks | OK |
| `admin-setup.yml` | manual | Multi-repo env setup via `repos.txt` | Needs `GH_PAT` |
| `fix-lockfile.yml` | manual | Regenerate lockfile (`@upstash/ratelimit` pin) | One-time utility |

### Cloud Build (`cloudbuild.yaml`) — the canonical pipeline

16 steps: `npm ci` → lint + type-check → `next build` → **250 kB gzip perf budget** → **secret-audit grep** → Docker build/push → **Trivy CRITICAL CVE scan** → Cloud Run deploy (Secret Manager for `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; optional `RESEND_API_KEY`, `OPENAI_API_KEY`, Upstash) → verify. Probes on `/api/live`.

### Other deploy configs

- `Dockerfile` — multi-stage Node 20 Alpine, standalone output, non-root user, port 3000
- `vercel.json` — minimal Next.js config, region `iad1`
- `amplify.yml` + `AMPLIFY_READY.md` — legacy AWS Amplify path with security headers, no test gate

### Day-to-day deploy flow (target state)

```
code change → PR → CI green → merge main → Cloud Build trigger → Cloud Run (~5–10 min)
```

---

## Part 8 — Security & Middleware

### `middleware.ts`

- **Rate limiting (Upstash):** auth endpoints 5/min, uploads 30/min — fails open if Redis is down
- **Session refresh** via `@supabase/ssr` cookies
- **Auth redirects:** logged-in users bounced away from `/login`, `/register`, `/reset-password`
- **Protected routes:** `/reading`, `/library`, `/author`, `/partner`, `/admin`
- **RBAC:** single `profiles.role` fetch; admin/author/partner gates

### `next.config.js`

- `output: 'standalone'` (Cloud Run)
- CSP covering Stripe + Supabase (REST + WSS)
- HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP
- Server actions body limit 1 MB; image remotes limited to `**.supabase.co`, `picsum.photos`

### Two rate-limiting systems

1. `lib/rate-limit.ts` — Upstash Redis (middleware; graceful degradation)
2. `lib/utils/rate-limit.ts` — in-memory LRU (API routes: analytics, webhooks, resonance)

⚠️ **Finding 1** (`finding-1/FINDING-1-READY.md` + patch in `finding-1-deploy/`): migrate all limiters to Upstash with **fail-closed** semantics. In-memory limits don't work across Cloud Run instances.

### Secrets & safety checklist

- [ ] `JWT_SECRET` / service keys are strong and NOT committed to git
- [ ] `.env` / `.env.local` not pushed (check `.gitignore`)
- [ ] Railway/Vercel/GCP env vars documented privately
- [ ] Demo credentials disabled/rotated for public prod
- [ ] Secret Manager (not plain env vars) used for Cloud Run secrets
- [ ] Cloud Build secret-audit step passing

---

## Part 9 — One-Time Operator Bootstrap (Go-Live)

Run once. Expect ~30–60 minutes with dashboard access.

```bash
# 1. Local credentials
cp .env.local.example .env.local
# Fill: Supabase URL/keys, Stripe keys, site URL

# 2. Validate locally
npm run validate-env
bash scripts/launch-readiness.sh   # full local gate

# 3. Database
./scripts/bundle-migrations.sh > /tmp/mangu-migrations.sql
# Paste into Supabase SQL Editor → Run

npm run db:seed -- --create-profiles --minimal   # optional test data

# 4. GCP production
gcloud auth login
gcloud config set project delta-wonder-488420-i3
./scripts/sync-gcp-secrets-from-env.sh
./scripts/gcloud-build-submit.sh
./scripts/verify-gcp-production.sh

# 5. Stripe webhook (Dashboard or script)
# Endpoint: https://mangu-publishers.com/api/webhook
./scripts/create-stripe-webhook.sh   # or set manually in Stripe Dashboard
# Re-sync STRIPE_WEBHOOK_SECRET → ./scripts/sync-gcp-secrets-from-env.sh

# 6. Admin user
# Register in UI, then in Supabase: UPDATE profiles SET role='admin' WHERE id='<uuid>';

# 7. Smoke test in browser (docs/OPERATOR_QA_LOG.md)
# Register → browse /books → checkout 4242 4242 4242 4242 → confirm webhook in Stripe
```

**Bootstrap checklist:**

- [ ] `.env.local` filled from real dashboards (Supabase, Stripe)
- [ ] `npm run validate-env` passes
- [ ] `scripts/launch-readiness.sh` passes (type-check, lint, test, build)
- [ ] All 15 migrations applied to production Supabase (`tkzvikozrcynhwsqtkqp`)
- [ ] Storage buckets exist (`book-covers`, `manuscripts`, `published-epubs`)
- [ ] `npm run verify-rls` passes against prod
- [ ] Seed data or admin-created books present
- [ ] GCP secrets synced to Secret Manager
- [ ] Cloud Run deployed; `verify-gcp-production.sh` green
- [ ] Stripe webhook created; `whsec_` in Secret Manager; redeployed
- [ ] Admin user created and role set
- [ ] DNS/SSL valid for `mangu-publishers.com`
- [ ] Full QA pass (Part 11)

---

## Part 10 — Site Management Workflow (3 Loops)

### Loop 1 — Deploy (automate "push → live")

| Piece | Exists today | Gap |
|-------|--------------|-----|
| `vercel-deploy.yml` | Passes on main | Secondary host only |
| `cloudbuild.yaml` | Full pipeline (lint, type-check, Trivy, deploy) | Triggered manually via `gcloud builds submit` |
| `deploy.yml` | Present | **Broken** (secrets in `if:`) — needs fix |
| `ci.yml` | Present | **Broken** — needs fix |
| CodeQL | Weekly scan | Good |
| Auto-merge | Works on green PRs | Good |
| Bug-to-issue | Watches CI | Useless until `ci.yml` fixed |

**To automate:**
1. Fix `ci.yml` + `deploy.yml` (replace secret-`if` checks with `vars.*` or a gate step).
2. Wire a **Cloud Build trigger on `main`** (GCP Console → Cloud Build → Triggers) so `gcloud builds submit` is never run by hand.
3. Merge any pending debug-cleanup PR before next prod deploy.

### Loop 2 — Health & incidents (automate "is it up?")

Already in repo: `/api/live`, `/api/health`, `scripts/verify-gcp-production.sh`, `docs/phase2/07-operational-runbook.md`, `docs/ROLLBACK.md`.

**To add (low effort, high value):**

| Automation | Tool | Frequency |
|------------|------|-----------|
| Uptime check on `/api/live` | UptimeRobot / Better Stack / GCP Monitoring | 1–5 min |
| Deep check on `/api/health` | Same tool, second monitor | 15 min |
| Slack/email on failure | Monitor webhook | Immediate |
| Dependency scan | Dependabot (enable in repo settings) + CodeQL | Weekly |

**Weekly operator ritual (~15 min):**

```bash
curl -sS https://mangu-publishers.com/api/health | jq .
./scripts/verify-gcp-production.sh
npm audit --audit-level=high
# Skim Stripe Dashboard → Webhooks (failed events)
# Skim Supabase Dashboard → Database size / errors
```

### Loop 3 — Content & users (editorial/business loop)

| Task | How |
|------|-----|
| Add/edit books | `/admin` → book management |
| Approve manuscripts | `/admin/manuscripts` + author portal |
| Manage users/roles | Supabase dashboard or `/admin/users` |
| Bulk seed / reset dev data | `npm run db:seed` |
| Backups | `scripts/backup-db.sh` (schedule via cron or Cloud Scheduler) |

**Optional automation later:** Supabase webhook → Cloud Build rebuild on content change; scheduled DB backup via Cloud Scheduler; Stripe webhook failure → GitHub issue (like `bug-to-issue.yml`).

### Recommended minimal "site manager" stack

| Concern | Tool | Setup |
|---------|------|-------|
| Deploy | Cloud Build trigger on `main` | One-time in GCP Console |
| CI quality gate | Fixed `ci.yml` | One PR |
| Uptime | UptimeRobot (free) | 2 monitors: `/` and `/api/health` |
| Secrets | Secret Manager + `sync-gcp-secrets-from-env.sh` | Run on key rotation |
| DB migrations | `supabase-migrate.yml` or SQL Editor | On schema changes |
| Security | CodeQL (on) + Dependabot (enable) | Repo settings |
| Incidents | `docs/phase2/07-operational-runbook.md` | Bookmark it |
| Pre-deploy check | `bash scripts/launch-readiness.sh` | Before big releases |

---

## Part 11 — Production Smoke Tests / QA Checklist

### API checks

- [ ] `curl https://mangu-publishers.com/api/live` → OK
- [ ] `curl https://mangu-publishers.com/api/health?ready=1` → healthy (env, DB, auth, migrations, Stripe)

### Web checks

- [ ] Landing page loads
- [ ] Register new account works (+ email verification)
- [ ] Login / logout works
- [ ] Password reset flow works
- [ ] `/books` catalog loads with real data; search/filter/sort work
- [ ] Book detail page loads (cover, tabs, similar books)
- [ ] `/comics`, `/papers`, `/genres`, `/audio` load
- [ ] Checkout with test card `4242 4242 4242 4242` completes
- [ ] Webhook event received in Stripe Dashboard; order recorded
- [ ] Purchased book appears in `/library`; `/reading/[bookId]` works; progress saves
- [ ] Reviews: create/edit/delete from `/dashboard/my-reviews`
- [ ] Author portal: submit manuscript with file upload
- [ ] Admin: dashboard stats, book edit, manuscript review, user management, `/admin/health` green
- [ ] Role gates: reader blocked from `/admin` and `/author`

### Browser console/network

- [ ] No CORS errors in DevTools
- [ ] API calls go to the production domain (not localhost)
- [ ] No CSP violations

### Automated gates

- [ ] `npm test` (Jest unit: queries, rate limits, analytics optimizer, BookCard)
- [ ] `npm run test:e2e` (Playwright: auth flow, purchase flow, smoke)
- [ ] `tests/k6/load-test.js` (optional load test)

Log results in `docs/OPERATOR_QA_LOG.md`.

---

## Part 12 — Known Issues, Gaps & Gotchas

### Broken / needs fixing

| Issue | Where | Fix |
|-------|-------|-----|
| Secrets in job-level `if:` | `ci.yml`, `deploy.yml` | Use `vars.*` or a gate step; GitHub can't evaluate `secrets.*` in job `if` |
| Secrets as plain Cloud Run env vars | `deploy.yml` | Use Secret Manager like `cloudbuild.yaml` does |
| `/admin/books/new` linked but missing | `app/admin/books/page.tsx` | Create the route or remove the link |
| `/authors` index missing | `components/shared/Navigation.tsx` links to it | Create index page or fix nav link |
| Duplicate `content_type` migrations | `20260619124500` + `20260619162409` | Verify idempotent; consolidate |
| README references wrong storage migration filename | `README.md` (`000000` vs `000006`) | Doc fix |
| Duplicate ErrorBoundary | `components/common/` vs `components/shared/` | Deduplicate |
| Growth rate hardcoded to 0 | `components/analytics/AnalyticsOverview.tsx` | Implement calculation |
| File-hash dedup TODO | `lib/actions/upload.ts` | Implement |
| In-memory rate limits don't scale across instances | `lib/utils/rate-limit.ts` | Apply Finding-1 patch (`finding-1-deploy/`) |
| Env validation treats Stripe/Upstash as warnings | `lib/utils/env-validation.ts` vs `.env.local.example` "required" | Align strictness |
| `vercel-deploy.yml` has no tests, dummy creds | Workflow | Add test step or retire |

### Common gotchas (quick fixes)

- **CORS error in browser** → allowed origin missing exact web URL (scheme + host, no trailing slash)
- **Web still calls localhost API** → `NEXT_PUBLIC_SITE_URL`/API URL wrong or web not redeployed (NEXT_PUBLIC_ vars bake in at build time!)
- **DB resets on redeploy** (Railway/SQLite setups) → volume not mounted at `/data`
- **API custom-domain SSL issue behind Cloudflare** → set the API DNS record to **DNS only** (grey cloud)
- **Vercel build fails in monorepo** → Root Directory must point to the app folder, not repo root
- **Stripe webhook 400s** → `STRIPE_WEBHOOK_SECRET` stale after re-creating endpoint; re-sync + redeploy
- **404 on app routes after deploy** → confirm correct framework/root and standalone output

### Blockers status (`blockers/`)

7/7 P0 resolved · 6/6 P1 resolved · ~96% launch readiness. Remaining items are **operator tasks** (real secrets, prod migrations, Stripe webhook, DNS) — see Part 9.

---

## Part 13 — Upgrades & Roadmap (Phase 2 and Beyond)

### Feature upgrades — status & requirements

| Upgrade | Current status | Needs |
|---------|----------------|-------|
| AI recommendations (Resonance Engine) | API routes exist; UI uses trending fallback | `OPENAI_API_KEY` + run `/api/resonance/embed` for catalog |
| Transactional email (Resend) | Templates + lazy client ready | `RESEND_API_KEY` |
| Distributed rate limiting, fail-closed | Patch ready in `finding-1-deploy/` | Upstash creds + apply patch |
| Sentry observability | Env vars defined; not wired | DSN vars + init code |
| Partner portal (orders, catalogs, ARC requests) | Placeholders | Build out |
| Book clubs | Placeholder page | Build out |
| Readers hub (history/wishlist) | Placeholder | Build out |
| Author analytics page | Placeholder | Build out |
| Audiobooks | Listing works | Storage + `audio_url` content |
| Social (reviews/follows/reading lists) | DB schema + partial UI | Complete UI |
| Subscriptions | `subscriptions` table exists | Stripe Billing integration |
| Author payouts | Schema + server actions | Stripe Connect wiring |
| Virus scanning on uploads | Placeholder trigger in migration | Real scanner integration |
| Book pricing (regional/discounts/PWYW) | Schema exists | Checkout integration |
| Data export | `export_jobs` table + action | Complete pipeline |

### Automation upgrades (Lane B — engineering PR)

1. Fix `ci.yml` + `deploy.yml`
2. Fix type-check/Jest types issue (if present on current main)
3. Add a `site-ops.yml` workflow: weekly health audit + `npm audit` report filed as a GitHub issue
4. Document Cloud Build trigger setup in `docs/CANONICAL_PRODUCTION.md`
5. Enable Dependabot in repo settings

### Phase 2 program status (`docs/phase2/`)

- Formal package (16 numbered docs): **NO-GO** until RACI filled (`12-ownership-raci.md`), P0-1…P0-9 acceptance tests evidenced (`06-acceptance-and-test-protocol.md`), milestones M0–M7b signed (`05-milestone-implementation-plan.md`)
- Original LitStream docs (Sanity/Vite/Firebase) were normalized to Next.js/Supabase/Cloud Run — see `DEV_HANDOFF_NEXTJS_ALIGNMENT.md`

### Execution roadmap (condensed)

1. **Unblock:** env, migrations, Cloud Run deploy, health checks green
2. **Verify:** auth, checkout, reading, admin smoke tests
3. **Program:** Phase 2 intake worksheet, RACI, milestones M0–M7b; then Resonance + email add-ons

### Pick a lane

- **Lane A — operator:** run Part 9 bootstrap; verify with Part 11
- **Lane B — engineering:** open the automation PR (above)
- **Lane C — both** in parallel

---

## Part 14 — Values to Collect (Copy/Paste Block)

### Mangu Publishers (this repo)

```
GITHUB_REPO=redinc23/my_publishing
PROD_BRANCH=main
GCP_PROJECT_ID=delta-wonder-488420-i3
GCP_REGION=us-central1
CLOUD_RUN_SERVICE=mangu-publishers
CLOUD_RUN_URL=https://________________.run.app
CUSTOM_DOMAIN=https://mangu-publishers.com
SUPABASE_PROJECT_REF=tkzvikozrcynhwsqtkqp
NEXT_PUBLIC_SUPABASE_URL=https://tkzvikozrcynhwsqtkqp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=________________
SUPABASE_SERVICE_ROLE_KEY=________________
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_____________
STRIPE_SECRET_KEY=sk_____________
STRIPE_WEBHOOK_SECRET=whsec_____________
STRIPE_WEBHOOK_URL=https://mangu-publishers.com/api/webhook
NEXT_PUBLIC_SITE_URL=https://mangu-publishers.com
UPSTASH_REDIS_REST_URL=________________
UPSTASH_REDIS_REST_TOKEN=________________
OPENAI_API_KEY=________________            # Phase 2
RESEND_API_KEY=________________            # Phase 2
SENTRY_DSN=________________                # Phase 2
ADMIN_USER_EMAIL=________________
UPTIME_MONITOR_URLS=/, /api/health
```

### NEXUS (Railway/Vercel deployment — see Part 16)

```
DOMAIN=________________________
WEB_URL=https://________________
API_URL=https://api.________________
GITHUB_REPO=redinc23/centuries
PROD_BRANCH=________________
VERCEL_PROJECT=________________
VERCEL_DEFAULT_URL=https://________________.vercel.app
RAILWAY_PROJECT=________________
RAILWAY_DEFAULT_URL=https://________________.up.railway.app
RAILWAY_API_CNAME_TARGET=________________.up.railway.app
DATABASE_URL=file:/data/nexus.db
JWT_SECRET=________________
CORS_ORIGIN=https://________________,https://________________.vercel.app
NEXT_PUBLIC_API_URL=https://api.________________
```

---

## Part 15 — Documentation Map

### Root

| File | What |
|------|------|
| `README.md` | Project overview, features, migration order |
| `QUICK_START.md` | Local setup step-by-step |
| `AMPLIFY_READY.md` | AWS Amplify readiness (legacy) |
| `COMPLETE_FILE_LIST.md` | Exhaustive file inventory |

### `docs/`

| File | What |
|------|------|
| `MANGU_PUBLISHERS_END_TO_END.md` | **Master E2E doc** — business, architecture, env matrix, roadmap |
| `CANONICAL_PRODUCTION.md` | Cloud Run is authoritative; 7-step operator checklist |
| `MANGU_PRODUCTION_DEPLOYMENT.md` | Production launch narrative + `deploy_master.sh` |
| `DEPLOYMENT.md` | Multi-target deploy guide (Cloud Run / Vercel / Amplify) |
| `BRD.md` / `FEATURE_PHASES.md` / `IMPLEMENTATION_STATUS.md` | Requirements, phase matrix, status |
| `MIGRATIONS.md` | Migration order + troubleshooting |
| `DEVELOPMENT.md` / `API.md` | Dev guide + API reference |
| `AUTH_TESTING.md` / `ADMIN_PROTECTION_TESTING.md` | Auth + RBAC test guides |
| `WEBHOOK_TESTING.md` / `STRIPE_WEBHOOK_PRODUCTION.md` | Stripe webhook local + prod |
| `LAUNCH_CHECKLIST.md` / `AWS_AMPLIFY_*.md` | Amplify launch docs (legacy) |
| `HOMEPAGE_STRATEGY.md` | Static HTML vs Next.js homepage |
| `OPERATOR_QA_LOG.md` | QA evidence log |
| `ROLLBACK.md` | Rollback commands per change |
| `NEXUS_RECOVERY_KIT.md` | NEXUS analyzer playbook |
| `STANDARDS.md` | Standards & controls index |

### `docs/phase2/` — numbered program package

`01-executive-summary` → `15-onboarding-quickstart`, plus runbooks: **07-operational-runbook** (incidents/rollback), **13-cutover-day-runbook** (T-24h → +24h), **11-handoff-master-checklist**, **14-evidence-and-signoff-log**. Legacy sources in `_sources/`, intake worksheets in `_intake/`.

---

## Part 16 — NEXUS Go-Live Checklist (Domain + Cloudflare + Vercel + Railway)

> NEXUS is the social cross-posting app in `redinc23/centuries` (separate repo).
> Stack: Next.js web (`apps/web`) on Vercel + Node API with SQLite on Railway + Cloudflare DNS.

### 0) Decisions first

- [ ] Domain name chosen: ________________
- [ ] Web URL: root `https://yourdomain.com` / subdomain `https://nexus.yourdomain.com` (recommended) / other
- [ ] API URL: `https://api.yourdomain.com` (recommended)
- [ ] GitHub repo: `redinc23/centuries`
- [ ] Production branch: ________________ (likely `main` or your merged branch)
- [ ] Account ownership confirmed: Cloudflare / Vercel / Railway / GitHub

### 1) Accounts & access

- [ ] Cloudflare account created/logged in
- [ ] Vercel account created/logged in (GitHub connected)
- [ ] Railway account created/logged in (GitHub connected)
- [ ] GitHub repo access confirmed; can deploy from correct branch

### 2) Domain setup (Cloudflare)

**Option A — Buy domain in Cloudflare**
- [ ] Bought domain: ________________
- [ ] Domain appears in Cloudflare dashboard

**Option B — Domain bought elsewhere**
- [ ] Domain added to Cloudflare ("Add a site")
- [ ] Registrar nameservers updated to Cloudflare NS: NS1 ________ / NS2 ________
- [ ] Cloudflare shows domain as **Active**

### 3) Deploy API to Railway (backend)

- [ ] New Railway project created; connected to `redinc23/centuries`
- [ ] Correct production branch selected; `railway.json` detected (API service)
- [ ] **Persistent volume mounted at `/data`** — without this, SQLite resets on every redeploy

**Railway env vars (API service):**

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `file:/data/nexus.db` |
| `JWT_SECRET` | long random secret (generate fresh) |
| `CORS_ORIGIN` | set after web domain is known |
| `NODE_ENV` | `production` |

- [ ] All env vars saved
- [ ] Railway default domain generated: `https://________.up.railway.app`
- [ ] `curl https://YOUR-RAILWAY-URL/health` → `{"status":"ok",...}`
- [ ] Custom domain `api.yourdomain.com` added; Railway CNAME target noted: ________
- [ ] Optional: seed once — demo user `demo@nexus.app` / `password123` (rotate for prod!) — or register fresh in UI

### 4) Deploy web to Vercel (frontend)

- [ ] Imported `redinc23/centuries`
- [ ] **Root Directory = `apps/web`** (critical — build fails from repo root)
- [ ] Framework: Next.js (auto); production branch set correctly
- [ ] Env var `NEXT_PUBLIC_API_URL = https://api.yourdomain.com` (no trailing slash), saved for **Production**
- [ ] **Redeploy triggered after env change** (NEXT_PUBLIC_ vars are baked at build time)
- [ ] Default URL works: `https://________.vercel.app`
- [ ] Custom domain added (`nexus.yourdomain.com` or root); required DNS record noted: type ______ / name ______ / value ______

### 5) Cloudflare DNS records

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | `________.up.railway.app` | **DNS only (grey cloud)** |
| CNAME | `nexus` (or `@` for root) | `cname.vercel-dns.com` (or Vercel-provided) | Proxied (orange) usually OK |

- [ ] API DNS record added; SSL cert active on Railway custom domain
- [ ] Web DNS record added; Vercel domain status = **Valid**
- [ ] Optional: `www` → redirect to primary; root → primary (if using subdomain)

### 6) Close the CORS loop (critical)

- [ ] Railway API env: `CORS_ORIGIN` = live web origin(s), comma-separated, e.g. `https://nexus.yourdomain.com,https://your-app.vercel.app`
- [ ] **Redeploy API service after change**

### 7) Cloudflare security settings

- [ ] SSL/TLS mode: **Full (strict)** (once certs valid)
- [ ] Always Use HTTPS: ON
- [ ] Automatic HTTPS Rewrites: ON
- [ ] Optional: Bot protection / WAF rules
- [ ] Optional: Rate limiting for auth endpoints

### 8) NEXUS production smoke tests

**API:**
- [ ] `curl https://api.yourdomain.com/health` → ok
- [ ] `curl https://api.yourdomain.com/api/platforms` → platform list

**Web:**
- [ ] Landing page loads on custom domain
- [ ] Register new account / Login work
- [ ] Dashboard overview loads
- [ ] Connections page loads; connect a platform (demo connector) works
- [ ] Unified feed loads posts; like/bookmark works
- [ ] Composer cross-post works; publishing history updates

**Console/network:**
- [ ] No CORS errors in DevTools
- [ ] API calls go to `https://api.yourdomain.com` (not localhost)

### 9) NEXUS secrets & safety

- [ ] `JWT_SECRET` strong, not committed
- [ ] `.env` / `.env.local` not pushed
- [ ] Railway + Vercel env vars documented privately
- [ ] Demo credentials disabled/rotated for public prod

### 10) NEXUS "done" definition

Live when ALL are true:
- [ ] Custom web domain loads app
- [ ] Custom API domain health check passes
- [ ] Auth + dashboard + feed + composer all work on custom domain
- [ ] No CORS errors
- [ ] DNS + SSL green/valid in Cloudflare, Vercel, and Railway

### 11) NEXUS common gotchas

- **CORS error** → `CORS_ORIGIN` missing exact web URL (scheme + host, no trailing slash)
- **Web calls localhost API** → `NEXT_PUBLIC_API_URL` wrong or web not redeployed
- **API DB resets** → Railway volume not mounted at `/data`
- **API custom-domain SSL issue** → Cloudflare proxy for `api` must be **DNS only**
- **Vercel build fails** → Root Directory must be `apps/web`, not repo root
- **404 on dashboard routes** → ensure Vercel project deploys the Next.js App Router app from `apps/web`

---

## Part 17 — NEXUS Analyzer Toolkit (in this repo)

Separate from the NEXUS app above: this repo ships a **forensic analysis + recovery toolkit** for auditing Node/TS repos and generating Cursor recovery prompts.

| Piece | What |
|-------|------|
| `scripts/nexus_analyzer.py` | Python analyzer v2.4.x: structure forensics, dependency inventory, git status, component scoring (Database/API/Connectors/Frontend/Deployment), JSON reports + Cursor prompts |
| `scripts/nexus-rollout.sh` | Batch analysis across repos listed in `repos.txt` (`repo|secret|branch` format) |
| `docs/NEXUS_RECOVERY_KIT.md` | Full playbook |
| `nexus_analysis/` | Latest outputs: `EXECUTIVE_SUMMARY.md` (health 100/100, 5/5 components), `CURSOR_PROMPT.md`, `analysis_report.json` |

No deployment or env vars needed; `GH_PAT` only for cloning private repos during rollout.

---

## Part 18 — Definition of Done

### Mangu Publishers — you're live when ALL are true

- [ ] `https://mangu-publishers.com/api/health?ready=1` returns healthy (env + DB + auth + migrations + Stripe checks pass)
- [ ] Register → browse `/books` → test purchase (`4242…`) → book readable in `/library` — end to end
- [ ] Admin dashboard reachable by admin user; role gates enforced
- [ ] Stripe webhook delivering (no failed events in Dashboard)
- [ ] No CORS/CSP errors in browser console
- [ ] DNS + SSL valid; Cloud Run revision healthy
- [ ] CI green on `main` (`ci.yml` fixed); Cloud Build trigger live
- [ ] Uptime monitors active on `/` and `/api/health`
- [ ] Backups scheduled (`scripts/backup-db.sh`)
- [ ] Secrets only in Secret Manager / dashboards, never in git
- [ ] QA evidence logged in `docs/OPERATOR_QA_LOG.md`

### NEXUS — see Part 16 §10

---

**Bottom line:** the code is there for a fully functional Phase 1 MVP — marketplace, auth, reading, payments, author/admin portals. What stands between "live shell" and "real users" is the one-time wiring (Supabase + Stripe + GCP secrets + seed data + QA, Part 9) and the unified deploy/ops loops (Part 10). Phase 2 upgrades (AI recommendations, email, distributed rate limiting, partner portal, book clubs) are enumerated in Part 13 with exactly what each needs.
