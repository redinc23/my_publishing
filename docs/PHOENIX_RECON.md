# PHOENIX RECON — Phase 0 Deep Dive

**Per:** `CLAUDE.md` §3 · **Contract:** `docs/PROJECT_PHOENIX.md` v4.0  
**Baseline commit:** `main` @ `9320407` · **Date:** 2026-07-18  
**Supersedes:** prior recon @ `464edaa` (counts/baselines refreshed)

**Verdict:** Migration has **not** started on `main`. Zero MongoDB / Better Auth / Vercel Blob application code is merged. Scaffolding exists only on `origin/cursor/mongodb-scaffold-dffa` (6 commits, 27 files). Phoenix doc App Router assumptions hold. Deltas in §11.

---

## 0. Executive snapshot

| Dimension | Reality on `main` |
| --------- | ----------------- |
| Product | Mangu Publishers — Netflix-style digital publishing (books, comics, papers, audio) |
| Framework | Next.js **14.2.35** App Router (Node `>=22`) |
| Auth / DB / Storage | **Supabase** Auth + Postgres (RLS) + Storage |
| Payments | Stripe Checkout + webhook |
| Rate limit | Upstash Redis (`@upstash/ratelimit` 1.1.3) — already live |
| Email | Resend present; many templates gated on `RESEND_API_KEY` |
| Observability | Sentry (`@sentry/nextjs` ^8) + health/live probes |
| Hosting (canonical) | **Vercel** per `docs/CANONICAL_PRODUCTION.md` / ADR-001; Cloud Run + Amplify retained as standby/legacy |
| Prod domain | `https://www.mangu-publishers.com` |
| Package | `mangu-publishers@1.0.1` |
| Phoenix progress | Recon only; WS1–WS6 not started on `main` |

**README drift:** Root `README.md` still says Cloud Run is canonical and lists Next 14.2.3 — contradicts ADR-001 / CANONICAL_PRODUCTION. Fix in WS4 docs cleanup (or earlier docs PR).

---

## 1. Routing reality

### 1.1 Authoritative router

**App Router is authoritative.** `app/` owns all product routes.

`pages/` contains exactly one file — `pages/_document.tsx` — a Pages Router `Document` that App Router never renders. Dead code → Delta **D1** (delete in WS4).

`vercel.json`:

```json
{ "buildCommand": "npm run build", "devCommand": "npm run dev", "framework": "nextjs", "regions": ["iad1"] }
```

Routing-neutral. Phoenix paths (`app/api/...`, `app/(auth)/actions.ts`) are correct. **No doc amendment for WS1 file paths.**

### 1.2 Route inventory (counts)

| Kind | Count |
| ---- | ----: |
| `page.tsx` | 58 |
| `route.ts` (all under `app/`) | 17 |
| `layout.tsx` | 6 |
| Colocated `actions.ts` | 8 |
| `lib/actions/*.ts` | 12 |
| Route groups | 3: `(auth)`, `(consumer)`, `(portals)` |

### 1.3 Route map by domain

**Root:** `/` home, `sitemap.ts`, `robots.ts`, OG/Twitter images, `error`/`global-error`/`not-found`/`loading`.

**Auth `(auth)/`:** `/login`, `/register`, `/verify-email`, `/reset-password`, `/reset-password/confirm`, `/callback` (OAuth/code exchange).

**Consumer `(consumer)/`:** catalog (`/books`, `/books/[slug]`, genres, authors, comics, papers, audio), discovery, library, reading (`/reading/[bookId]`), legal/marketing pages (about, contact, privacy, terms, …).

**Admin `/admin/*`:** dashboard, books CRUD, users, orders, manuscripts, health — gated by `requireAdmin` in layout.

**Portals `(portals)/`:** author (`/author/dashboard|projects|submit|analytics`), partner (`/partner/dashboard|catalogs|arc-requests|orders`).

**Other:** `/checkout`, `/dashboard/my-reviews`, `/dashboard/books/[id]/analytics`, `/users/[userId]/reviews`.

### 1.4 Layout / providers

```
app/layout.tsx (Inter font, Header/Footer, DNS-prefetch supabase)
  └── Providers → ThemeProvider (default dark) → AuthProvider (Supabase) → ToastProvider
      ├── (auth)/layout.tsx — centered auth shell
      ├── (consumer)/layout.tsx — passthrough
      ├── (portals)/layout.tsx — passthrough
      └── admin/layout.tsx — force-dynamic + AdminSidebar (nested <main>)
```

**Quirk:** root and admin both wrap `<main>` → double `<main>` on admin routes.

