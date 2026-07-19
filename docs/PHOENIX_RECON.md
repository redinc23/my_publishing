# PHOENIX RECON — Phase 0 Deep Dive

**Per:** `CLAUDE.md` §3 · **Contract:** `docs/PROJECT_PHOENIX.md` v4.0  
**Baseline:** `main` @ `9320407` (2026-07-18)  
**Prior recon:** `6fafefa` (thin Phase 0) — this revision expands to full architecture inventory  
**Verdict:** Migration has **not** started on `main`. Zero MongoDB / Better Auth / Vercel Blob application code is merged. Infra scaffolding exists only on `cursor/mongodb-scaffold-dffa`. Phoenix core path assumptions (App Router) hold; **role model, payment-idempotency schema, field names, and feature surface** require doc amendments before WS1 (see §10).

---

## Executive snapshot

| Dimension | Reality on `main` |
| --------- | ----------------- |
| Router | **App Router authoritative** (`app/` = 115 TS/TSX files). `pages/_document.tsx` is dead. |
| Auth | Supabase Auth + SSR cookies; edge JWT parse in middleware |
| Data | Supabase Postgres + RLS (25 migrations, ~30 tables) |
| Storage | Supabase Storage buckets: `book-covers`, `manuscripts`, `published-epubs` |
| Hosting dual-track | Vercel (`vercel.json`) + legacy GCP Cloud Run (`Dockerfile`, `cloudbuild.yaml`) |
| Phoenix deps | **Missing:** `better-auth`, `mongodb`, `@vercel/blob`. **Present:** Upstash, Resend, Stripe, Sentry |
| Supabase surface | **643 hits / 96 files** under `app/ lib/ components/ types/` |
| Roles | Live: `reader \| author \| partner \| admin`. Doc: `… \| editor \| …` → **conflict (D9)** |
| Tests | Jest **24/24 suites, 127/127 PASS**. Playwright not locally runnable without secrets |
| `HUMAN_TASKS.md` | Missing → created alongside this recon |

---

## 1. Routing reality

### 1.1 Authoritative router

**App Router wins.** Evidence:

- Full tree under `app/` with route groups `(auth)`, `(consumer)`, `(portals)`, plus `admin/`, `api/`, `checkout/`, `dashboard/`, `users/`.
- `next.config.js` has no `pages`-only redirects; `vercel.json` is routing-neutral (`framework: nextjs`, region `iad1`).
- `pages/` contains **only** `pages/_document.tsx` (13 lines) — never rendered under App Router. Delete in WS4 (D1).

**Phoenix doc App Router paths are correct.** No path amendment needed for WS1 file locations (`app/api/auth/[...all]`, `app/(auth)/…`).

### 1.2 Complete route inventory

#### Auth — `app/(auth)/` (URL paths omit group)

| URL | Files | Notes |
| --- | ----- | ----- |
| `/login` | `page.tsx`, `LoginForm.tsx`, `actions.ts` | Supabase `signInWithPassword` |
| `/register` | `page.tsx`, `RegisterForm.tsx`, `actions.ts` | Creates auth user + profile trigger |
| `/reset-password` | `page.tsx`, `ResetPasswordForm.tsx`, `actions.ts` | Request reset |
| `/reset-password/confirm` | `page.tsx`, `layout.tsx` | Recovery confirm (middleware allowlist) |
| `/verify-email` | `page.tsx`, `ResendVerificationForm.tsx`, `actions.ts` | |
| `/callback` | `route.ts` | OAuth / magic-link exchange |

#### Consumer — `app/(consumer)/`

`/`, `/books`, `/books/[slug]`, `/authors`, `/authors/[id]`, `/genres`, `/genres/[genre]`, `/library` (auth), `/reading/[bookId]` (auth), `/discover`, `/discover/recommendations`, `/discover/book-clubs` (placeholder), `/audio`, `/audio/[id]`, `/comics`, `/comics/[slug]`, `/papers`, `/papers/[slug]`, `/recommendations`, `/readers-hub`, plus marketing/legal (`about`, `blog`, `careers`, `contact`, `cookies`, `faqs`, `help`, `press`, `privacy`, `terms`).

#### Portals — `app/(portals)/`

| Area | Routes |
| ---- | ------ |
| Author | `/author/dashboard`, `/author/projects`, `/author/projects/[id]`, `/author/submit`, `/author/analytics` |
| Partner | `/partner/dashboard`, `/partner/orders`, `/partner/orders/[id]`, `/partner/orders/export`, `/partner/catalogs`, `/partner/arc-requests` |

