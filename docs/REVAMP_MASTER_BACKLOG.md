# MANGU Publishers — Master Revamp Backlog (End-to-End)

> **Purpose:** A single, deep, verified inventory of *everything left to revamp* in the
> platform **excluding** the "environment secrets → local `.env` wiring" operator task,
> which is tracked separately (see `docs/CANONICAL_PRODUCTION.md` and the RICEF Inputs
> section). This document is about the **product, the code, the infrastructure config,
> the docs, security, and testing** — not about pasting keys into dashboards.
>
> **Method:** This was produced by reading the actual source tree and *running the
> toolchain* on the current `main`, not by trusting the older status docs (many of which
> are stale or contradict the code). Where a claim is verified by a command, it says so.

---

## 0. TL;DR — the shortlist

If you only fix a handful of things, fix these first:

1. **`npm run type-check` is currently RED on `main`.** A stray, git-tracked test file
   `lib/supabase/queries.test.ts` lives inside `lib/` (which `tsconfig` type-checks),
   but `@types/jest` is not installed and `tests/` is the only excluded dir. `tsc --noEmit`
   exits non-zero. This means the CI `test` job fails at the `type-check` step before it
   ever builds. **This blocks every PR merge gate.**
2. **The core "read a book" experience is a stub.** `/reading/[bookId]` renders the literal
   text *"Reading interface coming soon."* For a "Netflix for books," the single most
   important post-purchase screen is not implemented.
3. **A complete reviews system is built but not wired in.** `ReviewSection`, `ReviewForm`,
   `ReviewCard`, `ReviewStats`, server actions, and DB migrations all exist — yet
   book/comic/paper detail pages render *"Reviews coming soon."*
4. **The entire Partner portal is stubbed** (dashboard, catalogs, orders, ARC requests all
   say "coming soon").
5. **17 npm vulnerabilities (10 high, 5 moderate, 2 low)** from `npm ci`, plus a batch of
   deprecated/abandoned transitive deps (notably the `@react-email/*` stack).
6. **Revenue is displayed 100× too large** in the book analytics overview (double
   cents-conversion bug).

Everything below expands on these and the long tail.

---

## 1. Verified current health (ran on `main`, this session)

| Gate | Command | Result |
|------|---------|--------|
| Dependencies | `npm ci` | ✅ installs (exit 0) — **but 17 vulns: 10 high / 5 moderate / 2 low** |
| Lint | `npx next lint` | ✅ `No ESLint warnings or errors` |
| Unit tests | `npx jest` | ✅ 6 suites / 25 tests pass |
| Production build | `next build` (placeholder public env) | ✅ compiles standalone; middleware 102 kB |
| **Type-check** | `tsc --noEmit` | ❌ **FAILS** — 19 errors in `lib/supabase/queries.test.ts` |

**Why type-check fails while tests pass:** Jest compiles via `next/jest` (SWC, no type
enforcement) and injects `jest`/`describe`/`it`/`expect` globals at runtime, so the suite
runs green. `tsc --noEmit` does *not* get those globals (no `@types/jest`) and the offending
file is under `lib/`, which `tsconfig` includes. The canonical copy of the same test lives
at `tests/unit/queries.test.ts`, and `tests/` **is** excluded — so `lib/supabase/queries.test.ts`
is a misplaced duplicate that should be deleted (or `@types/jest` added and the tsconfig
scope tightened).

---

## 2. Blocker tier (P0 — breaks the merge/deploy gate or a core flow)

### P0-1 — Type-check break on `main`
- **Files:** `lib/supabase/queries.test.ts` (stray), `tsconfig.json` (`exclude: ["node_modules","tests"]`), `package.json` (no `@types/jest`).
- **Symptom:** `npm run type-check` → exit 2; 19 `TS2304 Cannot find name 'jest'/'describe'/'it'/'expect'` errors.
- **Fix options (pick one):**
  - Delete `lib/supabase/queries.test.ts` (the real one is `tests/unit/queries.test.ts`), **or**
  - Add `@types/jest` to devDependencies and add `"types": ["jest","node"]` / include test globals, and ensure all `*.test.ts` live under the excluded `tests/` dir.