---

## 2. Migration branch inventory (`cursor/mongodb-scaffold-dffa`)

```
git log origin/main..origin/cursor/mongodb-scaffold-dffa → 6 commits
git diff --stat → 27 files, +1764 / −56
```

| Asset | Notes |
| ----- | ----- |
| `lib/mongodb.ts` + `lib/mongodb-config.ts` | Client singleton (doc says `lib/mongo.ts` → **D2**) |
| `lib/db/provider.ts` | `DATABASE_PROVIDER` toggle |
| `scripts/atlas-bootstrap.ts`, `mongo-up|ping|ensure-indexes|import-uri.ts`, `sync-mongodb-to-vercel.ts`, `scripts/lib/atlas-admin.ts`, `env-file.ts` | Fulfills doc `db:mongo:up|ping|indexes` (P5.x) |
| `.github/workflows/mongo-up.yml` | Atlas bootstrap workflow |
| `docs/adr/ADR-002-mongodb-data-platform.md` | Decision record |
| `package.json` adds | `mongodb`, `digest-fetch`, `@vercel/functions`; scripts `db:atlas:bootstrap`, `db:mongo:*` |
| `app/api/health/route.ts` | Mongo-aware readiness (overlaps WS4) |
| Unit tests | `mongodb-client`, `db-provider`, `env-file` |

**Absent on branch:** `better-auth`, `@vercel/blob`, `types/mongo.ts`, `lib/mongo-queries.ts`, app data-layer cutover, Supabase purge.

**Resolution:** Cherry-pick / rebase scaffold infra into WS2a / WS4; do not rewrite Atlas scripts. Note: scaffold still pins older `openai@^4` while `main` has `^6.48` — resolve on merge.

---

## 3. package.json audit (`main`)

### Present

| Package | Role | Phoenix fate |
| ------- | ---- | ------------ |
| `@supabase/ssr` ^0.12.3, `@supabase/supabase-js` ^2.110.7 | Auth/DB/Storage | **Remove WS4** |
| `@upstash/ratelimit` 1.1.3, `@upstash/redis` ^1.32.0 | Rate limit | Keep (WS6 may retarget paths) |
| `resend` ^3.2.0 | Email | Keep |
| `stripe` ^14.25, `@stripe/stripe-js` | Payments | Keep |
| `@sentry/nextjs` ^8.55 | Errors | Keep / harden WS6 |
| `openai` ^6.48 | Embeddings / Resonance | Keep (optional) |
| Next 14.2.35, React 18.3.1, Jest 30, Playwright | App + tests | Keep |

### Absent (add per workstream)

| Package | When |
| ------- | ---- |
| `better-auth` | WS1 |
| `mongodb` (^7.5 from scaffold) | WS2a |
| `@vercel/blob` | WS3 |

### Dependency smells (non-blocking for Phoenix, note for hygiene)

- **`react@18.3.1` vs declared `react-dom@19.2.7`** — lockfile resolves to 18.3.1 marked invalid; `@types/react` 18 vs `@types/react-dom` 19.
- Dual chart stacks: `chart.js` + `recharts` + `d3`.
- No `db:mongo:*` scripts on `main` (only on scaffold) → **D3**.

---

## 4. Auth & data surface (WS1–WS2d blast radius)

`rg -li supabase app lib components types middleware.ts` → **97 files**, **~647 hits**.

### 4.1 Core clients (delete WS4)

`lib/supabase/{client,server,admin,edge-auth,queries,public-queries,portal-queries,author-ownership}.ts`

| Client | Runtime | Notes |
| ------ | ------- | ----- |
| `client.ts` | Browser | Anon key |
| `server.ts` | RSC / actions | Anon + cookies |
| `admin.ts` | Node | Service role; public catalog uses this intentionally (RLS workaround) |
| `edge-auth.ts` | Edge middleware | REST fetch JWT + `profiles.role` — **no Node Mongo driver** (pattern to preserve in WS1) |

### 4.2 Auth flows (WS1)

| Path | Behavior |
| ---- | -------- |
| `app/(auth)/login/actions.ts` | `signInWithPassword` + rate limit |
| `app/(auth)/register/actions.ts` | `signUp` + profile trigger/fallback |
| `app/(auth)/reset-password/actions.ts` | `resetPasswordForEmail` |
| `app/(auth)/verify-email/actions.ts` | Resend verification |
| `app/(auth)/callback/route.ts` | `exchangeCodeForSession` |
| `middleware.ts` + `lib/middleware/auth.ts` | Cookie session + RBAC |
| `components/providers/auth-provider.tsx` | Client session |
| `app/api/session/route.ts` | Session JSON |