#### Admin — `app/admin/`

`/admin/dashboard`, `/admin/books`, `/admin/books/new`, `/admin/books/[id]/edit`, `/admin/users`, `/admin/orders`, `/admin/manuscripts`, `/admin/health` + `layout.tsx`, `actions.ts`.

#### Dashboard — `app/dashboard/`

`/dashboard/my-reviews`, `/dashboard/books/[id]/analytics`.

> **Gap vs Phoenix WS1.4:** middleware does **not** protect `/dashboard*`. Doc expects `/dashboard*` gated. Live product also gates `/reading*`, `/library*`, `/author*`, `/partner*` (see §5).

#### API — `app/api/`

| Path | Role |
| ---- | ---- |
| `/api/health` | Startup + readiness (`?ready=1`) — **Supabase-based today** |
| `/api/session` | Session probe |
| `/api/checkout` | Stripe Checkout session create |
| `/api/webhook` | Canonical Stripe webhook |
| `/api/webhooks/stripe` | Re-exports `/api/webhook` |
| `/api/upload` | Manuscript upload (admin client → Storage) |
| `/api/newsletter` | Newsletter |
| `/api/live` | Live readers |
| `/api/analytics/{track,stream}` | Analytics ingest/stream |
| `/api/resonance/{track,similar,recommend,embed}` | pgvector recommendations |
| `/api/mcp/[transport]` | MCP server (gated) |

**Not present (Phoenix requires):** `/api/auth/[...all]`, `/api/files/[id]`, `/api/books`, `/api/books/[id]`.

### 1.3 `next.config.js` (routing / platform)

- `output: 'standalone'` (non-Windows) — Cloud Run / Docker.
- `env.publicEnv` hardcodes Supabase URL/anon + `NEXT_PUBLIC_SITE_URL` fallbacks for prerender.
- CSP/`headers()` allow `https://*.supabase.co` / `wss://*.supabase.co`.
- `images.remotePatterns`: `**.supabase.co`, `picsum.photos` — **no** Blob host yet.
- `experimental.serverActions.bodySizeLimit: '1mb'`.
- Optional Sentry wrap when DSN set.

---

## 2. Migration branch inventory (`cursor/mongodb-scaffold-dffa`)

**5 commits ahead of `main`, none merged.** Diffstat: +1764 / −56 across 27 files.

| Asset | Notes |
| ----- | ----- |
| `lib/mongodb.ts` + `lib/mongodb-config.ts` | Client singleton (doc says `lib/mongo.ts` → **D2**) |
| `lib/db/provider.ts` + unit test | `DATABASE_PROVIDER` toggle |
| `scripts/atlas-bootstrap.ts`, `scripts/lib/atlas-admin.ts`, `mongo-up.ts`, `mongo-ping.ts`, `mongo-ensure-indexes.ts`, `mongo-import-uri.ts`, `sync-mongodb-to-vercel.ts`, `scripts/lib/env-file.ts` | Fulfills `db:mongo:up\|ping\|indexes` (P5.x) |
| `.github/workflows/mongo-up.yml` | Atlas bootstrap CI |
| `docs/adr/ADR-002-mongodb-data-platform.md` | Decision record |
| `package.json` | `mongodb ^7.5.0`, `digest-fetch`; scripts `db:atlas:bootstrap`, `db:mongo:{up,ping,indexes,import-uri,sync-vercel}` |
| Reworked `app/api/health/route.ts` | Mongo-aware readiness (overlaps WS4) |
| Env example patches | Adds `MONGODB_URI` / `DATABASE_PROVIDER` |

**Absent on branch:** `better-auth`, `@vercel/blob`, `types/mongo.ts`, `lib/mongo-queries.ts`, any app data-layer swap, forced-reset scripts, storage migration.

**Resolution:** Cherry-pick / rebase scaffold into WS2a+WS4; do not rewrite Atlas scripts. Export `getDb()` to match doc contract; amend filename in doc (D2).

---

## 3. package.json audit (`main` @ 1.0.1)