- **Impact if unfixed:** CI red on every push; no clean merge gate; contributors can't trust green.

### P0-2 — Core reading experience is a placeholder
- **File:** `app/(consumer)/reading/[bookId]/ReadingClient.tsx` (line ~57).
- **State:** Server page + `saveReadingProgress` autosave server action + `ProgressBar` chrome
  are wired, but the content pane literally says *"Reading interface coming soon. This will
  display the book content based on the current position."* Prev/Next buttons only increment a
  `%` counter; no actual book content (EPUB/HTML/paged) is rendered.
- **Needs:** content delivery (EPUB/HTML renderer or paginated chapters), entitlement check
  (does the user own the book?), real position model (chapter/locator, not a 0–100 int),
  bookmarks, font/theme controls, mobile reader UX.
- **Note:** `docs/FEATURE_PHASES.md` claims this is "✅ fully implemented" — **that is false**;
  docs contradict code.

### P0-3 — Reviews system built but not mounted
- **Built & unused on detail pages:** `components/books/ReviewSection.tsx`, `ReviewForm.tsx`,
  `ReviewCard.tsx`, `ReviewStats.tsx`, `ReviewFilters.tsx`, `StarRating.tsx`, `ReviewActions.tsx`;
  server actions in `lib/actions/reviews.ts`; tables via `20260122000000_social_features.sql`.
- **Where it's missing:** `app/(consumer)/books/[slug]/page.tsx` (Reviews tab → "Reviews coming soon"),
  `app/(consumer)/comics/[slug]/page.tsx`, `app/(consumer)/papers/[slug]/page.tsx`.
- **Where it IS used:** `app/users/[userId]/reviews/page.tsx` and `app/dashboard/my-reviews/page.tsx`
  render `ReviewCard`. So the plumbing works — the book detail Reviews tab just needs
  `<ReviewSection bookId=... />` dropped in.
- **Also incomplete inside reviews:** `reportReview()` only `console.log`s — no moderation record
  is created (`lib/actions/reviews.ts`). Moderation queue is unbuilt.

### P0-4 — Partner portal is entirely stubbed
- **Files (all "coming soon"):** `app/(portals)/partner/dashboard/page.tsx`,
  `partner/catalogs/page.tsx`, `partner/orders/page.tsx`, `partner/arc-requests/page.tsx`.
- **Exception:** `partner/orders/[id]/page.tsx` is a real detail page — so the *list* pages are
  empty shells while a *detail* page exists (inconsistent, likely dead link surface).
- **Middleware already gates `/partner` by role** (`middleware.ts`), so the access layer is ready;
  the feature layer is not.

### P0-5 — Revenue displayed 100× too large (money bug)
- **File:** `components/analytics/AnalyticsOverview.tsx`.
- **Bug:** `revenue: revenue.total * 100` (comment says "Convert to cents") is stored in state,
  then rendered as `formatCurrency(stats.revenue * 100)`. `formatCurrency` (`lib/utils/currency.ts`)
  itself divides by 100. Net effect: `dollars * 100 * 100 / 100 = dollars * 100`. A $12.00 book shows
  as **$1,200.00**. Fix by passing cents exactly once.

---

## 3. Feature completeness matrix (what's real vs. shell)

Legend: **Real** = fetches/uses live data; **Wired-stub** = chrome exists, content stubbed;
**Unwired** = component/action exists but nothing imports it; **Shell** = "coming soon" page.

