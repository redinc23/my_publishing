# MANGU Publishers — Full Revamp Backlog (End-to-End)

**Document ID:** MANGU-REVAMP-001
**Status:** Living document
**Scope:** Everything that still needs to be built, wired, fixed, or hardened to make MANGU Publishers a genuinely functional, production-grade product — **excluding** the already-known "environment secrets saving to local `.env` / GCP Secret Manager" item, which is tracked separately.

> **How to read this.** The existing planning docs (`docs/MANGU_PUBLISHERS_END_TO_END.md`, `blockers/`, `nexus_analysis/`, `docs/IMPLEMENTATION_STATUS.md`) describe the app as "~96% launch ready" / "Health 100/100". That framing is about **build/deploy plumbing** (lockfiles, Node version, CI gates, rate limiting, health probes). It is **not** an accurate description of end-to-end product functionality. This document is the honest, code-level counter-inventory: what actually works when a real user clicks through the app, and what is a placeholder, orphaned, or broken.
>
> Every claim below is grounded in the current source. Verdicts use three labels:
> - **REAL** — wired end-to-end and works when dependencies (DB, keys) are present.
> - **PARTIAL** — infrastructure exists but the UI/API/schema diverge, is unused, or has material gaps.
> - **STUB** — placeholder ("coming soon"), dead code, or defined-but-never-called.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [The three systemic blockers (fix these first)](#2-the-three-systemic-blockers-fix-these-first)
3. [Feature status matrix](#3-feature-status-matrix)
4. [Deep dive: reading experience](#4-deep-dive-reading-experience)
5. [Deep dive: commerce (checkout → fulfillment → library → payouts)](#5-deep-dive-commerce)
6. [Deep dive: social & reviews](#6-deep-dive-social--reviews)
7. [Deep dive: author portal](#7-deep-dive-author-portal)
8. [Deep dive: partner portal](#8-deep-dive-partner-portal)
9. [Deep dive: AI / Resonance recommendations](#9-deep-dive-ai--resonance-recommendations)
10. [Deep dive: analytics](#10-deep-dive-analytics)
11. [Deep dive: search & discovery](#11-deep-dive-search--discovery)
12. [Deep dive: email / notifications](#12-deep-dive-email--notifications)
13. [Deep dive: admin panel](#13-deep-dive-admin-panel)
14. [Deep dive: content types (audio / comics / papers)](#14-deep-dive-content-types)
15. [Navigation, IA & onboarding gaps](#15-navigation-ia--onboarding-gaps)
16. [Data model / migrations / RLS debt](#16-data-model--migrations--rls-debt)
17. [Infra, CI/CD, deploy & observability](#17-infra-cicd-deploy--observability)
18. [Testing debt](#18-testing-debt)
19. [Security & compliance](#19-security--compliance)
20. [Repository hygiene & stale artifacts](#20-repository-hygiene--stale-artifacts)
21. [Prioritized revamp roadmap](#21-prioritized-revamp-roadmap)

---

## 1. Executive summary

MANGU Publishers is a Next.js 14 (App Router) "Netflix for books" platform on Supabase + Stripe with optional OpenAI (recommendations) and Resend (email). The **shell** is impressive: routing, layout, auth, RBAC middleware, a rich component library, a full SQL schema (17 migrations, ~30 tables), health checks, rate limiting, and CI/deploy pipelines all exist.

The problem is that a large share of the product is **scaffolding, not wiring**. The database schema and a component library were built ahead of the integration work, and the two halves were never fully connected. Concretely:

- **The core product — actually reading a book — does not exist.** The reader renders the literal text "Reading interface coming soon."
- **Commerce does not complete.** Stripe Checkout starts, but purchase → ownership → library → reading-access → author-revenue is broken by two competing, incompatible order models.
- **Reviews, follows, reading lists, activity feed** are built as components + server actions + DB tables, but the consumer pages never mount them ("Reviews coming soon.").
- **The entire partner portal** (dashboard, orders, catalogs, ARC requests) is "coming soon."
- **Author earnings/analytics** are hardcoded to `0` / "coming soon."
- **"AI recommendations" are not AI** — pgvector RPCs exist but are never called; the app serves popularity/genre lists labeled as `vector_similarity`.
- **Transactional email is dead code** — six Resend templates exist, zero are called from any flow.
- **A systemic schema bug** — ~7 code paths query a `users` table that does not exist (the schema uses `profiles`).

**Bottom line:** the deploy/infra story is close to done; the *product* is roughly a well-decorated demo. The revamp is primarily an **integration + data-model-unification effort**, not a greenfield build — most pieces exist and need to be connected correctly.

---

## 2. The three systemic blockers (fix these first)

These are not features; they are cross-cutting defects that silently break many features at once. Nearly every feature deep-dive below traces back to one of these. Fix them before (or alongside) feature work, or feature work will be built on sand.

### 2.1 BLOCKER A — Two competing order/purchase data models

There are **two incompatible definitions of an "order"** in the codebase:

- **Migration/schema model** (`supabase/migrations/20260116000000_initial_schema.sql:193-214`): normalized `orders` (with `order_number`, `total_amount`, `user_id → profiles(id)`) + `order_items` (per-book, `unit_price`, `license_key`). RLS policies, the library page, admin, exports, and the `author_earnings` view all assume this shape. A correct fulfillment helper `createOrder()` exists in `lib/supabase/queries.ts:423-466` — with **zero callers**.
- **Application/webhook model** (`types/webhook.ts`, `app/api/webhook/route.ts:131-167`): a **flat** `orders` row with `book_id`, `amount`, `stripe_session_id`, etc., and `user_id = auth.users.id`. These columns are **not in the migrations or `types/database.ts`**. The webhook never writes `order_items` or `book_sales`.

**Consequences:**
- Library page (`app/(consumer)/library/page.tsx:36-44`) joins `order_items` → always empty even after a successful payment.
- RLS `"Users can view own orders"` maps `user_id` via `profiles`, but webhook writes `auth.users.id` → rows invisible to their owner.
- Author revenue/payouts read `book_sales` → always `$0` (webhook never inserts).

**Fix:** pick ONE model (recommend the normalized migration model), rewrite the webhook to call `createOrder()` (orders + order_items + book_sales), reconcile `user_id` to `profiles.id`, and align `types/database.ts`.

### 2.2 BLOCKER B — Phantom `users` table (should be `profiles`)

~7 code paths query a `users` table that does not exist in any migration (schema uses `profiles`, plus `auth.users`). Each of these queries fails or returns null at runtime:

| File:line | Query |
|-----------|-------|
| `lib/actions/payouts.ts:77` | `.from('users')` (Stripe Connect id) |
| `lib/services/export-queue.ts:266` | `.from('users')` |
| `lib/actions/analytics.ts:114` | `user:users(name, email, avatar_url)` (live readers) |
| `lib/actions/follows.ts:107,140` | `follower:users!...`, `following:users!...` |
| `lib/actions/reading-list.ts:164` | `author:users (...)` |
| `app/dashboard/my-reviews/page.tsx:37` | `author:users (...)` |
| `app/users/[userId]/reviews/page.tsx:37,55` | `.from('users')`, `author:users (...)` |

**Fix:** global replace of `users` → `profiles` with correct column names (`profiles` has no `username`/`avatar_url`/`name` in the base schema — audit columns), and fix the review author join (`books → authors → profiles`, not `users`).

### 2.3 BLOCKER C — RLS enabled without policies on social tables

`supabase/migrations/20260122000000_social_features.sql` runs `ENABLE ROW LEVEL SECURITY` on `reviews`, `review_votes`, `comments`, `user_follows`, `reading_lists`, `user_activities` but **defines no policies**. Result: any client-side (anon/auth key) read or write to these tables is **denied by default**. Similarly, the `manuscripts` table has **author-only** policies and **no admin SELECT policy** (unlike `books`, which got one in `20260118000000_critical_fixes.sql`), so the admin manuscripts screen likely shows nothing. The `manuscripts` storage bucket also has no INSERT policy for authenticated users.

**Fix:** author a policies migration for all social tables, add an admin SELECT policy for `manuscripts`, and add a storage INSERT policy for the `manuscripts` bucket.

---

## 3. Feature status matrix

| Domain | Feature | Verdict | Headline gap |
|--------|---------|---------|--------------|
| **Reading** | In-browser reader | **STUB** | Renders "Reading interface coming soon"; no content rendering |
| Reading | Progress tracking | **PARTIAL** | Autosaves a 0–100 counter with no real position; no chapters |
| Reading | Ownership gate | **STUB** | Any logged-in user can read any book |
| **Commerce** | Stripe Checkout session | **REAL** | Single-item only, no cart |
| Commerce | Checkout server action → API auth | **PARTIAL** | Cookies not forwarded → likely 401 |
| Commerce | Webhook signature/idempotency | **REAL** | Solid |
| Commerce | Fulfillment (order_items/ownership) | **PARTIAL/BROKEN** | Blocker A |
| Commerce | Library display | **PARTIAL/BROKEN** | Empty due to Blocker A |
| Commerce | Success/cancel handling | **STUB** | `?success=true` ignored by book page |
| Commerce | Advanced pricing (regional/PWYW/coupons) | **STUB** | `book_pricing` table unused |
| Commerce | Author payouts / Stripe Connect | **STUB** | No UI; buggy action; Blocker B |
| **Social** | Reviews (create/edit/delete) | **PARTIAL** | Actions exist; UI orphaned; Blockers B & C |
| Social | Reviews on book detail | **STUB** | "Reviews coming soon." |
| Social | Review helpful votes | **PARTIAL** | Votes write; `helpful_count` never updates |
| Social | Follows | **PARTIAL** | Backend only; no button; Blocker B |
| Social | Comments | **STUB** | Table only; inert button |
| Social | Likes | **N/A** | Not implemented |
| Social | Reading lists / activity feed | **PARTIAL** | Backend + orphaned components |
| Social | Book clubs | **STUB** | "coming soon"; no table |
| Social | Readers Hub | **STUB** | 3 cards, all "coming soon" |
| **Author** | Manuscript metadata submit | **PARTIAL** | Works if `authors` row exists |
| Author | Manuscript file upload | **STUB** | No file field; storage RLS missing |
| Author | Dashboard counts | **PARTIAL** | Real queries; broken author lookup |
| Author | Earnings | **STUB** | Hardcoded `0` |
| Author | Analytics | **STUB** | "coming soon" |
| Author | Onboarding (`authors` row) | **STUB/BROKEN** | No creation flow; wrong FK lookup |
| **Partner** | Dashboard/orders/catalogs/ARC | **STUB** | All "coming soon" |
| **AI** | OpenAI embeddings | **PARTIAL** | Route exists; no auto-trigger on publish |
| AI | pgvector recommendations | **PARTIAL** | RPCs exist; never called |
| AI | Consumer "recommendations" | **STUB** | Trending list mislabeled as AI |
| **Analytics** | Track API | **REAL** | Works for single events |
| Analytics | Client tracking | **STUB** | Tracker never imported; wrong payload |
| Analytics | Dashboards | **PARTIAL** | Missing RPCs; hardcoded growth; no refresh |
| **Search** | Browse search | **PARTIAL** | Title-only FTS; richer `search_vector` unused |
| Search | Autocomplete | **STUB** | None |
| **Email** | All transactional email | **STUB** | Templates exist; zero call sites |
| **Admin** | Dashboard/orders/users (read) | **REAL** | Read-only |
| Admin | Book edit | **REAL** | Works |
| Admin | Book create (`/admin/books/new`) | **STUB** | Link 404s; page missing |
| Admin | Manuscript review workflow | **STUB** | "Review" button inert; no status update |
| **Content** | Audiobooks | **PARTIAL** | Wired to `book_content.audio_url`; needs data |
| Content | Comics/papers detail | **PARTIAL** | Pages exist; reviews stubbed; needs data |
| **Homepage** | Landing | **REAL** (marketing) | Hardcoded stats ("50,000+ Books") |

---

## 4. Deep dive: reading experience

**This is the single most important gap.** The product's entire reason to exist — reading a book in the browser — is a placeholder.

- `app/(consumer)/reading/[bookId]/ReadingClient.tsx:56-59` renders literally: *"Reading interface coming soon. This will display the book content based on the current position."*
- Progress tracking (`ReadingClient.tsx:19-31`) autosaves `current_position` every 30s, but position is just a 0–100 integer nudged by Prev/Next buttons — **not tied to any real content, page, or chapter**.
- No content rendering pipeline exists: no EPUB/PDF reader, no chapter model, no pagination, no font/theme controls, no bookmarks, no highlights, no TOC.
- `app/(consumer)/reading/[bookId]/page.tsx:7-28` gates only on login — **no ownership check** (see Blocker A / commerce).
- The `book_content` table (`initial_schema.sql:75`) exists (with `content_url`, `audio_url`, etc.) but the reader never fetches or renders it.

**Revamp work:**
1. Decide content format(s): EPUB (recommended, use a reader like `epubjs`/`react-reader`), PDF, and/or structured HTML chapters.
2. Define storage + delivery (Supabase Storage signed URLs; stream/paginate).
3. Build the real reader UI (TOC, pagination, theme, font size, bookmarks, resume position keyed to real locations/CFI).
4. Persist real reading position (not a 0–100 int) and reading sessions (`reading_sessions` table exists).
5. Enforce ownership (or "free/sample" allowance) before granting access.
6. Wire completion → analytics (`event_type: 'complete'`) and reading stats.

---

## 5. Deep dive: commerce

**Checkout (PARTIAL):** `app/api/checkout/route.ts` + `lib/stripe/server.ts:38-60` create a real single-item Stripe Checkout session. Gaps:
- **Auth gap:** `app/checkout/page.tsx:51-76` server action `fetch`es `/api/checkout` **without forwarding cookies**; the API re-checks auth and likely returns 401 for a logged-in user.
- **No cart:** one book, `quantity: 1`. No basket/multi-item.
- **Success/cancel ignored:** redirect to `/books/{slug}?success=true` — book page never reads `searchParams`, so no confirmation, no "go to library," no access grant.
- Pricing uses `books.discount_price || books.price`; `book_pricing` table ignored.

**Webhook (PARTIAL):** `app/api/webhook/route.ts` — signature verification, rate limiting, and idempotency (`webhook_events` + `orders.stripe_session_id` dedup) are **REAL**. Handles `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `payment_intent.payment_failed`. But fulfillment writes the wrong shape (Blocker A): no `order_items`, no `book_sales`, no confirmation email, no license keys, no access revocation on refund.

**Library (PARTIAL/BROKEN):** `app/(consumer)/library/page.tsx` queries `orders → order_items → books`; empty because webhook never creates `order_items`. Also FK/user-id mismatch (Blocker A). No shared `userOwnsBook()` helper anywhere.

**Pricing (PARTIAL):** column-based pricing works for display/checkout. `book_pricing` (regional prices, `discount_until`, PWYW, `is_free`, `minimum_price`) is schema-only. `getBookPricing/updateBookPricing` (`lib/actions/revenue.ts:57-117`) have no UI. Unit inconsistency: `books.price` in dollars vs `book_pricing.base_price` in cents.

**Revenue/payouts (STUB):** `book_sales`, `author_payouts`, `payout_items` schemas exist. `getBookRevenue` is wired into `RevenueStats`, but always `$0` (webhook never inserts `book_sales`). `requestPayout` (`lib/actions/payouts.ts`) is buggy: queries phantom `users` table (Blocker B), fetches **all** sellers' sales (no author filter), likely double-subtracts fees, and uses an in-memory rate-limit map that won't survive serverless restarts. No Stripe Connect onboarding.

**Revamp work:** unify the order model (Blocker A); forward cookies (or move checkout fully server-side); handle success/cancel; call `createOrder()` from the webhook; insert `book_sales`; send confirmation email; add ownership gate; then optionally cart, advanced pricing, coupons, and Stripe Connect payouts.

---

## 6. Deep dive: social & reviews

The schema (`20260122000000_social_features.sql`) and a full component library exist, but consumer integration was never done. This is a "Phase 5 scaffolding" area.

- **DB (REAL):** `reviews`, `review_votes`, `comments`, `user_follows`, `reading_lists`, `user_activities` + ratings-aggregation trigger. **But no RLS policies (Blocker C)** and **stale `types/database.ts`** (none of these tables typed).
- **Server actions:** `createReview`/`deleteReview`/`voteOnReview` (`lib/actions/reviews.ts`) are real but reachable only from orphaned UI. `reportReview` is a `console.log` stub. `voteOnReview` writes to `review_votes` but nothing updates `reviews.helpful_count`.
- **Components (orphaned):** `ReviewForm`, `ReviewSection` (the main book-detail review UI — **never imported anywhere**), `ReviewFilters`, `ReviewCard`, `ReviewStats` exist and are mostly complete but not mounted. `ReviewActions` fakes delete with a toast. `ReviewSection` has internal stubs (Load More does nothing; stats charts are `{/* Add ... */}` comments) and never re-sorts/filters.
- **Book/comic/paper detail pages:** all show `"Reviews coming soon."` (`books/[slug]/page.tsx:201`, `comics/[slug]/page.tsx:101`, `papers/[slug]/page.tsx:101`). Rating shown is average only (no review count), sourced from seed/`reading_progress` — **not** the reviews table.
- **Two competing rating sources:** `reading_progress.rating` trigger (initial schema) vs `reviews` trigger (social migration), writing to different columns (`total_reviews` vs `review_count`).
- **Follows (PARTIAL):** full backend (`lib/actions/follows.ts`) but no follow button anywhere; joins phantom `users` (Blocker B); revalidates non-existent `/dashboard/following`.
- **Reading lists / activity feed (PARTIAL):** backend CRUD exists; `components/social/ReadingList.tsx` and `ActivityFeed.tsx` are never imported; link to non-existent routes; no read path for activities.
- **Comments (STUB):** table only; `ReviewCard` comment button inert.
- **Likes (N/A), Book clubs (STUB, no table), Readers Hub (STUB).**

**Revamp work:** add RLS policies (Blocker C); fix `users`→`profiles`/`authors` joins (Blocker B); mount `ReviewSection` on detail pages with a server fetch; wire `ReviewActions` to `deleteReview`; add a `helpful_count` trigger; pick one rating source of truth; add follow buttons + profile pages; mount reading list/activity components with real routes; add nav links.

---

## 7. Deep dive: author portal

- **Dashboard (PARTIAL):** real role gate + `books`/`manuscripts` queries, but **earnings hardcoded `0`** (`author/dashboard/page.tsx:46`) and a **critical author-lookup bug**: filters `authors.profile_id = user.id` where `user.id` is the auth UID, but `profile_id` FK references `profiles.id`. Real users likely hit "Author profile not found."
- **No author onboarding:** nothing in the app ever inserts an `authors` row (only the seed script). A newly-registered user who becomes an author has no path to a working author profile.
- **Projects list/detail (PARTIAL):** real owner-scoped reads; same lookup bug; read-only (no manuscript file download for `manuscript_file_url`/`sample_chapters_url`/`cover_draft_url`; no resubmit on `revisions_requested`).
- **Analytics (STUB):** "coming soon."
- **Submit (PARTIAL):** metadata insert works (`submit/actions.ts:39-48`), but **no file upload** (form has no file field; `app/api/upload/route.ts` exists but is never called; `manuscripts` bucket has no INSERT RLS), `submission_date` not set, and no confirmation email (`sendManuscriptSubmitted` never invoked). A better `submitManuscript()` helper in `lib/supabase/queries.ts:355-377` (supports file URLs) is duplicated and unused.
- **Type mismatch:** `types/index.ts` `User.role` is `'user' | 'author' | 'admin'` — missing `partner`/`reader`. No `requireAuthor()` helper (only `requireAdmin`).

**Revamp work:** fix author lookup (resolve `profiles` from `user_id`, then `authors.profile_id`); build author onboarding (create `authors` row on role grant); wire manuscript file upload + storage RLS; set `submission_date`; send submission email; replace earnings stub with `getBookRevenue`/`author_earnings`; build author analytics from existing actions.

---

## 8. Deep dive: partner portal

**Every partner route is a "coming soon" stub** with no queries and no in-page auth (middleware only), and there are **no partner nav links** anywhere.

- `partner/dashboard`, `partner/orders`, `partner/catalogs`, `partner/arc-requests` — all static "coming soon."
- `partner/orders/[id]` — always `notFound()`.

**Data readiness:**
- `partners` and `arc_requests` tables exist (with partner SELECT/INSERT RLS) but **zero app code** references them.
- **No `catalogs` table** — needs a new model (e.g. `partner_catalogs` + `partner_catalog_books`, or plan-based filtering).
- `orders` has no `partner_id` (it's consumer-scoped) — institutional/bulk orders need schema work.
- **No partner onboarding** (same gap as authors — nothing creates `partners` rows).

**Revamp work:** design partner data model (catalogs, bulk orders, ARC fulfillment); build dashboard/KPIs; ARC request list + create + admin fulfillment; partner onboarding; partner nav.

---

## 9. Deep dive: AI / Resonance recommendations

"AI recommendations" is largely **marketing over a trending list**.

- **Embeddings (REAL but orphaned):** `POST /api/resonance/embed` calls OpenAI and upserts `resonance_vectors`. But it's only invoked manually / from the seed script — **no trigger on book create/publish**. Throws 500 without `OPENAI_API_KEY` (no fallback).
- **pgvector RPCs (REAL in DB, unused):** `get_similar_books`/`get_recommendations` (cosine similarity, `<=>`) exist in `initial_schema.sql` and are wrapped in `lib/supabase/queries.ts:314-333` — but **never called** by any route or page.
- **`/api/resonance/recommend` (PARTIAL):** explicitly `algorithm: 'popularity_recency_v1'` (views + purchases×10 + recency). Not AI.
- **`/api/resonance/similar` (PARTIAL):** same-genre + `total_reads`. Not vector.
- **`lib/resonance/server.ts` (STUB):** labels output `vector_similarity` while ordering by `total_reads`. Not imported anywhere.
- **`discover/recommendations/page.tsx` (STUB):** comment says "For now, return trending books… In production, this would call the resonance API." Bypasses Resonance entirely.
- **`lib/hooks/use-recommendations.ts` (dead):** never imported; response-shape mismatch with the API.
- Book-detail "Similar Books" uses genre + limit, not vectors.

**Revamp work:** trigger embedding on publish; call `get_similar_books`/`get_recommendations` RPCs from the similar/recommend routes and consumer pages; add a graceful non-AI fallback when OpenAI is absent; fix the hook or delete it; stop labeling trending as `vector_similarity`.

---

## 10. Deep dive: analytics

- **Migrations (REAL):** partitioned `analytics_events`, `analytics_sessions` (+ update trigger), `book_stats_daily` materialized table + `refresh_book_stats_daily()`.
- **Track API (REAL):** `POST /api/analytics/track` — validation, rate limiting, access checks, single-event insert.
- **Client tracking (STUB):** `lib/services/analytics-tracker.ts` is **never imported**, and sends a **batch `{ events }`** payload the API doesn't accept (API expects a single event). Net effect: **almost no view/read/share events reach the DB** — only Stripe webhook purchase events do.
- **Dashboards (PARTIAL):** `AnalyticsOverview`/`AnalyticsDashboard` wired to server actions, but:
  - `growthRate: 0, // TODO` hardcoded (`AnalyticsOverview.tsx:68`) yet UI shows "0% from last period."
  - Double currency conversion bug (`AnalyticsOverview.tsx:68` then `:167`).
  - `getEngagementHeatmap` and `getGeographyData` call RPCs (`get_engagement_heatmap`, `get_geography_data`) that **don't exist in any migration**.
  - `getLiveReaders` joins phantom `users` (Blocker B).
  - `refresh_book_stats_daily()` is **never called automatically** (a `pg_notify` fires with no listener) → charts empty unless manually refreshed/seeded.
- **Realtime (STUB):** `/api/analytics/stream` SSE is real but nothing consumes it; `LiveReaders` uses a broadcast channel whose `broadcastEvent` is never called → falls back to broken `getLiveReaders`.
- **"AI Insights" (PARTIAL):** rule-based heuristics badged "Powered by AI"; no OpenAI.
- **Author analytics page (STUB):** "coming soon."

**Revamp work:** fix/replace the client tracker (correct single-event payload; instrument book views, reads, shares); add the missing RPCs (`get_engagement_heatmap`, `get_geography_data`) or rewrite actions as direct queries; fix `users`→`profiles`; schedule `refresh_book_stats_daily()` (cron/edge function); compute real growth rate; fix currency double-conversion.

---

## 11. Deep dive: search & discovery

- **SearchBar (REAL, minimal):** navigates to `/books?q=...`; no autocomplete/API.
- **Browse (REAL listing, PARTIAL search):** `getBooksPage` uses `textSearch('title', ...)` — **title-only**. A richer `search_vector` (title+description+genre, GIN-indexed) exists in schema and in `getPublishedBooks`/`searchBooks` (`lib/supabase/queries.ts:97-101`) but is **not used** on the main browse path. A third `searchBooks` in `lib/actions/books.ts` references a non-existent `books_search` RPC.
- **Filters (REAL UI, PARTIAL alignment):** hardcoded 12 genres may not match DB genre values; search fires on every keystroke (no debounce).
- **Genres & discover hub (REAL):** aggregate from published books; link out to stub recommendations/book-clubs.

**Revamp work:** switch browse to `search_vector`; align genre taxonomy (single source of truth); add debounce + optional autocomplete; remove/implement the `books_search` RPC path.

---

## 12. Deep dive: email / notifications

**Entirely dead code today.** `lib/email/send.ts` (Resend) + `lib/email/templates.tsx` define Welcome, PurchaseConfirmation, ManuscriptSubmitted, ManuscriptStatusUpdate, WeeklyDigest, PasswordReset. **None are called from any app flow** (grep: zero external imports):

| Email | Reality |
|-------|---------|
| Welcome | Not sent (signup = Supabase Auth only) |
| Purchase confirmation | Not sent (webhook skips it) |
| Manuscript submitted | Not sent |
| Manuscript status update | Not sent (no admin status action exists) |
| Weekly digest | Not sent (no cron) |
| Password reset | Supabase's own email is used, not the Resend template |

Also: `notifications` table exists but there's no in-app notification UI; notification types (`new_follower`, `new_review`, …) are typed but unimplemented.

**Revamp work:** call `sendWelcomeEmail` on signup, `sendPurchaseConfirmation` from the webhook, `sendManuscriptSubmitted` on submit, `sendManuscriptStatusUpdate` from admin review; add a digest cron if desired; build in-app notifications on the existing `notifications` table.

---

## 13. Deep dive: admin panel

Auth is solid (`requireAdmin()` in `app/admin/layout.tsx`, defense-in-depth beyond middleware). Screens:

| Route | Verdict | Note |
|-------|---------|------|
| `/admin/dashboard` | REAL (read) | Counts + recent engagement |
| `/admin/books` | PARTIAL | Lists books; **"Add New Book" → `/admin/books/new` which does not exist** (404) |
| `/admin/books/[id]/edit` | REAL | `updateBookAdmin` with role check |
| `/admin/manuscripts` | STUB workflow | Read-only; **"Review" button inert**; `updateManuscriptStatus` has zero callers; no detail page; likely blocked by missing admin RLS (Blocker C) |
| `/admin/orders` | REAL (read) | — |
| `/admin/users` | REAL (read) | No edit/role management |
| `/admin/health` | REAL | Shows env key presence |

No admin create/delete flows for books/users/orders; no role-assignment UI (which blocks author/partner onboarding).

**Revamp work:** build `/admin/books/new`; implement manuscript review (detail page + accept/reject/revisions actions + status emails + admin RLS); add user role management (to grant author/partner); optional order refund/management actions.

---

## 14. Deep dive: content types

The app models three content types on `books` (`content_type IN ('book','comic','paper')`) plus audiobooks via `book_content.audio_url`.

- **Audiobooks (PARTIAL):** `audio/page.tsx` + `audio/[id]/page.tsx` are real, query `book_content.audio_url`, and render an `AudioPlayer`. Needs seeded content + upload/admin flow to populate `audio_url`. No progress tracking for audio.
- **Comics/papers (PARTIAL):** detail pages exist and query the DB, but reviews are stubbed and there's no dedicated reader (comics need an image/page viewer; papers likely a PDF viewer) — they currently ride the same nonexistent reading pipeline.
- **Duplicate migrations:** `20260619124500_add_content_type_to_books.sql` and `20260619162409_add_content_type.sql` add the **same column** (redundant; consolidate).

**Revamp work:** admin/author flows to upload audio/comic/paper assets into `book_content`; type-specific readers (audio player w/ progress, comic page viewer, PDF viewer); wire reviews per type.

---

## 15. Navigation, IA & onboarding gaps

- **`UserMenu`** (logged in) exposes only **Library + Sign Out** — no links to Author portal, Partner portal, Admin, My Reviews, Readers Hub, or profile, even for users with those roles.
- **`Navigation`** exposes Books/Comics/Papers (Library dropdown) + Authors/Audio/Discover. No role-aware entries.
- **`(portals)/layout.tsx`** is a pass-through — no portal sidebar/shell.
- **No role self-service:** registration always sets `role: 'reader'`; there is no UI to become an author or partner, and no admin UI to grant roles → the author/partner portals are effectively unreachable by real users.
- **Orphaned routes with no inbound links:** `/dashboard/my-reviews`, `/users/[userId]/reviews`, `/dashboard/books/[id]/analytics`. `/dashboard` is not in middleware protected routes (relies on page-level checks).

**Revamp work:** role-aware navigation; portal shells; role request/approval flow; admin role management; wire orphaned routes into nav; add middleware protection for `/dashboard`.

---

## 16. Data model / migrations / RLS debt

- **Order model split** (Blocker A) — the top data-model issue.
- **Phantom `users` table** (Blocker B) across ~7 files.
- **Social RLS missing** (Blocker C); manuscripts admin RLS missing; manuscripts storage INSERT policy missing.
- **Stale generated types:** `types/database.ts` doesn't include social tables or the webhook's `orders` columns; `types/index.ts` role union is incomplete.
- **Competing rating triggers/columns** (`reading_progress` vs `reviews`; `total_reviews` vs `review_count`).
- **Missing RPCs referenced by code:** `get_engagement_heatmap`, `get_geography_data`, `books_search`.
- **Aggregation not scheduled:** `refresh_book_stats_daily()` never runs automatically.
- **Duplicate content_type migrations.**
- **Migration docs stale:** `README.md`/`END_TO_END.md` list 12 migrations; there are actually 15 (including `20260117000006_storage_policies` and the three June migrations).
- **Unit inconsistencies:** dollars vs cents across `books.price`, `book_pricing.base_price`, Stripe.

**Revamp work:** unify orders; `users`→`profiles` sweep; write missing RLS + storage policies; regenerate `types/database.ts` from the live schema; consolidate rating logic; add missing RPCs; schedule stats refresh; dedupe migrations; refresh docs; standardize money units (recommend integer cents everywhere).

---

## 17. Infra, CI/CD, deploy & observability

The infra story is the most mature part, but not "done":

- **Canonical prod:** Cloud Run via `cloudbuild.yaml` (lint, type-check, build, secret-audit, docker, deploy, verify). GitHub Actions → Vercel is secondary; Amplify is legacy. Three deploy configs (`cloudbuild.yaml`, `vercel.json`, `amplify.yml`) add maintenance surface — consider retiring the unused ones.
- **Secrets:** runtime injection via GCP Secret Manager is scripted (`scripts/sync-gcp-secrets-from-env.sh`, `verify-gcp-production.sh`) but **operator-dependent** (this is the separately-tracked item).
- **Migrations automation:** `npm run db:migrate` needs an `exec_sql` RPC not present on hosted Supabase → migrations are effectively manual (SQL editor/bundle). GitHub issue #67 open.
- **Observability:** health/live probes exist, but **no error tracking (Sentry), no metrics/APM, no structured logging, no alerting, no uptime monitoring**. Analytics/refresh jobs have no scheduler.
- **Rollback:** issue #65 (rollback tags + runbook) open; `docs/ROLLBACK.md` is minimal.
- **Distributed rate limiting:** Upstash-based, with graceful degradation; `finding-1` describes migrating all limiters to Redis fail-closed — verify it's actually applied (the `finding-1-deploy` patch file is a near-empty stub).
- **CDN/image/perf:** "PERF PHASE 2" commits exist; validate caching, image optimization, and bundle budgets against the real content pipeline once the reader exists.

**Revamp work:** add Sentry + structured logs + alerts; add a scheduler (Cloud Scheduler/edge cron) for stats refresh, digests, payouts; automate migrations in the pipeline; finalize rollback runbook + tags; prune unused deploy configs; confirm rate-limit hardening landed.

---

## 18. Testing debt

- **Unit (Jest):** 5 suites (`analytics-optimizer`, `auth-rate-limit`, `book-action-rate-limit`, `BookCard`, `queries`). Rate-limit stubs were replaced with real tests, but coverage is thin — **no tests for checkout, webhook fulfillment, reviews, RBAC, ownership, or the reader**.
- **E2E (Playwright):** `auth-flow`, `purchase-flow` (**complete purchase test commented out**), `smoke-auth`, `smoke-stripe`. Not run in CI.
- **Load (k6):** `tests/k6/load-test.js` present; unclear if run.
- No integration tests against a real/seeded Supabase; no RLS policy tests; no visual/a11y tests.

**Revamp work:** add integration tests for the unified order flow (checkout → webhook → order_items → library → reading access), RBAC/ownership tests, review flow tests, and RLS tests; uncomment/finish the purchase E2E; run E2E + a smoke load test in CI.

---

## 19. Security & compliance

- **Good:** CSP/HSTS/X-Frame in `next.config.js`; Stripe HMAC verification; RBAC middleware; `.gitignore` for env; cloudbuild secret-audit.
- **Gaps / open:**
  - **RLS holes** (Blocker C) are a security issue, not just a functional one — social tables with RLS-on/no-policies deny access (safe-ish), but manuscripts/storage policy gaps and the order-model FK mismatch can expose or hide data incorrectly. **Audit every table's policies against the intended access model.**
  - **Reading access has no ownership gate** → paid content is readable by any logged-in user (once the reader exists this becomes a real leak).
  - Secret scanning expansion (#68) and pre-commit hooks (#72) still open.
  - `/admin/health` exposes config presence — ensure it stays admin-only.
  - No rate limiting audit on all mutating endpoints; verify fail-closed semantics from `finding-1`.
  - No documented data-retention / GDPR export/delete flow (there's an `export-data` action + `export_jobs` table — verify it works and isn't blocked by Blocker B in `export-queue.ts`).

**Revamp work:** full RLS audit + tests; ownership gate; finish export/delete for compliance; secret scanning + pre-commit; verify rate-limit coverage.

---

## 20. Repository hygiene & stale artifacts

The repo root is cluttered with **agent/automation leftovers** that should be consolidated or removed to reduce confusion:

- `blockers/` (blockers.json/yml, solutions/, fix-all.sh) — a resolved P0/P1 pipeline; snapshot, keep in `docs/` or archive.
- `nexus_analysis/` + `scripts/nexus_analyzer.py` + `tools/copilot_deep_dive.py` — analysis tooling claiming "Health 100/100"; misleading vs reality.
- `finding-1/`, `finding-1-deploy/` — the deploy patch is a near-empty stub; verify the fix is in the code, then remove the placeholder dir.
- `repos.txt`, `cleanup-envs.sh`, `setup-envs.sh`, `setup.sh`, `deploy_master.sh`, `verify-setup.sh` — multiple overlapping setup scripts; consolidate.
- **Stale docs:** `IMPLEMENTATION_STATUS.md` claims homepage uses mock-data fallback (it doesn't); README/END_TO_END migration lists are outdated; "~96%"/"100/100" readiness claims contradict this backlog. Reconcile so docs match code.
- **Duplicate components:** `components/common/ErrorBoundary.tsx` vs `components/shared/ErrorBoundary.tsx`.
- Many stale remote branches (`origin/copilot/*`, `origin/cursor/*`) — prune.

**Revamp work:** archive/remove automation artifacts; consolidate setup scripts; update or delete stale docs; dedupe components; prune branches.

---

## 21. Prioritized revamp roadmap

Ordered by product impact and dependency (not calendar time). Each item notes the subsystems it touches.

### P0 — Make the product actually function
1. **Fix Blocker B** (`users`→`profiles` sweep). *Touches:* `lib/actions/*`, `app/**` review/analytics/payout pages. Low-risk, unblocks many reads.
2. **Fix Blocker A** (unify order model; webhook → `createOrder()` → orders + order_items + book_sales; reconcile `user_id` to `profiles.id`). *Touches:* webhook, library, admin, exports, revenue, `types/database.ts`. Highest-value data fix.
3. **Fix Blocker C** (RLS policies for social tables; admin `manuscripts` policy; `manuscripts` storage INSERT policy). *Touches:* new migration.
4. **Build the real reader** (content model + storage + reader UI + real progress). *Touches:* reading route/client, `book_content`, storage, analytics. The core product.
5. **Ownership gate** on reading + checkout success handling + purchase confirmation email. *Touches:* reading page, book detail, webhook, email.

### P1 — Close the obvious "coming soon" holes
6. **Reviews end-to-end** (mount `ReviewSection`, wire actions, `helpful_count` trigger, single rating source, nav links).
7. **Author portal fixes** (author lookup bug, onboarding/`authors` row creation, manuscript file upload, earnings from real data, author analytics).
8. **Admin manuscript review workflow** (detail page, status actions, emails) + `/admin/books/new` + user role management.
9. **Analytics ingestion** (fix client tracker payload + instrument views/reads; missing RPCs; scheduled `refresh_book_stats_daily`; real growth rate; currency bug).
10. **Real recommendations** (embed-on-publish; call pgvector RPCs; graceful fallback).
11. **Transactional email wiring** (welcome, purchase, manuscript flows).

### P2 — Depth, growth & new surfaces
12. **Partner portal** (data model + dashboard + ARC workflow + onboarding).
13. **Advanced commerce** (cart, `book_pricing`/coupons/regional/PWYW, Stripe Connect payouts).
14. **Social depth** (follows UI + profiles, comments, reading lists/activity feed mounting, book clubs, in-app notifications).
15. **Content-type readers** (comic viewer, PDF/paper viewer, audio progress).
16. **Search** (`search_vector`, autocomplete, genre taxonomy).

### P3 — Hardening & hygiene (parallelizable)
17. **Observability** (Sentry, logging, alerting, uptime) + **scheduler** for jobs.
18. **Testing** (integration for order flow, RBAC/ownership, RLS; finish E2E purchase; CI E2E).
19. **Security** (full RLS audit, secret scanning, pre-commit, GDPR export/delete).
20. **Repo hygiene** (archive automation artifacts, consolidate scripts, dedupe components, reconcile docs, prune branches, dedupe migrations, standardize money units, retire unused deploy configs).

---

### Appendix — Quick evidence index

| Claim | Evidence |
|-------|----------|
| Reader is a stub | `app/(consumer)/reading/[bookId]/ReadingClient.tsx:56-59` |
| No ownership gate | `app/(consumer)/reading/[bookId]/page.tsx:7-28` |
| Order model split | `initial_schema.sql:193-214` vs `app/api/webhook/route.ts:131-167`; unused `lib/supabase/queries.ts:423-466` |
| Phantom `users` table | `payouts.ts:77`, `analytics.ts:114`, `follows.ts:107,140`, `reading-list.ts:164`, `export-queue.ts:266`, `my-reviews/page.tsx:37`, `users/[userId]/reviews/page.tsx:37` |
| Social RLS missing | `20260122000000_social_features.sql:74-83` |
| Reviews "coming soon" | `books/[slug]/page.tsx:201`, `comics/[slug]/page.tsx:101`, `papers/[slug]/page.tsx:101` |
| Partner portal stubs | `app/(portals)/partner/*` |
| Author earnings hardcoded | `app/(portals)/author/dashboard/page.tsx:46` |
| "AI" is trending | `lib/resonance/server.ts:16-30`, `discover/recommendations/page.tsx:9-20` |
| pgvector RPCs unused | `lib/supabase/queries.ts:314-333` |
| Analytics tracker dead | `lib/services/analytics-tracker.ts:127-134` |
| Growth rate hardcoded | `components/analytics/AnalyticsOverview.tsx:68` |
| Missing analytics RPCs | `lib/actions/analytics.ts` (`get_engagement_heatmap`, `get_geography_data`) |
| Email dead code | `lib/email/send.ts` (zero external callers) |
| Admin book create 404 | `/admin/books` → `/admin/books/new` (missing) |
| Manuscript review inert | `app/admin/manuscripts/page.tsx:55-58` |
| Duplicate content_type migration | `20260619124500_*` and `20260619162409_*` |
| UserMenu lacks role links | `components/shared/UserMenu.tsx` |