| Category | Packages |
| -------- | -------- |
| Runtime | Next `14.2.35`, React `18.3.1`, **react-dom `19.2.7`** (version skew — note D14) |
| Engines | `node >= 22` (`.nvmrc` present) |
| Legacy (WS4 remove) | `@supabase/ssr ^0.12.3`, `@supabase/supabase-js ^2.110.7` |
| To add | `better-auth` (WS1), `mongodb` (WS2 — take `^7.5.0` from scaffold), `@vercel/blob` (WS3) |
| Already present | `@upstash/ratelimit 1.1.3`, `@upstash/redis ^1.32.0`, `resend ^3.2.0`, `stripe ^14.25.0`, `@sentry/nextjs ^8.55.2`, `zod`, `@react-email/components` |
| Scripts on `main` | `validate-env`, `dev`, `build`, `start`, `lint`, `type-check`, `test`, `test:e2e`, `db:seed`, `db:migrate`, `verify-rls` |
| Missing scripts | `db:mongo:up\|ping\|indexes` (on scaffold only → D3) |

---

## 4. Auth & data surface map (WS task ownership)

`rg -i supabase` over `app/ lib/ components/ types/` → **643 hits / 96 files**.

### 4.1 Core clients (delete WS4)

`lib/supabase/{client,server,admin,edge-auth,queries,public-queries,portal-queries,author-ownership}.ts` + `queries.test.ts`.

### 4.2 Auth (WS1)

| File | Change |
| ---- | ------ |
| `middleware.ts` | Cookie-only Better Auth session; protect routes; `?next=` |
| `lib/supabase/edge-auth.ts` | Delete after WS1 |
| `lib/middleware/auth.ts` | Rewrite to Better Auth `getSession` |
| `app/(auth)/**` | Rewrite actions/forms |
| `app/api/session/route.ts` | Replace or retire |
| `components/providers/auth-provider.tsx` | Better Auth client |
| `lib/auth/register-errors.ts` | Keep / adapt |
| **New:** `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `emails/reset.tsx`, `scripts/request-password-reset.ts` | |

### 4.3 Data / actions (WS2)

`lib/actions/{books,reviews,users,upload,analytics,partner,payouts,revenue,follows,reading-list,export-data,ai-insights}.ts`  
`app/api/{webhook,checkout,health,upload,analytics,resonance}/**`  
`lib/{reading/entitlement,resonance/*,services/*}.ts`  
Admin + portal pages under `app/admin`, `app/(portals)`.

### 4.4 Pages / UI (WS2d)

Admin pages, `app/dashboard/*`, `app/checkout/page.tsx`, consumer book/author pages, `app/sitemap.ts`, `app/layout.tsx` (DNS-prefetch), home sections under `components/home/*`.

### 4.5 Ops scripts (WS4 retire / replace)

`setup.sh`, `pre-launch-verify.sh`, `scripts/{run-migrations,seed-database,verify-rls,role-crawl}.ts`, `supabase/migrations/`, GCP helpers, `cloudbuild.yaml` (standby until Phase 13/14).

---

## 5. Middleware deep dive (Edge risk — #1 technical risk)

**File:** `middleware.ts` (173 lines). **Depends on:** `getEdgeAuthUser` / `getEdgeUserRole` (Supabase JWT cookie parse + **role fetch** — not cookie-only).

| Concern | Live behavior | Phoenix requirement | Gap |
| ------- | ------------- | ------------------- | --- |
| Session check | JWT parse + optional role API | `getSessionCookie` only (no Mongo in Edge) | Must rewrite |
| Rate limit | Auth paths + upload; fail-closed | `/api/*` 100/60s; `/api/auth/*` 10/60s; whitelist health | Tighten in WS6; live auth limit is **5**/60s |
| Protected | `/reading*`, `/library*`, `/author*`, `/partner*`, `/admin*` | `/dashboard*`, `/admin*`, `/api/files*` | Align list; keep portals |
| Redirect | `/login` **without** `?next=` | `/login?next=<path>` | Add |
| Roles | `admin` / `author` / `partner` | Doc says `editor` | **D9** |
| Fail-open | Missing Supabase env → skip auth | Fail closed post-Phoenix | Fix in WS1 |
| Matcher | All except static/images | Keep | OK |