| Area | Route / module | Status | Notes |
|------|----------------|--------|-------|
| Auth (login/register/reset/verify) | `app/(auth)/**` | **Real** | Server actions + Supabase SSR; needs manual QA |
| Book catalog / search / filters | `app/(consumer)/books/**`, `BookFilters` | **Real** | Dynamic; falls back to mock data when empty |
| Book detail | `books/[slug]/page.tsx` | **Real** except Reviews tab | Retailer links, audio sample, similar books all real |
| Comics / Papers detail | `comics/[slug]`, `papers/[slug]` | **Real** except Reviews tab | Same "Reviews coming soon" gap |
| Reading | `reading/[bookId]` | **Wired-stub** | See P0-2 |
| Audio (audiobook) | `audio/[id]`, `audio/page.tsx` | **Real (thin)** | Plays `content.audio_url`; depends on data having audio |
| Library (purchased) | `library/page.tsx` | **Real** | Reads `orders`→`order_items`→`books` |
| Readers Hub | `readers-hub/page.tsx` | **Shell** | 3 "coming soon" cards; duplicates the real `/library` |
| Checkout | `checkout/page.tsx` + `api/checkout` | **Real** | Server action → Stripe session redirect |
| Payments webhook | `api/webhook/route.ts` | **Real (production-grade)** | Idempotency table, signature verify, refund handling |
| Discover hub | `discover/page.tsx` | **Real (links)** | Links to recommendations + book-clubs |
| Recommendations | `discover/recommendations/page.tsx` | **Placeholder logic** | "For now, return trending books … in production would call resonance API" |
| Book clubs | `discover/book-clubs/page.tsx` | **Shell** | "coming soon" |
| Author dashboard | `author/dashboard/page.tsx` | **Real** but `earnings = 0` hardcoded | Books/manuscripts counts real; earnings not computed |
| Author submit | `author/submit/**` | **Real** | Manuscript form + action |
| Author projects | `author/projects/**`, `projects/[id]` | **Real** | Manuscript detail w/ status |
| Author analytics | `author/analytics/page.tsx` | **Shell** | "Analytics dashboard coming soon!" |
| Admin (dashboard/books/users/orders/manuscripts/health) | `app/admin/**` | **Real** | Health page exposes partial config previews (see §6) |
| Resonance engine API | `api/resonance/*`, `lib/resonance/*` | **Real code, unused by UI** | Embeddings/recommend/similar exist; front-end never calls them |
| Reviews UI | `components/books/Review*` | **Built, partially wired** | See P0-3 |
| Social: follows | `lib/actions/follows.ts` | **Unwired** | No `.tsx` imports it |
| Social: reading lists | `lib/actions/reading-list.ts`, `components/social/ReadingList.tsx` | **Unwired** | Component never imported |
| Social: activity feed | `components/social/ActivityFeed.tsx` | **Unwired** | Component never imported |
| Analytics components | `components/analytics/**` | **Real** but see revenue bug | Heatmap, geography, charts, live readers |

---

## 4. Feature-by-feature deep dive (what "revamp" means per area)

### 4.1 Reading & content delivery (highest product risk)
- Replace the placeholder pane with a real renderer. Decide the content model first:
  `book_content` table exists (joined as `content:book_content(*)`), so confirm what it stores
  (EPUB URL? HTML? chapters?) and build the reader to match.
- Add **entitlement enforcement**: currently `books/[slug]` shows "Start Reading" →
  `/reading/[id]` with no verified purchase/ownership check in the reader path.
- Replace the 0–100 integer position with a durable **locator** (chapter + offset/CFI) so
  "resume where you left off" is meaningful. `ReadingProgress` autosave already exists — the
  data model just needs to be richer.
- Reader UX: pagination/scroll, font size, light/dark/sepia, bookmarks, table of contents,
  keyboard nav, mobile gestures.

### 4.2 Reviews & ratings
- Mount `<ReviewSection>` on book/comic/paper detail Reviews tabs (P0-3).
- Implement `reportReview()` to persist a moderation report (table + admin review queue).
- Confirm `books.average_rating` / rating aggregates update when reviews are created
  (trigger or recompute) — the book hero shows `average_rating` but review writes may not
  recalculate it.
- Add empty/first-review states, spoiler blur (schema has `is_spoiler`), helpfulness sort
  (`review_votes` exists).

### 4.3 Social layer (follows, reading lists, activity)
- Three server actions + two components are dead code. Either **wire them into profile pages
  and a feed**, or **delete them** to reduce surface area and confusion. Current state (built
  but unreferenced) is the worst of both worlds.
- If keeping: add follow buttons on author/user pages, a "My Lists" area, and an activity feed
  on the dashboard/home.

### 4.4 Partner portal (B2B / ARC program)
- Build dashboard KPIs, catalog browsing/requests, order list (a detail page already exists),
  and the ARC request workflow. Define the data model — check whether partner/ARC tables exist
  in migrations; if not, add them.

