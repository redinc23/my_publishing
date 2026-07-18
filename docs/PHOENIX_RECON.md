# PHOENIX RECON — Phase 0 Deep Dive

**Per:** `CLAUDE.md` §3 · **Contract:** `docs/PROJECT_PHOENIX.md` v4.0  
**Baseline:** `main` @ `9320407` (2026-07-18) · **Prior recon:** `6fafefa` / PR #239 (against `464edaa`)  
**Scope:** Full repository inventory for Project Phoenix cutover. Doc amendments required before WS1 are listed in §11.

**Verdict:** Migration code is **not on `main`**. Live stack is Next.js 14 App Router + Supabase (Auth/Postgres/Storage) + Stripe + Upstash + Resend + Sentry. Mongo scaffolding lives only on open PR #234 (`cursor/mongodb-scaffold-dffa`). Phoenix North Star boxes are all unchecked. Launch authority (`docs/NEXT_GO.md`) is **NO-GO**.

---

## 0. Executive snapshot

| Dimension             | Reality on `main`                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Product               | MANGU Publishers — Netflix-style digital publishing (books / comics / papers / audio)                                                          |
| Framework             | Next.js `14.2.35`, React `18.3.1`, **react-dom `19.2.7` (skew — see D11)**                                                                     |
| Router                | **App Router authoritative**; `pages/_document.tsx` is dead                                                                                    |
| Auth                  | Supabase Auth (SSR cookies + edge JWT parse + REST `/auth/v1/user`)                                                                            |
| Data                  | Supabase Postgres + RLS; 25 migrations; pgvector Resonance Engine                                                                              |
| Storage               | Supabase buckets: `book-covers`, `manuscripts`, `published-epubs`                                                                              |
| Payments              | Stripe Checkout + webhook at `/api/webhook` (+ alias `/api/webhooks/stripe`)                                                                   |
| Hosting               | **ADR-001 ACCEPTED: Vercel** (`www`); apex still Cloud Run until DNS cutover                                                                   |
| Rate limit            | Upstash fail-closed (`lib/rate-limit.ts`) — already ahead of WS6 in places                                                                     |
| Email                 | Resend present; optional in env validation today                                                                                               |
| Observability         | Sentry configs present; DSN optional                                                                                                           |
| Phoenix deps missing  | `better-auth`, `mongodb` (on scaffold only), `@vercel/blob`                                                                                    |
| Supabase surface      | **647 hits / 97 files** under `app/ lib/ components/ types/ middleware.ts`                                                                     |
| Test floor (this run) | Jest **23/24 suites, 122 tests pass**; BookCard suite fails (react-dom 19). Playwright: 213 tests listed, not locally runnable without secrets |

---

## 1. Routing reality

**App Router is authoritative.**

### 1.1 Route groups & surfaces (58 `page.tsx`)

| Area                | Path prefix                                                                                                              | Auth gate                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Marketing / catalog | `app/(consumer)/*` — books, genres, authors, audio, comics, papers, discover, library, reading, legal, about, contact, … | Public except `/library`, `/reading`    |
| Auth                | `app/(auth)/*` — login, register, reset-password (+confirm), verify-email, callback                                      | Public; logged-in users redirected away |
| Author portal       | `app/(portals)/author/*`                                                                                                 | Middleware: `author` \| `admin`         |
| Partner portal      | `app/(portals)/partner/*`                                                                                                | Middleware: `partner` \| `admin`        |
| Admin               | `app/admin/*`                                                                                                            | Middleware + `requireAdmin()` layout    |
| Checkout            | `app/checkout`                                                                                                           | Page-level Supabase session             |
| Dashboard remnants  | `app/dashboard/{books/[id]/analytics,my-reviews}`                                                                        | **Not middleware-gated** (D12)          |
| Home                | `app/page.tsx`                                                                                                           | Public                                  |

### 1.2 API routes (15)

| Route                                            | Purpose                                                        |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `/api/health`                                    | Startup probe + `?ready=1` readiness (Supabase + Stripe today) |
| `/api/session`                                   | Session introspection                                          |
| `/api/checkout`                                  | Stripe Checkout session create                                 |
| `/api/webhook`                                   | Stripe webhook (canonical)                                     |
| `/api/webhooks/stripe`                           | Re-export of `/api/webhook`                                    |
| `/api/upload`                                    | File upload (Supabase Storage)                                 |
| `/api/analytics/{track,stream}`                  | Analytics                                                      |
| `/api/resonance/{embed,recommend,similar,track}` | AI recommendations                                             |
| `/api/newsletter`                                | Newsletter signup                                              |
| `/api/live`                                      | Live/status                                                    |
| `/api/mcp/[transport]`                           | MCP catalog tools — **disabled unless `MCP_ENABLED=true`**     |