**Chosen RBAC strategy for WS1 (document in PR #1):** coarse auth-gating in middleware via session cookie (+ optional signed role cookie at login); fine-grained RBAC in server layouts/actions via `auth.api.getSession`. Do **not** call Mongo from middleware.

---

## 6. Data model inventory (Postgres → Mongo mapping risks)

### 6.1 Tables present (migrations)

**Core:** `profiles`, `authors`, `books`, `book_content`, `reading_sessions`, `reading_progress`, `resonance_vectors`, `engagement_events`, `manuscripts`, `partners`, `arc_requests`, `orders`, `order_items`, `subscriptions`, `notifications`

**Analytics / commerce:** `analytics_events` (partitioned), `analytics_sessions`, `book_stats_daily`, `book_sales`, `author_payouts`, `payout_items`, `book_pricing`, `webhook_events`, `export_jobs`, `rate_limits`, `audit_logs`

**Social:** `reviews`, `review_votes`, `comments`, `user_follows`, `reading_lists`, `user_activities`

### 6.2 Role CHECK (live)

```sql
role IN ('reader', 'author', 'partner', 'admin')  -- NO 'editor'
```

Partner is first-class: `partners` table, ARC requests, `/partner/*` portal, middleware gate.

### 6.3 Rating dual-path (integrity risk)

1. Trigger on `reading_progress.rating` → `books.average_rating` / `total_reviews`
2. Trigger on `reviews` → `average_rating` / `review_count` / `total_reviews`
3. App also recomputes in `lib/actions/reviews.ts`

Phoenix fields `avg_rating` / `review_count` must map carefully (**D11**).

### 6.4 Payment idempotency (live vs doc)

| Layer | Reality |
| ----- | ------- |
| `orders.payment_intent_id` | Column name ≠ doc `stripe_payment_intent_id`; **no UNIQUE index** |
| `book_sales.stripe_payment_intent_id` | UNIQUE — but webhook writes `orders`, not `book_sales` |
| `webhook_events.event_id` | UNIQUE — Stripe **event** idempotency |
| App webhook | SELECT-then-insert race possible |

Phoenix WS2b requires unique sparse index + upsert by `stripe_payment_intent_id` — **correct target; live schema must be upgraded during transform** (**D10**).

### 6.5 Storage buckets

| Bucket | Public | Limit |
| ------ | ------ | ----- |
| `book-covers` | yes | 5MB |
| `manuscripts` | no | 100MB |
| `published-epubs` | yes | 50MB |

Upload paths today: `{userId}/{hash|timestamp}.{ext}` via `lib/actions/upload.ts` and `/api/upload`. Typed `audiobooks` bucket in `types/upload.ts` has **no SQL creation**.

### 6.6 `types/database.ts`

Hand-maintained and **stale** — missing reviews/social/analytics/revenue tables and many book columns (`content_type`, retailer URLs, etc.). Replace with `types/mongo.ts` in WS2a; do not regenerate Supabase types.

---

## 7. Feature surface vs Phoenix scope (under-specification)

| Live feature | Evidence | In Phoenix Mongo target? | Recommendation |
| ------------ | -------- | ------------------------ | -------------- |
| Partner portal + ARC | Full routes + tables + actions | **No** (doc invents `editor`) | Amend RBAC to keep `partner` (D9); migrate `partners`/`arc_requests` or explicitly freeze |
| `content_type` comics/papers | Routes + column | Partial | Add to `Book` type + transform |
| Audio | `book_content.audio_url`, `/audio` | No | Decide: migrate URLs or out-of-scope |
| Resonance / pgvector | Tables + `/api/resonance/*` | Out of scope (analytics 30d only) | Freeze or stub; no vector migration required for parity cutover |
| MCP | `/api/mcp/[transport]` | Absent | Keep behind flag; no Mongo dependency assumed |
| Social (follows, lists, comments) | Tables + actions | Reviews only | Migrate reviews; freeze or phase-2 others |
| Revenue (`book_sales`, payouts, pricing) | Full stack | Orders only | Keep Stripe checkout/orders; payouts = post-Phoenix or explicit parity task |
| Manuscripts table | Author submit pipeline | Flattened to `books.manuscript_url` | Transform must map manuscript files → book URLs or keep collection (**D13**) |
| Subscriptions / notifications | Tables | Unclear | Confirm unused → skip |

---

## 8. Scripts & tooling

### 8.1 npm scripts (`main`)

Supabase-era: `db:seed`, `db:migrate`, `verify-rls`. Env gate: `validate-env` (blocks `npm run dev`).

### 8.2 Shell / ops

`setup.sh`, `verify-setup.sh`, `pre-launch-verify.sh`, `cleanup-envs.sh`, `setup-envs.sh`, Amplify (`amplify.yml`), Docker + `cloudbuild.yaml`.

### 8.3 `scripts/` (no Phoenix migration scripts yet)

Present: seed/migrate/RLS/GCP/Stripe webhook helpers.  
**Must write (Phase 11 / WS support):** `export-supabase.sh`, `transform-data.ts`, `migrate-storage.ts`, `export-delta.ts`, `send-forced-resets.ts`, `request-password-reset.ts`, `verify-migration.mongo.js`.

---

## 9. Environment examples vs Phoenix §9.1

| Phoenix §9.1 var | In `.env.local.example`? | Notes |
| ---------------- | ------------------------ | ----- |
| `MONGODB_URI` | No (scaffold yes) | Add WS2 |
| `DATABASE_PROVIDER` | No (scaffold yes) | Add WS2 |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | No | Add WS1 |
| `BLOB_READ_WRITE_TOKEN` | No | Add WS3 |
| `STRIPE_*` | Yes | Keep |
| `UPSTASH_*` | Yes | Keep |
| `RESEND_API_KEY` | Commented optional | Promote to required at WS1 |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Yes | Keep |
| `NEXT_PUBLIC_APP_URL` | **No** — repo uses `NEXT_PUBLIC_SITE_URL` | **D4** |
| `SUPABASE_*` (3) | Yes | Temp until P14 |
| Extra live: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, Sentry ORG/PROJECT/AUTH_TOKEN | Yes | **D5** — amend §9.1 |

`.env.example` is a one-line stub pointing at `.env.local.example` (**D6**).  
`.env.production.example` lacks Sentry block present in local example.

---

## 10. Delta list (doc X → repo Y → resolution Z)

| # | Doc says | Repo has | Resolution |
| - | -------- | -------- | ---------- |
| D1 | App Router | App Router + dead `pages/_document.tsx` | Delete in WS4; no path doc change |
| D2 | `lib/mongo.ts` | Scaffold: `lib/mongodb.ts` | Reuse; export `getDb()`; amend doc filename |
| D3 | `db:mongo:*` scripts | Absent on `main`; on scaffold | Adopt in WS2 PR |
| D4 | `NEXT_PUBLIC_APP_URL` | `NEXT_PUBLIC_SITE_URL` everywhere | Keep SITE_URL; amend §9.1 |
| D5 | §9.1 ≈14 vars | Also Stripe publishable, OpenAI, Sentry build trio | Amend §9.1 |
| D6 | Real `.env.example` | Stub | Rebuild WS4 |
| D7 | E2E baseline | Not runnable locally (validate-env) | CI is e2e baseline; human gate for local |
| D8 | WS3 `access: 'public'` blobs | — | Doc decision: manuscripts via proxy only; covers public OK |
| **D9** | Roles include `editor` | Live `partner` (+ portal/ARC) | **Amend Phoenix RBAC → `reader\|author\|partner\|admin`** |
| **D10** | `orders.stripe_payment_intent_id` unique upsert | `payment_intent_id` non-unique + event idempotency | Transform + WS2b implement doc target |
| **D11** | `avg_rating` / `review_count` | `average_rating` / `total_reviews` / `review_count` | Map in `types/mongo.ts` + transform; single recompute path |
| **D12** | Lean Mongo target set | Rich product (resonance, MCP, social, payouts, content_type) | Feature freeze: parity for catalog/auth/orders/reviews/portals; stub or defer others in doc §1.4 |
| **D13** | `books.manuscript_url` | `manuscripts` table + Storage URLs | Transform maps accepted manuscripts → book field or keep collection |
| D14 | — | `react` 18.3.1 vs `react-dom` 19.2.7 | Out of Phoenix scope; do not “fix” mid-migration unless build breaks |
| D15 | Protect `/dashboard*` | Unprotected in middleware | Include in WS1 matcher |
| D16 | Rate limits 100/60 & 10/60 | Auth 5/60, upload 30/60; no global `/api/*` | Align in WS6 |

---

## 11. CI inventory (19 workflows)

| Workflow | Touch | Phoenix action |
| -------- | ----- | -------------- |
| `ci.yml` | Jest + typecheck + lint + build; Supabase secrets | Keep; swap secrets in WS4/WS5 |
| `e2e.yml`, `preview-e2e.yml` | Playwright | Extend WS5 |
| `supabase-migrate.yml`, `rls-check.yml` | Supabase | Retire WS4 |
| `deploy.yml`, `health-check.yml`, `container-scan.yml` | GCP/Cloud Run | Standby until Phase 13; scrub refs WS4 |
| `copilot-setup-steps.yml` | Setup | Review for Supabase |
| `format-check.yml`, `codeql.yml`, `dependency-review.yml`, `npm-audit.yml`, `lighthouse-ci.yml` | Neutral | Keep |
| `auto-merge.yml`, `bug-to-issue.yml`, `stale.yml`, `release-please.yml`, `admin-setup.yml` | Neutral | Keep |
| Scaffold `mongo-up.yml` | Atlas | Adopt with WS2 |

Also: root `cloudbuild.yaml`, `Dockerfile`, `amplify.yml` (legacy/alternate hosts).

---

## 12. Test baseline (2026-07-18 / this recon refresh)

### Jest (authoritative floor)

```
Test Suites: 24 passed, 24 total
Tests:       127 passed, 127 total
Time:        ~2.3s
```

One worker-teardown warning (pre-existing, benign). **No WS PR may go below 127 passing.**

Suites cover: auth-flow fixes, rate limits, portal/admin hardening, queries mocks, Stripe server, BookCard, MCP transport, reading entitlement, siteUrl, product-truth, migration SQL assertions, etc. Most mock Supabase — WS5 replaces mocks.

### Playwright

`playwright.config.ts` starts `npm run dev` → `validate-env` requires live Supabase. **Not runnable in this agent env without secrets (D7).** CI workflows `e2e.yml` / `preview-e2e.yml` are the e2e baseline of record. Specs: `auth-flow`, `purchase-flow`, `role-gating`, `smoke-auth`, `smoke-stripe`.

### k6

`tests/k6/load-test.js` present — useful for WS6 429 verification later.

---

## 13. Query / action layer map (for WS2 effort sizing)

### `lib/supabase/queries.ts` (high-value exports)

Catalog: `getBooksPage`, `getPublishedBooks`, `getBookBySlug/Id`, `getFeaturedBooks`, `getTrendingBooks`, `searchBooks`, `getBooksByGenre`  
Authors: `getAuthorById/Slug`, `getAuthorBooks`, `getAuthorSummary`  
Reading: progress CRUD + finished  
Commerce: `getUserOrders`, `createOrder`  
Manuscripts: CRUD/status  
Resonance: recommendations/similar  
Profile + `getPlatformStats`

### `portal-queries.ts`

`getAuthorForUser`, `getPartnerForUser` (admin client).

### `lib/actions/*`

books, reviews (+ avg recompute), upload (Storage), users, reading-list, follows, partner/ARC, analytics, revenue, payouts, export-data, ai-insights.

---

## 14. Stripe (keep provider; swap data layer)

- Checkout: `/api/checkout` → `lib/stripe/server.createCheckoutSession` (metadata `book_id`, `book_slug`, `user_id` = auth uid).
- Webhook: `/api/webhook` (+ alias `/api/webhooks/stripe`) — signature verify → `webhook_events` idempotency → insert `orders`/`order_items`.
- WS2b must: rename/normalize to `stripe_payment_intent_id`, unique sparse index, upsert, always 200 on duplicate.

---

## 15. Observability & rate limiting (today)

| Concern | Live | Phoenix WS6 target |
| ------- | ---- | ------------------ |
| Rate limit | `lib/rate-limit.ts` Upstash sliding window; middleware auth+upload | Global `/api/*` + stricter auth; whitelist `/api/health`; file `lib/ratelimit.ts` |
| Logging | Ad-hoc `console.*` | `lib/logger.ts` structured JSON |
| Sentry | `sentry.{client,server,edge}.config.ts` present | Verify DSN + `SENTRY_RELEASE` + source maps |

---

## 16. Recommended execution order (unchanged waterfall)

| Order | PR | Workstream | Blockers from this recon |
| ----- | -- | ---------- | ------------------------ |
| 0 | docs | This recon + Phoenix amendments for D4/D5/D9/D11/D12 | — |
| 1 | PR #1 | WS1 Auth | Amend roles (D9); middleware cookie-only; protect dashboard |
| 2 | PR #2a–d | WS2 Data | Adopt scaffold mongo client; field renames D10/D11; partner portal data |
| 3 | PR #3 | WS3 Storage | D8 access decision; migrate 3 buckets (+ decide audio) |
| 4 | PR #4 | WS4 Cleanup | Purge 643 supabase hits; health rewrite |
| 5 | PR #5 | WS5 Tests | Replace mocks; keep ≥127 unit tests |
| 6 | PR #6 | WS6 Obs | Align rate limits D16 |

---

## 17. Human gates logged

See root `HUMAN_TASKS.md` (created with this recon). Immediate: Atlas/Vercel secrets for scaffold scripts, local Playwright secrets, Supabase dump/snapshot before cutover.

---

_Phase 0 deep dive complete. Next: merge doc amendments, then WS1 Auth (PR #1) per briefing §4._