### 4.5 Author portal completion
- Implement `author/analytics` (the per-book analytics dashboard already exists at
  `dashboard/books/[id]/analytics` and `components/analytics/*` — reuse it, scoped to the author).
- Compute real **earnings** on the author dashboard (there's `lib/actions/revenue.ts` and
  `lib/actions/payouts.ts` + `author_payouts` migration to draw from) instead of `0`.

### 4.6 Discovery & the Resonance (AI) engine
- `discover/recommendations` returns trending books with an inline "in production this would
  call the resonance API" comment. The resonance API routes and `lib/resonance/*` exist but the
  UI never calls them. Revamp = actually call `/api/resonance/recommend` (guarded by
  `OPENAI_API_KEY` presence) with a graceful trending fallback.
- Build `/discover/book-clubs` or remove the entry point.

### 4.7 Audiobooks
- The audio detail page is thin but functional if data has `audio_url`. "Audiobook support" as
  a first-class product (chaptered audio, playback progress, streaming) is not built — matches
  `FEATURE_PHASES.md` "planned." Decide scope.

### 4.8 Email notifications
- `lib/email/send.ts` + `lib/email/templates.tsx` (Resend) exist and are lazy-initialized (no
  build crash). Verify they're actually invoked on the key events (welcome, purchase confirmation,
  manuscript status, password reset). The webhook's `handlePaymentFailed` notes "Could trigger
  email notification here" but doesn't. Wire the triggers; they depend on `RESEND_API_KEY`.

### 4.9 Analytics
- Fix the revenue ×100 bug (P0-5).
- Implement `growthRate` (currently hardcoded `0` with a TODO in `AnalyticsOverview.tsx`).
- Verify the materialized view (`book_stats_materialized`) refresh strategy and that
  `realtime-analytics`/`live` streaming actually has a data source in production.

---

## 5. Code-level defects & cleanup (the long tail)

| # | Item | File(s) | Type |
|---|------|---------|------|
| C-1 | Stray duplicate test breaks `tsc` | `lib/supabase/queries.test.ts` | **Blocker** (P0-1) |
| C-2 | Revenue double-×100 | `components/analytics/AnalyticsOverview.tsx` | **Money bug** (P0-5) |
| C-3 | `growthRate` hardcoded `0` | `components/analytics/AnalyticsOverview.tsx` | TODO |
| C-4 | Upload dedup `hash: ''` | `lib/actions/upload.ts` | TODO |
| C-5 | `reportReview` is a no-op log | `lib/actions/reviews.ts` | Incomplete feature |
| C-6 | Author `earnings = 0` hardcoded | `app/(portals)/author/dashboard/page.tsx` | Incomplete |
| C-7 | Duplicate `ErrorBoundary` | `components/common/ErrorBoundary.tsx` vs `components/shared/ErrorBoundary.tsx` | Dedupe |
| C-8 | Possible duplicate migrations for content_type | `20260619124500_add_content_type_to_books.sql` **and** `20260619162409_add_content_type.sql` | DB risk — verify they're not conflicting/idempotent |
| C-9 | Dead social code | `lib/actions/follows.ts`, `lib/actions/reading-list.ts`, `components/social/*` | Wire or remove |
| C-10 | Unused resonance wiring | `lib/resonance/*`, `api/resonance/*` | Wire or document as API-only |
| C-11 | `/* eslint-disable */` at top of files | `partner/*`, `author/dashboard`, `AnalyticsOverview`, `upload.ts`, `Header.tsx`, etc. | Blanket disables hide real lint signal |
| C-12 | Legacy Pages Router file coexists | `pages/_document.tsx` | Confirm still needed under App Router |
| C-13 | `scripts/setup.ts` is a stated placeholder | `scripts/setup.ts` ("placeholder for real content") | Remove or implement |
| C-14 | Readers Hub duplicates Library | `readers-hub/page.tsx` vs `library/page.tsx` | Consolidate |

---

## 6. Security posture (to revamp, beyond secret wiring)