**Missing vs Phoenix:** `/api/auth/[...all]` (Better Auth), `/api/files/[id]` (Blob download proxy).

### 1.3 `pages/` and config

- `pages/_document.tsx` only — never rendered by App Router → delete in WS4 (D1).
- `vercel.json`: `framework: nextjs`, region `iad1` — routing-neutral.
- `next.config.js`: `output: 'standalone'` (non-Windows), CSP still allows `*.supabase.co`, image `remotePatterns` for Supabase + picsum only (no Blob yet), Sentry wrapper conditional on DSN.
- **Phoenix App Router paths are correct.** No path amendment needed for WS1.

### 1.4 Middleware (`middleware.ts`, 172 lines)

Current behavior (Edge):

1. Rate-limit `/api/auth/*` and auth-page POSTs (`auth` bucket: 5/60s).
2. Rate-limit upload paths (`upload` bucket: 30/60s).
3. Parse Supabase session cookie → `getEdgeAuthUser` → **network call to Supabase Auth** to resolve user id.
4. For admin/author/partner: **second network call** to PostgREST `profiles` for `role`.
5. Redirect unauthenticated away from `/reading`, `/library`, `/author`, `/partner`, `/admin`.
6. Does **not** protect `/dashboard*` (Phoenix list includes it) — D12.
7. Matcher excludes static assets.

**Critical Phoenix guardrail conflict (D13):** After Better Auth, middleware must be **cookie-only** (`getSessionCookie`) — no Mongo driver, and ideally no remote role fetch. Current design does full Auth + REST role checks on Edge. WS1 must redesign this.

---

## 2. Migration branch inventory (`cursor/mongodb-scaffold-dffa`)

**Open PR #234** — 6 commits ahead of `main`. Not merged.

| Asset                   | Notes                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `lib/mongodb.ts`        | Global-cached `MongoClient`, `getDb()`, `pingMongo()`, Vercel `attachDatabasePool`                                                                         | Doc says `lib/mongo.ts` → **D2** |
| `lib/mongodb-config.ts` | URI assert + DB name                                                                                                                                       |
| `lib/db/provider.ts`    | `DATABASE_PROVIDER=mongodb\|supabase` toggle (default supabase)                                                                                            |
| Scripts                 | `atlas-bootstrap`, `mongo-up`, `mongo-ping`, `mongo-ensure-indexes`, `mongo-import-uri`, `sync-mongodb-to-vercel`, `lib/atlas-admin.ts`, `lib/env-file.ts` |
| Deps                    | `mongodb ^7.5.0`, `@vercel/functions ^3.7.5`, `digest-fetch ^3.1.1`                                                                                        |
| Scripts npm             | `db:mongo:{up,ping,indexes,import-uri,sync-vercel}`, `db:atlas:bootstrap`                                                                                  |
| Workflow                | `.github/workflows/mongo-up.yml`                                                                                                                           |
| ADR                     | `docs/adr/ADR-002-mongodb-data-platform.md` (on branch only)                                                                                               |
| Health                  | Reworked `app/api/health/route.ts` — Mongo-aware when provider=mongodb                                                                                     |

**Absent on scaffold (as doc assumes):** `better-auth`, `@vercel/blob`, `types/mongo.ts`, `lib/mongo-queries.ts`, auth/actions cutover, data-layer swaps.

**Resolution:** Cherry-pick / rebase scaffold into WS2a (client + scripts) and WS4 (health). Do not rewrite Atlas bootstrap.

---

## 3. package.json audit (`main`)

### 3.1 Runtime stack

| Package                                    | Status             | Phoenix action                      |
| ------------------------------------------ | ------------------ | ----------------------------------- |
| `@supabase/ssr`, `@supabase/supabase-js`   | Present            | Remove WS4                          |
| `@upstash/ratelimit`, `@upstash/redis`     | Present            | Keep / extend WS6                   |
| `resend`, `@react-email/components`        | Present            | Wire as required in WS1             |
| `@sentry/nextjs`                           | Present            | Harden WS6                          |
| `stripe`, `@stripe/stripe-js`              | Present            | Keep; swap data layer only          |
| `openai`                                   | Present            | Keep (Resonance; out of Mongo core) |
| `better-auth`                              | **Absent**         | Add WS1                             |
| `mongodb`                                  | **Absent on main** | Add from scaffold WS2a              |
| `@vercel/blob`                             | **Absent**         | Add WS3                             |
| `mcp-handler`, `@modelcontextprotocol/sdk` | Present            | Must lose Supabase client in WS4    |