### 4.3 Middleware auth model (critical for WS1)

Current Edge middleware:

1. Rate-limit auth APIs / auth page POSTs / uploads (fail-closed).
2. Cookie JWT via `getEdgeAuthUser` (no DB driver).
3. Protect: `/reading*`, `/library*`, `/author*`, `/partner*`, `/admin*`.
4. RBAC via `profiles.role`: admin / author|admin / partner|admin.
5. Roles in DB: `reader` | `author` | `partner` | `admin`.

**Phoenix doc** lists roles `reader|author|editor|admin`. Repo has **`partner`**, not `editor` → Delta **D9**.

**Phoenix WS1 guardrail:** middleware must stay cookie-only (`getSessionCookie`); fine RBAC in server layouts/handlers. Current edge-auth REST role fetch must be replaced carefully (signed role cookie **or** coarse gate + server RBAC).

**Protected paths gap vs doc:** doc mentions `/dashboard*` and `/api/files*`. Today `/dashboard*` is **not** middleware-protected; `/api/files*` does not exist yet (WS3).

### 4.4 Data / actions (WS2)

`lib/actions/`: books, reviews, upload, reading-list, follows, partner, revenue, payouts, analytics, export-data, ai-insights, users.

API routes: webhook, checkout, upload, health, live, session, analytics/*, resonance/*, newsletter, mcp.

### 4.5 Critical ID model (load-bearing for transform scripts)

```
auth.users.id  ──1:1──►  profiles.user_id
profiles.id    ◄──FK──  orders.user_id, reading_progress.user_id, …
authors.profile_id ──► profiles.id
books.author_id    ──► authors.id   (NOT auth.uid())
```

Checkout metadata stores **auth** `user_id`; webhook resolves to `profiles.id` before writing orders. Transform script (P11.2) must preserve this chain.

### 4.6 Stripe webhook (as-is vs Phoenix)

- Canonical: `POST /api/webhook`; alias `/api/webhooks/stripe`.
- Idempotency today: `webhook_events` table + soft order lookup by `payment_intent_id`.
- Phoenix requires: unique sparse index on `orders.stripe_payment_intent_id` + upsert `$setOnInsert`.
- Live field is `orders.payment_intent_id` (not `stripe_payment_intent_id`) → Delta **D10**.

---

## 5. Database schema (Supabase)

### 5.1 Migrations (25 files)

Chronological highlights:

| Migration | Purpose |
| --------- | ------- |
| `20260116000000_initial_schema` | Core: profiles, authors, books, book_content, reading_*, resonance, manuscripts, partners, orders, subscriptions, RPCs, extensions (`vector`, `pg_trgm`, `unaccent`) |
| `20260117*` | Analytics partitions, book_stats, book_sales, payouts, pricing, storage buckets |
| `20260118000000_critical_fixes` | webhook_events, export_jobs, rate_limits, policies |
| `20260121000000_profile_trigger` | `handle_new_user` |
| `20260122000000_social_features` | reviews, votes, comments, follows, reading_lists |
| `20260619*` | `content_type`, retailer URLs |
| `20260708*` / `20260717*` | RLS harden, protect role, public authors, order_items SELECT |

Storage buckets: `book-covers` (public), `manuscripts` (private), `published-epubs` (public).

### 5.2 Types lag

`types/database.ts` is **hand-maintained and stale** vs live migrations (missing columns/tables: reviews, analytics_*, payouts, webhook_events, etc.). Do not treat it as migration source of truth — use SQL migrations + live export for P11.

---

## 6. API surface (complete)

| Route | Methods | Purpose |
| ----- | ------- | ------- |
| `/api/live` | GET | Liveness (`alive`) for Cloud Run |
| `/api/health` | GET | Readiness: env + Supabase + Stripe composite |
| `/api/session` | GET | Current user + profile |
| `/api/checkout` | POST | Stripe Checkout session |
| `/api/upload` | POST | Storage upload |
| `/api/newsletter` | POST | Resend subscribe |
| `/api/webhook` | POST | Stripe webhook |
| `/api/webhooks/stripe` | * | Re-export of webhook |
| `/api/analytics/track` | POST | Event ingest |
| `/api/analytics/stream` | GET | Live analytics |
| `/api/resonance/{track,similar,recommend,embed}` | * | Engagement / recs / embeddings |
| `/api/mcp/[transport]` | GET/POST/DELETE | MCP catalog tools (`MCP_ENABLED`) |
| `/callback` | GET | Auth code exchange |
| `/partner/orders/export` | GET | Partner CSV |

---

## 7. Scripts & tooling

### 7.1 npm scripts (`main`)

`validate-env`, `dev`, `build`, `start`, `lint`, `type-check`, `test`, `test:e2e`, `db:seed`, `db:migrate`, `verify-rls`.

**No** `db:mongo:*` on main → adopt from scaffold (**D3**).

### 7.2 Notable scripts

| Script | Purpose | Phoenix fate |
| ------ | ------- | ------------ |
| `setup.sh` (root) | Bootstrap / env / install | Keep; scrub Supabase later |
| `pre-launch-verify.sh` | Local GO gates | Update for Mongo/Better Auth in WS4/5 |
| `scripts/run-migrations.ts`, `seed-database.ts`, `verify-rls.ts` | Supabase ops | Retire WS4 |
| `scripts/*gcp*` | Cloud Run secrets/deploy | Standby until Phase 13/14 |
| Scaffold `mongo-*` / `atlas-bootstrap` | Atlas ops | Adopt WS2 |

### 7.3 Missing Phoenix scripts (agent owns; humans run)

Per briefing §11 — none exist yet:

1. `scripts/export-supabase.sh`
2. `scripts/transform-data.ts`
3. `scripts/migrate-storage.ts`
4. `scripts/export-delta.ts`
5. `scripts/send-forced-resets.ts`
6. `scripts/verify-migration.mongo.js`
7. `scripts/request-password-reset.ts` (WS1)

---

## 8. Env examples vs Phoenix §9.1

| Source | Contents |
| ------ | -------- |
| `.env.example` | One-line stub pointing at `.env.local.example` → **D6** |
| `.env.local.example` | Supabase×3, Stripe×3, `NEXT_PUBLIC_SITE_URL`, Upstash×2, Sentry×5, optional OpenAI/Resend, `USE_MOCKS`/`SKIP_EMAILS` |
| `.env.production.example` | Same required set; fewer Sentry build vars |

**Missing vs §9.1:** `MONGODB_URI`, `DATABASE_PROVIDER`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY` (commented only), `NEXT_PUBLIC_APP_URL`.

**Naming conflict:** repo uses `NEXT_PUBLIC_SITE_URL` everywhere; doc says `NEXT_PUBLIC_APP_URL` → **D4** (keep SITE_URL; amend doc).

**Undocumented in §9.1 but live:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, Sentry ORG/PROJECT/AUTH_TOKEN, `USE_MOCKS`, `SKIP_EMAILS` → **D5**.

**`next.config.js` hardcodes** fallback Supabase URL + anon JWT for prerender — must be removed in WS4 (and is a secret-hygiene smell even though anon).

---

## 9. CI inventory (19 workflows)

### Supabase / GCP touching (WS4 retires or scrubs)

| Workflow | Role |
| -------- | ---- |
| `supabase-migrate.yml` | `supabase db push` |
| `rls-check.yml` | `npm run verify-rls` |
| `deploy.yml` | Cloud Run deploy after CI |
| `health-check.yml` | Prod `/api/live` + `/api/health?ready=1` every 15m |
| `ci.yml` | validate-env, tsc, lint, Jest, build (mock Supabase secrets) |
| `e2e.yml` / `preview-e2e.yml` | Playwright |
| `container-scan.yml` | Docker + Trivy |
| `copilot-setup-steps.yml` | Placeholder Supabase env |

Also: root `cloudbuild.yaml`, `Dockerfile`, `amplify.yml` (legacy).

### Neutral (keep)

`format-check`, `codeql`, `dependency-review`, `npm-audit`, `lighthouse-ci`, `auto-merge`, `bug-to-issue`, `stale`, `release-please`, `admin-setup`.

### Incoming from scaffold

`mongo-up.yml`.

### WS5 extension points

`ci.yml` (Jest), `e2e.yml` / `preview-e2e.yml` (Playwright).

---

## 10. Test baseline (2026-07-18, `main` @ `9320407`)

### Jest

```
Test Suites: 24 passed, 24 total
Tests:       127 passed, 127 total
Time:        ~2.2s
```

One pre-existing worker-teardown warning (benign). **Floor: no WS PR may go below 24/127.**

Unit coverage domains: auth rate-limit, admin/partner hardening, book ownership, reading entitlement, Stripe helpers, public query projections, migration SQL text assertions, BookCard, MCP security, product-truth (newsletter/contact honesty).

### Playwright

**Not runnable locally** without real Supabase secrets (`npm run dev` → `validate-env`). Specs exist:

- `auth-flow.spec.ts`, `purchase-flow.spec.ts`, `role-gating.spec.ts`, `smoke-auth.spec.ts`, `smoke-stripe.spec.ts`
- Real-backend suites self-skip without real Supabase URL

E2E baseline of record = CI (`e2e.yml` / `preview-e2e.yml`). Local e2e = human gate → `HUMAN_TASKS.md` (**D7**).

### k6

`tests/k6/load-test.js` — optional load; not in PR-required CI.

---

## 11. Delta list (doc ↔ repo)

| # | Doc says | Repo has | Resolution |
| - | -------- | -------- | ---------- |
| D1 | App Router | App Router ✅ + vestigial `pages/_document.tsx` | Delete in WS4 |
| D2 | `lib/mongo.ts` | Scaffold: `lib/mongodb.ts` + provider | Reuse scaffold; export `getDb()`; amend doc filename |
| D3 | `db:mongo:up\|ping\|indexes` | Absent on main; present on scaffold | Adopt in WS2a |
| D4 | `NEXT_PUBLIC_APP_URL` | `NEXT_PUBLIC_SITE_URL` wired throughout | Keep SITE_URL; amend §9.1 |
| D5 | §9.1 lists 14 vars | Also Stripe publishable, OpenAI, Sentry build trio, mocks | Amend §9.1 |
| D6 | Real `.env.example` | Stub | Rebuild WS4 |
| D7 | E2E baseline | Not runnable without secrets | CI = baseline; human gate for local |
| D8 | WS3 `access: 'public'` on blobs | — | Needs doc decision: manuscripts shareable if URL leaks despite gated `/api/files` |
| D9 | Roles `reader\|author\|editor\|admin` | Roles `reader\|author\|partner\|admin` | Amend Phoenix FRD/tech spec to match `partner` (or explicitly rename — product decision) |
| D10 | `orders.stripe_payment_intent_id` | `orders.payment_intent_id` + `webhook_events` | Map field on transform; implement Phoenix upsert contract in WS2b |
| D11 | Middleware protects `/dashboard*` | `/dashboard*` not gated today | Add in WS1 or document intentional public reviews analytics |
| D12 | README / FEATURE_PHASES say Amplify or Cloud Run canonical | ADR-001 = Vercel | Docs cleanup WS4 |
| D13 | Rate limit file `lib/ratelimit.ts` | Exists as `lib/rate-limit.ts` (already sophisticated) | Reuse / rename in WS6; amend doc path |

---

## 12. Components & UI (brief)

17 component domains (~90 files): `ui/` (shadcn/Radix), `home/`, `books/`, `analytics/`, `shared/` (Header/Footer/Nav), `animation/`, `cards/`, `providers/`, `players/`, `seo/`, portals/admin/social/forms.

Theme: **dark-first** (`defaultTheme="dark"`), Inter font, Framer Motion. Phoenix scope: data-fetching swap only — no UI rewrite.

---

## 13. Observability & security (as-is)

- **CSP** in `next.config.js` allowlists `*.supabase.co` (WS3/4 must add Blob + remove Supabase).
- **Rate limits** already fail-closed in prod; buckets: auth 5/60s, authAction 5/15m, upload/api 30/60s, webhook 1000/60s.
- **Sentry** conditional on DSN; source maps gated on `SENTRY_AUTH_TOKEN`.
- **Health:** `/api/health?ready=1` is the GO probe (CANONICAL_PRODUCTION).

---

## 14. Human gates logged

See `HUMAN_TASKS.md` (created with this recon). Immediate:

- Local Playwright baseline against real Supabase (D7).
- Product decision on D8 (blob public access) and D9 (partner vs editor).
- All console/credential gates from Phoenix §10 remain human-owned.

---

## 15. Recommended next step

**WS1 Auth (PR #1)** per briefing §4 / Phoenix §6, after merge of this recon:

1. Add `better-auth` + Mongo adapter (depends on adopting scaffold `getDb` early, or stub adapter DB until WS2a merges — prefer landing WS2a client first if sequencing allows; briefing order is WS1 then WS2 — follow waterfall: WS1 may need minimal mongo client cherry-pick).
2. Replace middleware with cookie-only session check; move RBAC to server.
3. Forced-reset banner + `scripts/request-password-reset.ts`.
4. Do **not** migrate password hashes.

---

_Phase 0 deep dive complete. Next: WS1 (Auth, PR #1) pending merge of this report._