- **CSP uses `'unsafe-inline'` and `'unsafe-eval'`** in `next.config.js` (script-src). Comment
  already acknowledges this is temporary until nonce-based CSP is wired. Tightening this is a
  real hardening task.
- **Admin health page info exposure:** `app/admin/health/page.tsx` surfaces partial previews of
  config (Supabase URL, Stripe key prefix, booleans for OpenAI/Resend). Any admin sees config
  state; consider trimming in production.
- **npm audit:** 17 vulnerabilities (10 high). Triage with `npm audit`; several stem from the
  deprecated `@react-email/*` chain and old `glob`. Consider replacing/upgrading the email stack.
- **Rate limiting** degrades gracefully without Upstash (null limiter = pass-through). For real
  production protection this needs Upstash configured — a *deployment* input, but the code path
  and tests (`tests/unit/*rate-limit*`) are in place.
- **RLS**: policies exist in migrations; `scripts/verify-rls.ts` exists. Revamp = actually run it
  against the target DB and record results.
- **Secret scanning** in `cloudbuild.yaml` is solid (scans `.next/static`, `.next/server`,
  `public`, plus Trivy CRITICAL image scan). No action needed beyond keeping patterns current.

---

## 7. Infrastructure / deployment (state is actually good — small gaps)

Contrary to the older plans, the deploy story is largely resolved:

- **Canonical prod decided:** Cloud Run via `cloudbuild.yaml` (see `docs/CANONICAL_PRODUCTION.md`,
  dated 2026-05-19). Vercel is optional-secondary; Amplify is legacy.