### 3.2 Scripts on `main`

```
validate-env, dev, build, start, lint, type-check, test, test:e2e,
db:seed, db:migrate, verify-rls
```

No `db:mongo:*` on `main` (D3). Engines: `node >= 22` (`.nvmrc` = `22`).

### 3.3 Dangerous skew (D11)

- `react@18.3.1` + `react-dom@19.2.7` (Dependabot #155 merged).
- Clean `npm ci` fails peer resolution (`@testing-library/react` wants react-dom^18).
- Jest: BookCard suite crashes in `react-dom/client` → **baseline worse than prior recon**.
- **Must fix before / during WS1** (pin react-dom to 18.3.x or upgrade React + Testing Library together). Out of Phoenix feature-freeze scope but blocks CI green rule.

---

## 4. Auth & data surface map (WS task mapping)

`rg -i supabase` → **647 occurrences / 97 files**.

### 4.1 Core clients — delete WS4

`lib/supabase/{client,server,admin,edge-auth,queries,public-queries,portal-queries,author-ownership}.ts` (+ `queries.test.ts`)

### 4.2 Auth flows — WS1

| File                                              | Role                            |
| ------------------------------------------------- | ------------------------------- |
| `app/(auth)/login/{page,LoginForm,actions}.ts(x)` | `signInWithPassword`            |
| `app/(auth)/register/*`                           | Sign-up + profile creation path |
| `app/(auth)/reset-password/*`                     | Recovery request + confirm      |
| `app/(auth)/verify-email/*`                       | Resend verification             |
| `app/(auth)/callback/route.ts`                    | OAuth/email callback            |
| `middleware.ts` + `lib/supabase/edge-auth.ts`     | Edge session + role             |
| `lib/middleware/auth.ts`                          | `requireAdmin` / server RBAC    |
| `app/api/session/route.ts`                        | Session API                     |
| `components/providers/auth-provider.tsx`          | Client auth context             |

### 4.3 Data / actions — WS2

| Module                                                                                                  | Hits | Notes                    |
| ------------------------------------------------------------------------------------------------------- | ---- | ------------------------ |
| `lib/actions/books.ts`                                                                                  | 52   | Largest mutation surface |
| `lib/supabase/queries.ts`                                                                               | 62   | Cached catalog queries   |
| `lib/actions/{reviews,reading-list,follows,revenue,payouts,analytics,export-data,upload,users,partner}` | —    | All Supabase             |
| `app/api/{webhook,checkout,health,upload,analytics,resonance}/*`                                        | —    | Swap data layer          |
| `lib/reading/entitlement.ts`                                                                            | —    | Purchase check           |
| `lib/resonance/*`                                                                                       | —    | Embeddings + recommend   |

### 4.4 Pages / UI — WS2d

Admin pages, portals, consumer book/author/library/reading pages, home sections (`components/home/*`), `app/sitemap.ts`, layout DNS-prefetch to Supabase.

### 4.5 Ops — WS4 retire

`setup.sh`, `pre-launch-verify.sh`, `scripts/{run-migrations,seed-database,verify-rls,role-crawl,apply-supabase-migrations,*gcp*,*supabase*}`.

---

## 5. Data model (Postgres today → Mongo target)

### 5.1 Tables (from migrations)

**Core:** `profiles`, `authors`, `books`, `book_content`, `reading_sessions`, `reading_progress`, `manuscripts`, `partners`, `arc_requests`, `orders`, `order_items`, `subscriptions`, `notifications`

**Analytics / AI:** `resonance_vectors`, `engagement_events`, `analytics_events` (+ partitions), `analytics_sessions`, `book_stats_daily`

**Commerce extras:** `book_pricing`, `book_sales`, `author_payouts`, `payout_items`

**Ops:** `webhook_events`, `export_jobs`, `rate_limits`, `audit_logs`

**Social:** `reviews`, `review_votes`, `comments`, `user_follows`, `reading_lists`, `user_activities`

### 5.2 Roles (D9 — doc conflict)

| Source                        | Roles                                        |
| ----------------------------- | -------------------------------------------- |
| **Live schema / `UserRole`**  | `reader` \| `author` \| `partner` \| `admin` |
| **Phoenix doc §3 / Task 1.1** | `reader` \| `author` \| `editor` \| `admin`  |

Partner portal is real (`app/(portals)/partner/*`, middleware RBAC). There is **no `editor` role** in code. **Amend Phoenix doc** to `reader|author|partner|admin` (or explicitly map `editor`→`partner` / drop partner — product decision, human gate).

### 5.3 Field naming mismatches (D10)

| Phoenix doc                         | Live schema                                                                | Resolution                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `books.avg_rating` / `review_count` | `average_rating` / `total_reviews`                                         | Prefer live names in `types/mongo.ts` **or** rename at transform; amend doc   |
| `books.manuscript_url`              | Separate `manuscripts.manuscript_file_url` + `book_content.{epub,pdf}_url` | Transform must flatten; storage migration must cover all buckets              |
| `orders.stripe_payment_intent_id`   | `orders.payment_intent_id`                                                 | Keep Stripe semantics; unique sparse index on Mongo field; amend doc or alias |
| Profile `auth_user_id`              | `profiles.user_id` → `auth.users`                                          | Map in transform                                                              |

### 5.4 Storage buckets (WS3)

| Bucket            | Public | Limit  | MIME        |
| ----------------- | ------ | ------ | ----------- |
| `book-covers`     | yes    | 5 MB   | images      |
| `manuscripts`     | no     | 100 MB | pdf/doc/txt |
| `published-epubs` | yes    | 50 MB  | epub        |

`scripts/migrate-storage.ts` must migrate **all three**, not only covers/manuscripts paths in the doc (D14).

### 5.5 Webhook idempotency today

- Table `webhook_events` keyed by Stripe `event_id`.
- Orders also check duplicate via `payment_intent_id`.
- Phoenix wants unique sparse index on `orders.stripe_payment_intent_id` + upsert — implement in Mongo layer; do not copy Postgres `webhook_events` forever if event-id upsert on orders is sufficient (doc §2b.1).

---

## 6. Existing scripts inventory

| Script / npm                                          | Purpose                                                                                                                                                               | Phoenix fate              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `npm run validate-env` → `scripts/validate-env.ts`    | Gates `dev`                                                                                                                                                           | Rewrite schema WS4        |
| `db:seed` / `db:migrate` / `verify-rls`               | Supabase                                                                                                                                                              | Retire WS4                |
| `setup.sh`, `verify-setup.sh`, `pre-launch-verify.sh` | Launch gates                                                                                                                                                          | Scrub Supabase refs       |
| `scripts/*gcp*`, `cloudbuild.yaml`, `Dockerfile`      | Cloud Run                                                                                                                                                             | Standby until Phase 13/14 |
| `scripts/create-stripe-webhook.sh`                    | Stripe ops                                                                                                                                                            | Keep (URL already Vercel) |
| Scaffold `db:mongo:*`                                 | Atlas bootstrap                                                                                                                                                       | Adopt WS2/WS5 support     |
| **Missing (agent owns):**                             | `export-supabase.sh`, `transform-data.ts`, `migrate-storage.ts`, `export-delta.ts`, `send-forced-resets.ts`, `request-password-reset.ts`, `verify-migration.mongo.js` | Phase 11 / WS1 / WS3      |

---

## 7. Env examples vs Phoenix §9.1

### 7.1 Present in `.env.local.example` / `.env.production.example`

`NEXT_PUBLIC_SUPABASE_{URL,ANON_KEY}`, `SUPABASE_SERVICE_ROLE_KEY`, Stripe trio + publishable, `NEXT_PUBLIC_SITE_URL`, Upstash pair, Sentry set, `OPENAI_API_KEY` (prod), `RESEND_API_KEY` (commented optional).

### 7.2 Gaps vs §9.1

Missing: `MONGODB_URI`, `DATABASE_PROVIDER`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BLOB_READ_WRITE_TOKEN`, required `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`.

### 7.3 Naming / extras

| Issue                                                                               | Resolution                                                                |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Doc `NEXT_PUBLIC_APP_URL` vs repo `NEXT_PUBLIC_SITE_URL`                            | **Keep SITE_URL**; amend doc (D4)                                         |
| `.env.example` stub                                                                 | Rebuild WS4 (D6)                                                          |
| Undocumented survivors: OpenAI, Stripe publishable, Sentry build trio               | Amend §9.1 (D5)                                                           |
| Hardcoded Supabase URL + anon JWT fallbacks in `next.config.js` + `cloudbuild.yaml` | Remove in WS4 (public anon key is project-scoped but still wrong to bake) |

`lib/utils/env-validation.ts` currently **requires** all three Supabase vars; Stripe/Upstash required unless `USE_MOCKS=true`.

---

## 8. CI / deploy inventory

### 8.1 Workflows (19 on `main`)

| Class           | Workflows                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------- |
| Test            | `ci.yml` (validate-env, tsc, lint, jest, build), `e2e.yml`, `preview-e2e.yml`                 |
| Supabase        | `supabase-migrate.yml`, `rls-check.yml`                                                       |
| GCP / Cloud Run | `deploy.yml`, `container-scan.yml`, `health-check.yml` (partial)                              |
| Quality         | `format-check`, `codeql`, `dependency-review`, `npm-audit`, `lighthouse-ci`                   |
| Meta            | `auto-merge`, `bug-to-issue`, `stale`, `release-please`, `admin-setup`, `copilot-setup-steps` |
| Incoming        | `mongo-up.yml` (scaffold PR)                                                                  |

### 8.2 Hosting truth (D15)

| Doc                                      | Claim                                                    |
| ---------------------------------------- | -------------------------------------------------------- |
| `docs/adr/ADR-001-canonical-platform.md` | **Vercel Option B ACCEPTED**                             |
| `docs/CANONICAL_PRODUCTION.md`           | Vercel canonical; www on Vercel; apex still Cloud Run    |
| `README.md`                              | Still says Cloud Run is canonical — **stale**            |
| Phoenix                                  | Hosting cutover Cloud Run → Vercel — aligns with ADR-001 |

Vercel project: `manguprojectz`. Prod URL: `https://www.mangu-publishers.com`. Stripe webhook target already documents `/api/webhook` on www.

### 8.3 Remnants

- `amplify.yml` / `AMPLIFY_READY.md` — legacy AWS Amplify path.
- `.bolt/` — Bolt scaffolding remnant.

---

## 9. Test baseline (re-run 2026-07-18 @ `9320407`)

### 9.1 Jest

```
Test Suites: 1 failed, 23 passed, 24 total
Tests:       122 passed, 122 total
Exit: 1
```

- Failure: `tests/unit/BookCard.test.tsx` — `TypeError` inside `react-dom/client` under react-dom@19 (suite does not load; ~5 tests not counted).
- Prior recon (`464edaa`): 24/24, 127/127 — **floor has worsened on main** due to Dependabot react-dom major (D11).
- **Rule:** No Phoenix PR may go below the _pre-skew_ floor once D11 is fixed; until then, do not merge further majors.

### 9.2 Playwright

- 5 spec files, **213 tests** across chromium/firefox/webkit (listed).
- `playwright.config.ts` `webServer.command = npm run dev` → runs `validate-env` → needs real/mocked env.
- Local e2e not runnable as baseline without secrets; CI (`e2e.yml`) uses `USE_MOCKS=true` + placeholder Supabase JWTs (D7).

### 9.3 Unit coverage areas (for WS5 rewrite)

Admin/partner hardening, auth-flow fixes, author-ownership, rate limits, portal/public queries, reading entitlement, Stripe server, MCP security, migration SQL tests, product-truth.

---

## 10. Architecture notes that affect Phoenix design

1. **Edge middleware already talks to Supabase over HTTP** — pattern proves Edge-safe remote checks work, but Mongo driver cannot replace them. Prefer signed role cookie or coarse gating (briefing §5).
2. **Defense in depth already exists** for admin (`middleware` + `app/admin/layout.tsx` `requireAdmin`). Keep that pattern with Better Auth `auth.api.getSession`.
3. **Catalog queries use `unstable_cache` + admin client** (bypass RLS inside cache) — Mongo rewrite must preserve published/public filters.
4. **Rate limiting is more mature than Phoenix WS6 sketch** — buckets for auth/upload/api/analytics/webhook with fail-closed Upstash. WS6 should **align constants** (doc: 100/60 API, 10/60 auth) rather than duplicate `lib/ratelimit.ts` filename — live file is `lib/rate-limit.ts` (D16).
5. **Resonance / MCP / analytics** are in-scope for Supabase purge even if Mongo schemas are thinner than Postgres — decide retention (Phoenix: analytics trailing 30 days only).
6. **Forced password reset** — never migrate bcrypt; scaffold `account.password = "!locked:<uuid>"` per doc. Login banner + `scripts/request-password-reset.ts` + batch sender are greenfield.
7. **Feature freeze** active per Phoenix; README still advertises Phase 2+ features — ignore for migration PRs.

---

## 11. Delta list (doc X / repo Y / resolution Z)

| #   | Doc says                                                   | Repo has                                                        | Resolution                                                                    |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| D1  | App Router                                                 | App Router ✅ + dead `pages/_document.tsx`                      | Delete in WS4                                                                 |
| D2  | `lib/mongo.ts`                                             | Scaffold `lib/mongodb.ts` + `getDb()`                           | Reuse; amend doc filename                                                     |
| D3  | `db:mongo:up\|ping\|indexes`                               | On scaffold only                                                | Adopt in WS2a                                                                 |
| D4  | `NEXT_PUBLIC_APP_URL`                                      | `NEXT_PUBLIC_SITE_URL` everywhere                               | Keep SITE_URL; amend §9.1                                                     |
| D5  | §9.1 = 14 vars                                             | Also OpenAI, Stripe publishable, Sentry build trio              | Amend §9.1                                                                    |
| D6  | Real `.env.example`                                        | Stub pointer                                                    | Rebuild WS4                                                                   |
| D7  | E2E baseline local                                         | Needs secrets / CI placeholders                                 | CI is e2e SoR; human gate for live e2e                                        |
| D8  | WS3 `access:'public'` blobs                                | —                                                               | Product decision: private Blob + proxy vs public UUID paths (flagged PR #239) |
| D9  | Roles `reader\|author\|editor\|admin`                      | Live `reader\|author\|partner\|admin`                           | **Amend Phoenix** to match live product                                       |
| D10 | `avg_rating`, `manuscript_url`, `stripe_payment_intent_id` | `average_rating`, multi-table files, `payment_intent_id`        | Amend types/transform contract                                                |
| D11 | CI green                                                   | react 18 / react-dom 19 skew; BookCard fail; `npm ci` peer fail | Pin/fix versions before WS1 merge                                             |
| D12 | Protect `/dashboard*`                                      | Dashboard not in middleware matcher list                        | Add in WS1 middleware or delete dead routes                                   |
| D13 | Cookie-only Edge session                                   | Live Edge does Auth+REST role fetch                             | Redesign WS1 per briefing §5                                                  |
| D14 | Migrate covers + manuscripts                               | 3 buckets incl. `published-epubs`                               | Expand `migrate-storage.ts` scope in doc                                      |
| D15 | Vercel cutover                                             | ADR-001 done; README still Cloud Run                            | Update README in WS4; DNS = human                                             |
| D16 | `lib/ratelimit.ts`                                         | `lib/rate-limit.ts` already                                     | Reuse; amend doc path + tune limits in WS6                                    |

---

## 12. Recommended execution notes (for next agent)

1. **Fix D11 first** (chore PR) so Jest returns to 24/24 — otherwise every Phoenix PR fights a red BookCard.
2. **Amend Phoenix doc** for D2, D4, D5, D9, D10, D14, D16 in a `docs:` commit (same PR as recon or tiny follow-up) before coding WS1 roles wrong.
3. **WS1** replaces auth actions + Better Auth handler + cookie-only middleware; leave data queries on Supabase until WS2.
4. **Reuse PR #234** scaffold rather than re-implement Atlas scripts.
5. Maintain `HUMAN_TASKS.md` (does not exist yet — create at first human gate).
6. Merge order remains: Recon → WS1 → WS2a–d → WS3 → WS4 → WS5 → WS6.

---

## 13. File-system map (quick reference)

```
app/           App Router (auth, consumer, portals, admin, api, checkout, dashboard)
components/    84 TSX — ui, home, books, admin, analytics, seo, providers, …
lib/           actions, supabase, stripe, rate-limit, resonance, email, middleware, utils
types/         database.ts (Supabase generated shape) + domain types
supabase/      25 SQL migrations (legacy)
scripts/       env, seed, migrate, GCP, Stripe, verify-*
tests/         unit (23 files) + e2e (5) + k6
docs/          PROJECT_PHOENIX.md (contract), NEXT_GO.md (launch authority), ADRs, …
.github/       19 workflows
```

---

_Phase 0 deep dive complete (refresh of PR #239 recon against `9320407`). Next unblocked engineering: D11 react-dom pin, then Phoenix doc amendments, then WS1 Auth._