- **`cloudbuild.yaml` is mature:** npm ci → lint+type-check → build → **perf budget (250 kB gz)** →
  secret audit → docker build (`:SHORT_SHA` **and** `:main`) → push → **Trivy CRITICAL scan** →
  deploy with **startup + liveness probes on `/api/live`** → verify. Required secrets
  (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are wired; optional
  ones (Resend/OpenAI/Upstash) are conditionally attached if the secret exists.
- **Dockerfile:** multi-stage Node 20 alpine, standalone, non-root, **`COPY public` restored**.
- **CI (`ci.yml`):** Node from `.nvmrc`, `@v4` actions, `USE_MOCKS: true`, runs the full gate.
  The Vercel deploy job is guarded behind `secrets.VERCEL_TOKEN != ''`.

**Remaining infra revamp items:**
- **`ci.yml` will still go red** because of P0-1 (type-check) regardless of secrets. Fix the code
  first, then the "false red" narrative in the docs is truly resolved.
- **Duplicate `npm run build`**: `cloudbuild.yaml` runs `next build` in the `next-build` step *and*
  again inside the Docker `builder` stage. Pick one to cut build time/cost (known backlog item #69).
- **Migrations are still manual** (SQL Editor or `db:migrate`); there's no automated
  `supabase db push` in the pipeline — documented, not automated.
- **Deprecated-deps hygiene**: the `@react-email` stack is fully deprecated upstream; plan a
  migration to a maintained email-render approach.

---

## 8. Documentation drift (docs vs. reality)

The repo has ~74 markdown files; several contradict the code and each other:

- `docs/FEATURE_PHASES.md` says **Reading Interface is "✅ fully implemented"** — it's a stub (P0-2).
  It also says **Reviews UI is "❌ not implemented"** — it's actually built (just unwired). Both
  directions are wrong.
- `docs/IMPLEMENTATION_STATUS.md`, `blockers/STATUS.md`, `blockers/SUMMARY.md` describe a
  "~96% launch ready" state and reference multi-agent coordination that no longer matches the tree.
- `.cursor/plans/full_project_hardening_plan_*.md` is explicitly **archived/superseded**; several
  of its "blockers" (Docker `public`, rename, `*.save`, canonical prod) are **already resolved**.
- `docs/MIGRATIONS.md` (and older docs) reference a nonexistent `20260116000000_create_books_table.sql`
  (books live in `initial_schema.sql`).
- Amplify docs (`AMPLIFY_READY.md`, `docs/AWS_AMPLIFY_*`) describe Amplify as the launch target,
  but canonical prod is Cloud Run.

**Revamp = prune/flag stale docs** and make `FEATURE_PHASES.md` the honest source of feature truth
(this backlog can seed that).

---

## 9. Testing gaps

- **Coverage is thin** relative to surface: 6 unit suites / 25 tests for ~77 app files, ~66
  components, ~55 lib modules. Concentrated on rate-limit + a couple of utils + `BookCard`.
- **E2E not in CI:** Playwright specs exist (`tests/e2e/auth-flow`, `purchase-flow`,
  `smoke-auth`, `smoke-stripe`) but `ci.yml` never runs `playwright test`.
- **No tests for the money paths** (checkout server action, webhook order creation/refund) beyond
  smoke specs; given the revenue bug (P0-5), currency handling deserves unit tests.
- **Jest ↔ jsdom version skew** historically flagged (`jest@29` vs `jest-environment-jsdom@30`);
  suite currently passes but the mismatch is worth aligning.

---

## 10. Prioritized revamp roadmap

**P0 — unblock & core product (do first)**
- [ ] P0-1 Fix type-check (delete stray `lib/supabase/queries.test.ts` or add `@types/jest`).
- [ ] P0-2 Build the real reading experience (content renderer + entitlement + locator model).
- [ ] P0-3 Mount `ReviewSection` on book/comic/paper detail; implement `reportReview` persistence.
- [ ] P0-4 Build the Partner portal (or hide it behind a flag until built).
- [ ] P0-5 Fix revenue ×100 display bug.

**P1 — complete the half-built**
- [ ] Author analytics page + real earnings computation.
- [ ] Wire Resonance recommendations into `discover/recommendations` (guarded by `OPENAI_API_KEY`).
- [ ] Wire or remove the social layer (follows, reading lists, activity feed).
- [ ] Verify email triggers actually fire on key events.
- [ ] `growthRate` computation; consolidate `readers-hub` into `library`.
- [ ] Triage `npm audit` (10 high); plan `@react-email` replacement.

**P2 — hardening & hygiene**
- [ ] Nonce-based CSP (drop `unsafe-inline`/`unsafe-eval`).
- [ ] Trim admin health config exposure in prod.
- [ ] Run E2E in CI; add currency/webhook/checkout unit tests.
- [ ] Remove duplicate `npm run build` in the Cloud Build/Docker path.
- [ ] Resolve duplicate content_type migrations; audit migration idempotency.
- [ ] Automate (or formally document) Supabase migration application.

**P3 — cleanup**
- [ ] Dedupe `ErrorBoundary`; remove `/* eslint-disable */` blanket headers and fix real issues.
- [ ] Remove/replace `scripts/setup.ts` placeholder; confirm `pages/_document.tsx` still needed.
- [ ] Prune stale docs; make `FEATURE_PHASES.md` accurate; prune stale remote branches (dozens exist).
- [ ] Upload file-hash dedup (`lib/actions/upload.ts`).

---

## 11. Appendix — "coming soon" / placeholder strings found in source

These are the literal user-facing placeholders discovered in `.tsx`:

- `reading/[bookId]/ReadingClient.tsx` — "Reading interface coming soon."
- `readers-hub/page.tsx` — 3× "Feature coming soon"
- `books/[slug]/page.tsx`, `comics/[slug]/page.tsx`, `papers/[slug]/page.tsx` — "Reviews coming soon."
- `discover/book-clubs/page.tsx` — "Book clubs feature coming soon!"
- `partner/dashboard/page.tsx` — "Partner dashboard coming soon!"
- `partner/catalogs/page.tsx` — "Catalogs feature coming soon!"
- `partner/orders/page.tsx` — "Orders feature coming soon!"
- `partner/arc-requests/page.tsx` — "ARC requests feature coming soon!"
- `author/analytics/page.tsx` — "Analytics dashboard coming soon!"

Code TODO markers:
- `lib/actions/upload.ts` — `hash: '' // TODO: Generate file hash for deduplication`
- `components/analytics/AnalyticsOverview.tsx` — `growthRate: 0, // TODO: Calculate growth rate`

---

*Scope note: This document intentionally excludes the "save environment secrets to local `.env`"
operator workflow. For that, see `docs/CANONICAL_PRODUCTION.md` and the Operator Walkthrough.*
