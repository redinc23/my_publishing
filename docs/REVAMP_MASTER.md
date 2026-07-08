# MANGU Publishers — Master Revamp Document

**Everything left to revamp, end to end.**

> **Scope note:** This document deliberately **excludes** the "env secrets saving to local `.env.local`" workstream (Wave 0 secret intake, `.env.local` population, and the local secret-persistence tooling), which is being handled separately. Everything else — features, blockers, infrastructure, CI, testing, operations, documentation — is covered here.

**Snapshot basis:** commit `e6e1a12` on `main` (July 2026). Findings were verified against actual code, migrations, workflows, and every planning/status doc in the repo (`blockers/`, `docs/`, `docs/phase2/`, `.cursor/plans/`, `nexus_analysis/`, `finding-1*/`).

---

## Table of Contents

1. [How to Read This Document](#1-how-to-read-this-document)
2. [Current State: What Actually Works](#2-current-state-what-actually-works)
3. [P0 — Broken at Runtime (Schema ↔ Code Mismatches)](#3-p0--broken-at-runtime-schema--code-mismatches)
4. [P0 — Purchase Pipeline Is Not Closed](#4-p0--purchase-pipeline-is-not-closed)
5. [Core Product Features Left to Build or Wire](#5-core-product-features-left-to-build-or-wire)
6. [API Surface: Gaps and Security Holes](#6-api-surface-gaps-and-security-holes)
7. [Auth, Middleware & Access Control Gaps](#7-auth-middleware--access-control-gaps)
8. [AI / Resonance Engine — Advertised vs Real](#8-ai--resonance-engine--advertised-vs-real)
9. [Revenue, Payouts & Commerce Completeness](#9-revenue-payouts--commerce-completeness)
10. [Email & Notifications](#10-email--notifications)
11. [Reader Experience & Content Protection](#11-reader-experience--content-protection)
12. [Deployment & Infrastructure Consolidation](#12-deployment--infrastructure-consolidation)
13. [CI/CD Pipeline Gaps](#13-cicd-pipeline-gaps)
14. [Testing Debt](#14-testing-debt)
15. [Observability & Monitoring](#15-observability--monitoring)
16. [Database & Migration Debt](#16-database--migration-debt)
17. [Dependency & Tooling Debt](#17-dependency--tooling-debt)
18. [Dead Code, Dormant Modules & Repo Hygiene](#18-dead-code-dormant-modules--repo-hygiene)
19. [Documentation Debt & Cross-Doc Contradictions](#19-documentation-debt--cross-doc-contradictions)
20. [Operational Launch Blockers (Manual / Operator Work)](#20-operational-launch-blockers-manual--operator-work)
21. [Phase 2 Program Gates (Formal NO-GO Items)](#21-phase-2-program-gates-formal-no-go-items)
22. [Open GitHub Issues Backlog](#22-open-github-issues-backlog)
23. [Prioritized Roadmap (Suggested Epics)](#23-prioritized-roadmap-suggested-epics)

---

## 1. How to Read This Document

Statuses used throughout:

| Tag | Meaning |
|-----|---------|
| **BROKEN** | Will fail at runtime today (code contradicts schema or references missing things) |
| **SHELL** | A page/route exists but renders "coming soon" or placeholder content |
| **DORMANT** | Fully written code that is never imported/called anywhere |
| **PARTIAL** | Works, but a significant portion of the advertised behavior is missing |
| **MISSING** | Referenced or planned, but no implementation exists |
| **OPS** | Not a code change — requires an operator with credentials/access |

Priority bands: **P0** = breaks correctness or blocks launch, **P1** = advertised features that are empty or major infra consolidation, **P2** = quality/hardening, **P3** = cleanup and polish.

---

## 2. Current State: What Actually Works

To calibrate the rest of this doc, the following are genuinely implemented and wired:

- **Auth flows** — register, login, logout, password reset, email verify, OAuth callback (`app/(auth)/*`), with per-action in-memory rate limiting and Supabase session refresh in `middleware.ts` and a proactive client-side refresh in `AuthProvider`.
- **Catalog browsing** — `/books`, `/comics`, `/papers`, `/genres`, `/genres/[genre]`, `/authors/[id]`, `/audio` and `/audio/[id]`, with detail pages, cover images, Vimeo trailers, and audio samples.
- **Checkout entry** — `/checkout` page + `POST /api/checkout` creating a Stripe Checkout Session with user-identity verification.
- **Stripe webhook receipt** — signature verification, idempotency check, in-memory rate limiting (`app/api/webhook/route.ts`) — though the order it writes is wrong, see §4.
- **Author portal core** — manuscript submission, project list/detail, dashboard stats.
- **Admin area** — role-protected layout, read-only dashboards for users/books/manuscripts/orders, health dashboard, book edit form.
- **Analytics pipeline** — `POST /api/analytics/track` with validation, SSE stream, dashboard components (`AnalyticsDashboard`, charts, heatmaps).
- **Security headers** — full CSP/HSTS/COOP/CORP in `next.config.js`; CodeQL workflow active.
- **Blocker pipeline P0.1–P0.7 and P1.1–P1.6** — per `blockers/SUMMARY.md` and `blockers.yml`, all 13 tracked code blockers (lockfile, Node version, Upstash wiring, layout stub, email lazy-init, CI QA gates, Cloud Run probes, webhook code, cross-platform build) are **resolved in code**. What remains from that pipeline is operator work (§20).
- **Canonical deploy pipeline** — `cloudbuild.yaml` is the most complete path: lint → type-check → build → perf budget → secret audit → Docker → Trivy scan → Cloud Run deploy with Secret Manager and `/api/live` probes.

Everything below is what's left.

---

## 3. P0 — Broken at Runtime (Schema ↔ Code Mismatches)

These are not missing features — they are code paths that **will error or silently return wrong data** against the actual migration schema. They should be fixed before anything else, because several "built" features sit on top of them.

### 3.1 Queries against a non-existent `users` table

No migration creates a `users` table (the app uses `profiles` keyed to `auth.users`). Yet these query `from('users')` or embed `users` joins, and will fail:

| Location | What breaks |
|----------|-------------|
| `app/users/[userId]/reviews/page.tsx:37` | Public user-review pages 500 |
| `app/dashboard/my-reviews/page.tsx:37` (`author:users` join) | My Reviews page book-author display |
| `lib/actions/follows.ts:107–113, 140–145` (`users!user_follows_*` FK hints) | Followers/following lists |
| `lib/actions/reading-list.ts:164` (`author:users` join) | Reading list retrieval |
| `lib/actions/payouts.ts:77` | Author payout requests |
| `lib/services/export-queue.ts:266` | Export notification email lookup |

**Fix:** replace with `profiles` and correct FK hint names everywhere.

### 3.2 `books.author_id` → `authors(id)`, but code compares against `user.id`

The schema chain is `auth.users.id` → `profiles.id` → `authors.profile_id` → `books.author_id`. Multiple ownership checks skip two hops and compare `books.author_id` directly to the auth user id:

- `lib/actions/analytics.ts:25`
- `lib/actions/revenue.ts:24, 96`
- `lib/actions/books.ts` (multiple sites)
- `app/dashboard/books/[id]/analytics/page.tsx:41`

**Impact:** real authors are locked out of their own analytics/revenue; the author dashboard shows $0 earnings even when sales exist.

### 3.3 `authors.profile_id` misused as `user.id`

- `app/(portals)/author/dashboard/page.tsx:33`
- `app/(portals)/author/submit/actions.ts:19`
- `app/(portals)/author/projects/[id]/page.tsx:22`

Same class of bug as 3.2 — the author lookup by `profile_id` happens to work only if `profiles.id === auth.users.id` (which the trigger does guarantee), but the `books.author_id` comparisons do not. Audit and normalize the whole identity chain in one pass; add a helper like `getAuthorForUser()` in `lib/` and use it everywhere.

### 3.4 `reading_progress.user_id` FK ambiguity

`app/(consumer)/reading/[bookId]/page.tsx:21` and its actions write `user.id` where the initial schema references `profiles(id)`. Works only via the same id-equality coincidence — should be made explicit and tested.

### 3.5 Resonance embedding stored as string into a `vector(384)` column

`app/api/resonance/embed/route.ts:34` does `JSON.stringify(embedding)` into `resonance_vectors.embedding`. pgvector expects a vector literal; this insert will either fail or store garbage. Also the OpenAI embedding model dimensions must match 384 (current default models are 1536/3072 — verify the model or the column).

### 3.6 Wrong FK hint in recommendations API

`app/api/resonance/recommend/route.ts:92` joins `author:profiles!books_author_id_fkey` — but `books.author_id` references `authors`, not `profiles`. This join will error whenever the code path executes against a real schema.

---

## 4. P0 — Purchase Pipeline Is Not Closed

The single most important business flow — **buy a book, then read it** — is broken at three joints:

1. **Webhook order shape mismatch.** `app/api/webhook/route.ts:132–144` inserts `{ book_id, amount, stripe_session_id, ... }`, but `orders` (migration `20260116000000_initial_schema.sql:193–197`) requires `order_number` (NOT NULL UNIQUE) and `total_amount`. **The insert fails, so no order is ever recorded from a real payment.**
2. **No `order_items` / `book_sales` writes.** The library page reads purchases through `order_items`, and revenue dashboards read `book_sales`. The webhook populates neither, so even if the order insert were fixed, the library stays empty and revenue reads $0.
3. **No purchase gate on reading.** `/reading/[bookId]` never checks that the user purchased the book (see §11). Any logged-in user can open any book's reader.

**Also missing in this flow:**
- No purchase-confirmation email after webhook success (the `sendPurchaseConfirmation` template exists in `lib/email/`, never called — §10).
- `lib/stripe/webhooks.ts` is a **DORMANT duplicate** of the webhook route logic; one of the two must be deleted or made the single source.
- Library `BookCard` links to the book detail page, not the reader — "continue reading" flow doesn't exist.

**Revamp:** rewrite the webhook fulfillment to (a) generate an `order_number`, insert a schema-correct `orders` row, (b) insert `order_items`, (c) insert `book_sales` for revenue tracking, (d) send confirmation email, (e) all inside one logical transaction with idempotency; then add the purchase check to the reading route and wire library → reader links. Add an integration test with a Stripe test-mode fixture event.

---

## 5. Core Product Features Left to Build or Wire

### 5.1 Reading interface — **SHELL** (the core product!)

`app/(consumer)/reading/[bookId]/ReadingClient.tsx:57–58` renders placeholder text. There is no EPUB/PDF renderer at all. Progress tracking is a percentage slider with +1/−1 buttons autosaved every 30s — no page/chapter mapping, no `book_content.toc` integration, no EPUB CFI.

**Needed:** a real reader (e.g., epub.js for EPUB, pdf.js for PDF), fetching content via **signed URLs** (§11), purchase verification, resume-from-position, TOC navigation, and bookmarks (schema supports them).

### 5.2 Reviews & ratings — **built but unplugged**

The full stack exists: `reviews`/`review_votes` tables (`20260122000000_social_features.sql`), `lib/actions/reviews.ts`, `ReviewSection`, `ReviewForm`, `ReviewCard` components. But:

- Book/comic/paper detail pages render a **"coming soon" text stub** instead of mounting `ReviewSection` (`app/(consumer)/books/[slug]/page.tsx:201`, `comics/[slug]/page.tsx:101`, `papers/[slug]/page.tsx:101`).
- `ReviewActions.tsx:29–30` — Delete shows a toast but **never calls `deleteReview`**.
- `lib/actions/reviews.ts:38–39` — `reportReview` just `console.log`s; no moderation table, no admin queue.
- `ReviewSection` internals: "Most Helpful" tab empty (line 171), rating-distribution charts empty (179, 183), "Load More" has no handler (154).
- `/dashboard/my-reviews` — Write/Edit/Filter buttons are non-functional; page depends on the broken `users` join (§3.1).

**Revamp:** mount `ReviewSection` on all three detail page types, finish the in-component stubs, implement delete + report (add a `review_reports` table + admin moderation view), fix the joins.

### 5.3 Partner portal (ARC program) — **SHELL**

All four pages are placeholders: `partner/dashboard`, `partner/orders`, `partner/catalogs`, `partner/arc-requests` (`app/(portals)/partner/*/page.tsx`). `partner/orders/[id]` calls `notFound()` unconditionally. The schema (`partners`, `arc_requests` in the initial migration) has **no UI, no onboarding flow, no way to assign the `partner` role**, and middleware gates `/partner/*` on a role no one can obtain.

**Revamp:** partner onboarding (create `partners` row + role assignment by admin), ARC request submission/approval workflow, bulk order views, catalog browsing.

### 5.4 Readers Hub / library features — **SHELL**

`app/(consumer)/readers-hub/page.tsx:17–35` — My Library, Reading History, Wishlist cards are all "coming soon". Meanwhile:

- `ReadingList` component and `lib/actions/reading-list.ts` exist but link to `/dashboard/reading-list`, which **does not exist**.
- `ActivityFeed` component and `user_activities` writes exist, but no page mounts the feed.
- `/library` (**PARTIAL**) lists purchases via `orders` but has no read links and depends on the broken order pipeline (§4).

**Revamp:** build `/dashboard/reading-list` (or fold into readers-hub), wishlist, reading history from `reading_progress`, and mount the activity feed.

### 5.5 Social features — schema without product

From `20260122000000_social_features.sql`:

| Table | State |
|-------|-------|
| `comments` | **MISSING** — no UI, no actions at all |
| `user_follows` | Actions exist (`lib/actions/follows.ts`, with broken joins §3.1) — **no page** (`/dashboard/following` referenced but missing) |
| `user_activities` | Written by actions; **no feed page** |
| `reading_lists` | Component + actions; **no page** |

### 5.6 Book clubs — **SHELL**

`app/(consumer)/discover/book-clubs/page.tsx:12` — placeholder. No schema either. Decide: build (needs tables + UI + moderation) or remove from discover hub.

### 5.7 Missing routes referenced by live navigation/code

| Referenced path | Referenced from | Result today |
|-----------------|-----------------|--------------|
| `/authors` (index) | `Navigation.tsx:21`, `MobileNav.tsx:23` | **404 from the main nav** |
| `/admin/books/new` | `admin/books/page.tsx:23` | 404 from admin "New Book" |
| `/dashboard` | analytics page back-link | 404 |
| `/dashboard/reading-list` | `ReadingList` component | 404 |
| `/dashboard/following` | follows actions | 404 |
| `/dashboard/books/[id]/promotions` | `AIInsightsPanel.tsx:75` | 404 |
| `/dashboard/books/[id]/chapters/[n]/edit` | `ai-insights.ts:56` | 404 |

### 5.8 Author portal gaps

- `app/(portals)/author/analytics/page.tsx:12` — **SHELL** ("coming soon") while real analytics live at `/dashboard/books/[id]/analytics`; either build it or redirect.
- Author dashboard `earnings = 0` hardcoded (`author/dashboard/page.tsx:46`).
- Manuscript submission action doesn't handle the file upload itself (upload is a separate API; no linkage into `manuscripts` record dedup — `lib/actions/upload.ts:54` leaves `hash: ''`, TODO for dedup).
- No manuscript **review workflow**: admin manuscripts page Review button does nothing.

### 5.9 Admin CMS write-paths

Admin pages are read-only tables except book edit. Missing: book creation (`/admin/books/new`), manuscript approve/reject flow, user role management UI (how does anyone become `author`/`partner`/`admin` without SQL?), order refund/management, review moderation (pairs with 5.2).

### 5.10 Content & marketing pages

- `components/landing/Stats.tsx:5–26` — hardcoded fake stats ("50,000+ books", "10,000+ authors"). Replace with real counts or honest copy before launch.
- `/contact` — static page with **no form**.
- Homepage strategy (`docs/HOMEPAGE_STRATEGY.md`): static `public/homepage/v_a_1.html` is meant to serve at `/` but returned **404 in production** at last QA (`docs/OPERATOR_QA_LOG.md`) pending redeploy; the longer-term item is porting that homepage to React.
- Reviews tab on book detail is also a BRD requirement (`docs/BRD.md` §6.2) — same as 5.2.

### 5.11 Not-yet-started Phase 2+ features (from BRD / FEATURE_PHASES)

- **Audiobooks as a product** (BR-23): the `AudioPlayer` and `/audio` pages exist for samples/URLs, but there is no audio upload pipeline, streaming/CDN strategy, playback-position persistence, or purchase gating for audio.
- **Subscriptions**: `subscriptions` table exists, `subscription_tier='premium'` access model in BRD §7.2 — zero code.
- **Notifications**: `notifications` table exists — zero UI/dispatch code.
- **Social login** (Google/Facebook) — env placeholders only.
- **Mobile apps** — future.
- **Advanced analytics** (forecasting, funnels, A/B) — future.

---

## 6. API Surface: Gaps and Security Holes

| Route | Problem | Priority |
|-------|---------|----------|
| `POST /api/resonance/embed` | **No auth at all**, uses the admin (service-role) client, and calls OpenAI — any anonymous caller can burn OpenAI credits and write vectors. Lock to admin/service callers. | **P0 security** |
| `POST /api/resonance/track` | No auth; `user_id` in body is spoofable; inserts into `engagement_events` freely. | P1 |
| `GET /api/analytics/stream` | SSE stream over `analytics_events` with **no auth** — leaks platform activity to anyone. | P1 |
| `GET /api/health` | Posts debug telemetry to `http://127.0.0.1:7600/ingest/...` on every call (leftover agent debug code, `app/api/health/route.ts:69–76`) and leaks the Supabase project ref in its debug shape. **Remove.** | **P0 hygiene** |
| `GET /api/resonance/similar` | No rate limit; fine otherwise. | P2 |
| `POST /api/upload` | Uploads to the private `manuscripts` bucket but returns `getPublicUrl` (useless/misleading for a private bucket; and would be a leak if bucket goes public). Should return a signed URL or storage path. | P1 |
| Middleware rate-limits `/api/auth/*` | **Dead config** — no such routes exist. Either remove or move real auth actions behind such routes. | P3 |
| No `/api/books` | k6 load test hits it and accepts 404 — decide whether a public books API should exist. | P3 |

Rate limiting overall: **three parallel systems** exist — Upstash distributed (`lib/rate-limit.ts`, used only by middleware for auth pages + upload), an LRU in-memory limiter (`lib/utils/rate-limit.ts`, used by webhook/analytics/recommend), and a second auth-specific LRU (`lib/utils/auth-rate-limit.ts`, used by auth server actions). In-memory limiters are per-instance and reset on deploy — meaningless on Cloud Run with multiple instances. Plus a **DORMANT** fourth (`lib/middleware/rate-limit.ts`).

**Revamp:** unify on Upstash for everything user-facing; decide fail-open vs fail-closed **once** (currently `blockers` P0.5 documents fail-open while `finding-1/FINDING-1-READY.md` prescribes fail-closed — an unresolved policy contradiction), and apply the pending **Finding 1** patch (`finding-1-deploy/finding-1-distributed-rate-limiting.patch`) or supersede it; note `finding-1-deploy/APPLY.md` is a literal placeholder (`[APPLY.md content]`).

---

## 7. Auth, Middleware & Access Control Gaps

- **`/checkout` is not middleware-protected** — reachable logged out; only the server action fails later. Add to protected routes for coherent UX.
- **`/dashboard/*` is not middleware-protected** — pages do their own `redirect('/login')`; inconsistent with the rest of the app.
- **Middleware error fallback allow-list is incomplete** — on Supabase middleware failure, only `/`, `/books`, `/genres`, auth pages, and `/api` stay public; `/comics`, `/papers`, `/audio`, `/authors/[id]`, `/about`, `/contact` would bounce anonymous users to login during an outage (`middleware.ts` fallback list).
- **Role provisioning is missing** — there is no UI or flow to grant `author`, `partner`, or `admin` roles. Middleware and layouts gate on roles nobody can obtain without manual SQL. (Pairs with 5.3/5.9.)
- **No welcome email on register**; password reset relies solely on Supabase templates (§10).
- `AuthGuard` component is **DORMANT** (middleware does the job) — delete or use.
- Admin health page (`/admin/health`) exposes detailed system info — confirm role gating is airtight and reduce detail (flagged P3 in the hardening plan).
- Fail-open Upstash middleware limiting means **production without Upstash env = no distributed rate limiting at all**, silently (see §6 policy decision).

---

## 8. AI / Resonance Engine — Advertised vs Real

The "Resonance Engine" is marketed in the README/BRD as AI-powered recommendations. Actual state:

| Piece | Reality |
|-------|---------|
| `POST /api/resonance/embed` | Real OpenAI embeddings, but insecure (§6) and writes stringified JSON into a `vector(384)` column (§3.5) |
| `GET/POST /api/resonance/recommend` | **Popularity/recency query**, yet labels its response `algorithm: 'vector_similarity'` — misleading; also has the broken `profiles` FK join (§3.6) |
| `GET /api/resonance/similar` | Genre + `total_reads` match, not embeddings |
| `/discover/recommendations` page | Comment: "For now, return trending books" — trending query, no AI |
| `lib/resonance/server.ts` | Labels `vector_similarity` but sorts by `total_reads` |
| `lib/resonance/viral-logic.ts` | **DORMANT** — never imported |
| `lib/hooks/use-recommendations.ts`, `use-books.ts` | **DORMANT** — never used by any page |
| `lib/services/ai-insights.ts` | Pure heuristics presented as "AI insights" in `AIInsightsPanel`; links to non-existent promotion/chapter routes (§5.7); line 241 admits simplified peak prediction |
| Seed script | Can generate embeddings, so `resonance_vectors` may have data with nothing reading it correctly |

**Revamp:** implement real pgvector similarity (RPC with `<=>` distance over `resonance_vectors`), fix the embedding write format and model/dimension match, secure the embed endpoint, wire the discover page and hooks to the real engine, and stop labeling heuristics as vector similarity. Alternatively, if AI is deferred: honestly relabel everything "Trending/Popular" and remove the dormant code.

---

## 9. Revenue, Payouts & Commerce Completeness

- **`book_sales` is never written** by the purchase flow (§4) — `RevenueStats` and `getBookRevenue` read from an always-empty table.
- **`book_pricing`** — `updateBookPricing` action exists; **no UI anywhere** (admin or author) to manage pricing/discounts.
- **Author payouts** — `author_payouts`/`payout_items` schema exists; `lib/actions/payouts.ts` queries the non-existent `users` table (§3.1), uses a non-durable in-memory `Map` for rate limiting, and there is **no payouts UI and no Stripe Connect onboarding** for actually paying authors. This is the entire "publishers pay authors" half of the business.
- **Refunds** — the webhook has no `charge.refunded`/`payment_intent.refunded` handling; no admin refund tooling.
- **Order history UI** — README advertises it; `/library` is the closest thing; no dedicated order/receipt views.
- **Subscriptions** (BRD Phase 2) — schema only, no Stripe subscription integration.
- Excel export (`lib/actions/export-data.ts:117`) returns a CSV placeholder; entire `export-queue.ts` service is **DORMANT** (never imported by a route).

---

## 10. Email & Notifications

`lib/email/send.ts` + `templates.tsx` (Resend) are fully written and **never called from anywhere** in the app:

- No welcome email on registration.
- No purchase confirmation on webhook success.
- No manuscript status notifications to authors.
- No payout notifications.
- `notifications` table has no writers or readers.

**Revamp:** wire `sendWelcomeEmail` into register, `sendPurchaseConfirmation` into the webhook (post §4 fix), manuscript status transitions into admin actions; add in-app notifications (writer + a bell/inbox UI) or drop the table. Requires `RESEND_API_KEY` in prod (`SKIP_EMAILS=true` escape hatch already exists).

---

## 11. Reader Experience & Content Protection

Beyond the reader UI itself (§5.1):

- **`published-epubs` bucket is public** (`20260117000006_storage_policies.sql`) and all content URLs are plain public URLs. **There is zero content protection** — anyone with a URL has the book. Decide DRM posture: at minimum, private bucket + short-lived signed URLs issued only after a purchase check.
- **No purchase gate** on `/reading/[bookId]` (§4).
- `book_content.epub_url/pdf_url/audio_url` exist in schema but the reading page never fetches them.
- Virus scanning on uploads is a **placeholder trigger that only logs** (`storage_policies.sql:29–34`) — integrate a real scanner (e.g., bucket-triggered Cloud Function + ClamAV) or remove the pretense.
- `AudioPlayer` streams direct unsigned URLs — same protection gap for paid audio.
- Only signed-URL usage in the codebase is in the dormant `export-queue.ts`.

---

## 12. Deployment & Infrastructure Consolidation

The repo currently carries **four deploy paths** that disagree with each other. `docs/CANONICAL_PRODUCTION.md` decided Cloud Run via `cloudbuild.yaml` (issue #70 closed) — the rest is un-executed cleanup:

| Path | State | Action |
|------|-------|--------|
| **Cloud Build → Cloud Run** (`cloudbuild.yaml`) | Canonical, most complete | Keep; fix gaps below |
| **GH Actions → Cloud Run** (`.github/workflows/deploy.yml`) | Parallel source-deploy that bypasses the canonical pipeline (no Trivy/perf/secret-audit; secrets via `env_vars` not Secret Manager) | Delete, or rewrite to `gcloud builds submit --config=cloudbuild.yaml` |
| **Vercel** (`ci.yml` deploy job + `vercel-deploy.yml`) | `vercel-deploy.yml` is an **incomplete stub** (ends at line 32, no deploy step); `ci.yml` deploy is conditional on `VERCEL_TOKEN` | Keep only as preview path or delete; kill the stub workflow |
| **AWS Amplify** (`amplify.yml`, `.amplifyignore`, docs) | **Likely broken**: publishes raw `.next/` while `output: 'standalone'` is set; weaker conflicting headers (X-Frame-Options SAMEORIGIN vs DENY, no CSP); LAUNCH_CHECKLIST still Amplify-centric | Remove entirely per canonical decision, incl. `AMPLIFY_READY.md`, Amplify docs, `.amplifyignore` |

Additional infra items:

- **`deploy_master.sh` conflicts with canon** — deploys service `publishing-house-web` to AR repo `publishing-repo` (canon: `mangu-publishers` / `web-images`), pushes **all** `.env.production` values including secrets as plain env vars, and bypasses every quality gate. Delete or align.
- **`cloudbuild.yaml` gaps**: no unit tests in pipeline; no e2e; `_NEXT_PUBLIC_*` substitutions default to empty (build silently produces a client bundle with missing config if the trigger isn't configured); `SHORT_SHA` not passed as build-arg for release tracking; duplicate `npm run build` (Cloud Build step + Docker build — issue #69).
- **Rollback story** (issue #65): no tagged known-good revisions, `KNOWN_GOOD_REVISION` intake field unfilled, runbook incomplete.
- **Firebase Hosting edge / CDN (Phase 2 M6)**: not executed.
- **Multi-repo admin cruft**: `setup-envs.sh`, `cleanup-envs.sh`, `verify-setup.sh`, `repos.txt` (placeholder `your-org/app-*`), `.github/workflows/admin-setup.yml` — boilerplate for a different multi-app org setup. Remove from this repo or move to an ops repo.
- **`setup.sh`** overwrites `.env.example` with a generic template mentioning Prisma/Django — not this project. Fix or delete.
- **Hardcoded project identifiers**: `scripts/gcloud-build-submit.sh` defaults `PROJECT_ID=delta-wonder-488420-i3`; `scripts/apply-supabase-migrations.sh` hardcodes Supabase ref `tkzvikozrcynhwsqtkqp`; hardcoded fallback URLs (`mangu.com`, `localhost:3000`) flagged in hardening plan — parameterize.
- **Repo rename** `my_publishing` → `mangu-publishers` (issue #71) still pending.

---

## 13. CI/CD Pipeline Gaps

- **No e2e in any workflow** — Playwright never runs in CI; `playwright.config.ts` starts `npm run dev`, which runs `validate-env` first and will fail without a CI env strategy. Needs a CI profile (env stub or `USE_MOCKS` path that actually works — see §18 on mock-data being unwired).
- **`auto-merge.yml` watches the wrong workflow** — it gates merges on "Vercel Build, Test & Deploy" (the incomplete stub) instead of "CI/CD Pipeline", so **AI-agent PRs can auto-squash-merge before real CI passes**. This is how schema-breaking code likely landed. Fix immediately.
- **`vercel-deploy.yml`** — truncated stub duplicating parts of `ci.yml`; hardcodes Node 20 instead of `.nvmrc`. Delete or finish.
- **`supabase-migrate.yml`** — pushes migrations on merge with no dry-run, no rollback plan, no post-migrate health check, and will trip on the duplicate migration (§16).
- **`fix-lockfile.yml`** — one-shot maintenance workflow whose own comments say to delete it after use. Delete.
- **No staging/preview environment** pipeline (unless Vercel previews are formally adopted).
- **Secret requirements for CI are undocumented** (`SUPABASE_*`, `STRIPE_*`, `VERCEL_*`, `GCP_SA_KEY`, `GH_PAT`, `SUPABASE_ACCESS_TOKEN`...). RICEF C.5 lists this open; `OPERATOR_QA_LOG` says 5 secrets were configured — reconcile and document the full matrix in one place.
- **`validate-env` is not part of build/CI** (hardening plan P2) — builds can succeed with missing env and fail at runtime.
- **Pre-commit hooks** (issue #72): prettier exists but no `format` script, no husky/lint-staged.
- `codeql.yml` manual-build branch is an `exit 1` stub (harmless under `build-mode: none`, but tidy it).
- `bug-to-issue.yml` depends on exact CI workflow-name match — fragile; revisit when workflows are consolidated.

---

## 14. Testing Debt

**Unit tests: 25 `it()` blocks across 6 files** for a 100+ module codebase:

- Coverage is limited to: featured-books caching, revalidate-tag helpers, two rate-limiter wrappers, an analytics batching util, and `BookCard` rendering.
- **Zero tests** for: any API route (checkout, webhook, resonance, analytics), middleware auth/role logic, server actions (reviews, follows, payouts, revenue, books, upload), the identity-chain helpers that §3 shows are broken.
- **Duplicate test files**: `tests/unit/queries.test.ts` vs `lib/supabase/queries.test.ts` — consolidate.
- `tsconfig.json` **excludes `tests/`** — test files aren't type-checked by `tsc`.
- Jest 29 with `jest-environment-jsdom@^30` — version skew (§17).

**E2E: 30 tests across 4 specs, never run in CI:**

- `purchase-flow.spec.ts` — the actual purchase flow is **commented out**; only page-load checks remain.
- `auth-flow.spec.ts` — 3 tests skip without a real Supabase URL.
- Smoke specs are static-ish and runnable.

**Missing entirely:** webhook fulfillment integration test (Stripe fixture events), RLS policy tests in CI (`verify-rls.ts` exists but is manual and some checks pass on RPC failure), k6 load test wiring (or drop it), no coverage reporting or thresholds, no `test:ci` script.

**Target state:** unit tests for every server action and API route with a mocked Supabase layer; integration tests for webhook + checkout with Stripe test fixtures; Playwright smoke suite in CI on every PR against a seeded ephemeral Supabase (or well-designed mock mode); purchase-flow e2e in a nightly job with Stripe test mode.

---

## 15. Observability & Monitoring

Currently: `console.*` everywhere, nothing else.

- **Sentry is not installed** — `NEXT_PUBLIC_SENTRY_DSN` placeholders exist in env examples, `ErrorBoundary` has a commented-out `Sentry.captureException`, no `@sentry/nextjs` dependency. Phase 2 P0-9 (Sentry release tagging) is a formal acceptance gate. Install and wire, or remove the placeholders.
- **No structured logging** (pino/winston) for API routes/server actions — Cloud Run logs are unstructured console spam.
- **No GCP uptime checks, alerting policies, or billing budgets** in code/config (Phase 2 M7a items) — nothing pages anyone if prod dies.
- **No release/version tagging** — `SHORT_SHA` isn't injected into the app, so you can't tell which build is serving.
- The custom in-app analytics (Supabase-backed) exists but the SSE stream is unauthenticated (§6) and the dashboards depend on data (RPCs/materialized views) that may be empty — verify `book_stats` materialized view refresh strategy (cron/trigger) is actually scheduled.
- Health-check debug ingest to `127.0.0.1:7600` must be removed (§6).

---

## 16. Database & Migration Debt

- **Duplicate migrations**: `20260619124500_add_content_type_to_books.sql` and `20260619162409_add_content_type.sql` both add `content_type`. Idempotent via `IF NOT EXISTS`, but they corrupt the mental model and can wedge `supabase db push` history. Remove one (with care for environments that already applied both).
- **README migration list is stale/wrong**: it lists 12 migrations and names `20260117000000_storage_policies.sql`; the directory has **15 files** and storage policies are actually `20260117000006_...`. The comment in `app/api/health/route.ts` repeats the wrong filename.
- **`scripts/run-migrations.ts` is broken by default** — relies on a custom `exec_sql` RPC that doesn't exist in a fresh project; `npm run db:migrate` therefore fails and falls back to "do it manually". Either ship the `exec_sql` function in a migration, or delete the script and standardize on Supabase CLI (`supabase-migrate.yml` + `supabase db push`), which is issue #67 (migration automation) anyway.
- **No `supabase/config.toml`** — `supabase start` local development isn't configured.
- **No `supabase/seed.sql`** — seeding only via `scripts/seed-database.ts` (needs live project + optional OpenAI).
- **`verify-migrations.sh`** only counts files — add duplicate/ordering detection.
- **Missing schema for shipped concepts**: no `users` view/table compatibility layer (or fix the code, §3.1), no `review_reports`, no book-club tables (if kept), and verify all tables queried by `follows`/`reading-list` embedded joins have the FK names the code hints at.
- **RLS confidence**: `verify-rls.ts` exists but isn't in CI and some checks pass when the RPC fails. Given the identity-chain bugs (§3), an explicit RLS test pass over `orders`, `reading_progress`, `reviews`, `manuscripts`, and storage buckets is warranted.
- Materialized view refresh (`book_stats`) — confirm a scheduled refresh exists; otherwise stats silently go stale.

---

## 17. Dependency & Tooling Debt

| Item | Problem |
|------|---------|
| `@supabase/ssr@^0.1.0` | Very old; multiple majors behind; auth cookie handling has evolved significantly |
| `@next/bundle-analyzer@^16.2.9` | Major version far ahead of Next 14 — misaligned |
| `jest@^29` + `jest-environment-jsdom@^30` | Version skew, flagged in hardening plan |
| `@upstash/ratelimit` pinned `1.1.3` exactly | Fine, but the reason (lockfile incident) is only recorded in a workflow comment; document or unpin |
| No `format` script / husky / lint-staged | Prettier configured but unenforced (issue #72) |
| `pages/_document.tsx` | Legacy Pages Router remnant alongside App Router — remove if truly unused |
| Duplicate `ErrorBoundary` | `components/common/ErrorBoundary.tsx` vs `components/shared/ErrorBoundary.tsx`; **neither is mounted in the root layout** — pick one, mount it, delete the other |
| `tsconfig` excludes `tests/` | Tests escape type-checking |
| Next.js 14.2.x | Not urgent, but a Next 15 / React 19 upgrade decision belongs on the roadmap while the test suite is being built up |

---

## 18. Dead Code, Dormant Modules & Repo Hygiene

**DORMANT lib modules (written, never imported):**

- `lib/utils/mock-data.ts` — the entire mock catalog. **Important:** `IMPLEMENTATION_STATUS.md` and the `USE_MOCKS` env flag claim the app falls back to mock data; **it does not** — nothing imports this module. Either wire it into the query layer behind `useMocks()` (which would also unlock env-less CI/e2e) or delete it and correct the docs.
- `lib/email/send.ts` / `templates.tsx` (§10)
- `lib/services/export-queue.ts`, `performance-monitor.ts`, `analytics-tracker.ts`
- `lib/resonance/viral-logic.ts`
- `lib/hooks/use-recommendations.ts`, `use-books.ts`
- `lib/stripe/webhooks.ts` (duplicate of the webhook route)
- `lib/middleware/rate-limit.ts` (third rate limiter)
- `getGeneralLimiter()` in `lib/rate-limit.ts`

**Unmounted components:** `ReviewSection`/`ReviewForm` (§5.2), `ActivityFeed`, `ReadingList`, `CreateBookForm`, `BookUploadForm`, `AuthorCard`, `VideoHero`, `layout/Hero`, `AuthGuard`, both `ErrorBoundary`s.

**Stale artifacts to prune or archive:**

- `nexus_analysis/` — generic recovery-kit output (claims "100/100 health, no blockers"; not MANGU-specific, contradicts everything). Remove.
- `docs/NEXUS_RECOVERY_KIT.md`, `scripts/nexus-rollout.sh`, `scripts/nexus_analyzer.py` — template tooling for a Fastify/Neon stack, orthogonal to this app.
- `finding-1/` + `finding-1-deploy/` — resolve the patch (apply or supersede per §6) then remove; `APPLY.md` is a literal placeholder string.
- `blockers/README.md` + `blockers/STATUS.md` — stale one-liners contradicting `SUMMARY.md` (which says 7/7 P0 resolved). Update or collapse into SUMMARY.
- `repos.txt`, `setup-envs.sh`, `cleanup-envs.sh`, `verify-setup.sh`, `admin-setup.yml` — foreign multi-repo tooling (§12).
- `AMPLIFY_READY.md`, `COMPLETE_FILE_LIST.md` (stale inventory), `.amplifyignore`, `amplify.yml` — post-Amplify-removal.
- `docs/cli_audit_report.md` references a separate CLI PoC living outside this repo — clarify or drop.
- Old branches/PRs: RICEF E.7 PR-triage (close superseded agent PRs) partially done; finish it.

---

## 19. Documentation Debt & Cross-Doc Contradictions

The docs tree is large and internally inconsistent. Key reconciliations needed:

| Contradiction | Docs involved | Resolution needed |
|---------------|---------------|-------------------|
| P0 blockers "in flight" vs "7/7 resolved" | `blockers/README.md`, `STATUS.md` vs `SUMMARY.md`/`blockers.yml` | Update README/STATUS to final state |
| RICEF waves "all pending, don't merge PR #73" vs PR #73 merged + secrets configured | `.cursor/plans/mangu_publishers_master_ricef.md` vs `docs/OPERATOR_QA_LOG.md` | Refresh RICEF statuses |
| Canonical prod "pending decision" vs decided (Cloud Run, #70 closed) | RICEF R.4.1 vs `docs/CANONICAL_PRODUCTION.md` | Mark closed everywhere |
| Fail-open vs fail-closed rate limiting | `blockers.yml` P0.5 vs `finding-1/FINDING-1-READY.md` | One policy decision (§6) |
| Health probes open vs resolved | hardening plan §8 vs blockers P1.2 | Verify in `cloudbuild.yaml`, close |
| Launch checklist targets Amplify | `docs/LAUNCH_CHECKLIST.md` vs canonical Cloud Run | Rewrite checklist for Cloud Run |
| BRD says deploys via "AWS Amplify / Vercel" | `docs/BRD.md` §9 | Update to Cloud Run |
| Phase 2 `_sources` describe Vite/Sanity/Nginx/`dist/` | `docs/phase2/_sources/*` vs actual Next.js/Supabase | Complete `DEV_HANDOFF_NEXTJS_ALIGNMENT.md` checklist (currently all unchecked) |
| Expected health `"status":"healthy"` vs prod returns `"status":"ok"` | LAUNCH_CHECKLIST vs OPERATOR_QA_LOG | Align endpoint contract + docs |
| Mock-data fallback claimed but not implemented | `docs/IMPLEMENTATION_STATUS.md`, README notes | Fix code or docs (§18) |
| README migration list (12, wrong filename) vs 15 actual files | `README.md` vs `supabase/migrations/` | Regenerate |
| `.docx` planning doc diverges from markdown | `docs/phase2/change-log-and-decisions.md` open item | Declare markdown canonical |
| Homepage "static at `/`" vs 404 in prod | `docs/HOMEPAGE_STRATEGY.md` vs `OPERATOR_QA_LOG.md` | Redeploy resolves; then update log |

Also: consolidate the sprawling doc tree (74+ markdown files) — a single `docs/README.md` index marking each doc **canonical / historical / deprecated** would prevent the next agent from trusting `nexus_analysis` or the Amplify checklist.

---

## 20. Operational Launch Blockers (Manual / Operator Work)

Everything here is **OPS** — requires a human with credentials. From `docs/OPERATOR_QA_LOG.md`, `docs/CANONICAL_PRODUCTION.md`, `blockers/SUMMARY.md`, and the operator walkthrough:

1. **`gcloud auth login` is the hard blocker** — token refresh failed at last session (2026-05-31), which blocks: Secret Manager sync (`./scripts/sync-gcp-secrets-from-env.sh`), Cloud Build submit (`./scripts/gcloud-build-submit.sh`), and production verification (`./scripts/verify-gcp-production.sh`). Production is serving a **stale revision** (old homepage, `/homepage/v_a_1.html` 404s).
2. **Supabase production migrations** — apply all 15 in order (SQL editor or CLI); confirm `profiles` exists and `/api/health?ready=1` passes. Optionally seed.
3. **Stripe production webhook** — create the dashboard endpoint for `https://mangu-publishers.com/api/webhook`, store `whsec_` in Secret Manager. (Blocked on the §4 code fix being deployed first, or payments will "succeed" without fulfilled orders.)
4. **Custom domain** — verify Cloud Run domain mapping, DNS, SSL for `mangu-publishers.com`; set `NEXT_PUBLIC_SITE_URL` to match.
5. **Cloud Build trigger substitutions** — `_NEXT_PUBLIC_*` values must be set on the trigger or builds ship empty client config.
6. **Manual browser QA — all 10 items unchecked** in `OPERATOR_QA_LOG.md`: register, profile row verification, login/logout, password reset, non-admin blocked from `/admin`, admin health page, browse `/books`, Stripe test checkout (4242…), webhook event received, new homepage at `/`.
7. **Rollback preparation** — record `KNOWN_GOOD_REVISION`, test a traffic-shift rollback (issue #65).
8. **Monitoring** — uptime checks, alerting, billing budgets (pairs with §15; Phase 2 M7a).

---

## 21. Phase 2 Program Gates (Formal NO-GO Items)

The `docs/phase2/` package defines a formal acceptance program that is **entirely unexecuted** — `11-handoff-master-checklist.md` declares automatic **NO-GO** until complete:

- **Milestones M0–M7b** — all TODO: pre-flight (M0), local security hardening (M1), build pipeline scripts (M2), runtime container (M3), GCP foundation (M4), Cloud Build E2E (M5), Firebase hosting + domain (M6), pre-cutover guardrails/monitoring/budgets (M7a), post-cutover stabilization (M7b). Command-level detail in `05-milestone-implementation-plan.md`.
- **Acceptance tests P0-1 through P0-9** — all PENDING (`06-acceptance-and-test-protocol.md`), including P0-8 (content-rebuild automation) and P0-9 (Sentry + uptime observability).
- **Cutover runbook** (`13-cutover-day-runbook.md`) — T-24h/T-2h/T-30m gates all pending; precondition is migration evidence in the signoff log.
- **RACI** (`12-ownership-raci.md`) — all owner slots are worksheet placeholders; risk register R1–R11 in `08-risk-and-troubleshooting.md` all open with owners pointing at the unfilled RACI.
- **Evidence & signoff log** (`14-evidence-and-signoff-log.md`) — every entry PENDING.
- **Intake artifacts** — `FIELDS_TO_GATHER.md` and `environment.local.sh` partially filled (`PROJECT_ID` only; domain, slugs, RACI names, known-good revision missing).
- **Doc alignment** — `DEV_HANDOFF_NEXTJS_ALIGNMENT.md` checklist (translating Vite/Sanity/Nginx-era sources to the real Next.js/Supabase stack) fully unchecked.

Note: parts of this program are stale relative to reality (some M4/M5 work already exists via `cloudbuild.yaml`). The first Phase 2 task is a **reconciliation pass**: mark what's actually done, then execute the genuine remainder (chiefly M6, M7a/M7b, P0 tests, RACI, signoffs).

---

## 22. Open GitHub Issues Backlog

From RICEF and the end-to-end doc:

| Issue | Priority | Topic | Status |
|-------|----------|-------|--------|
| #65 | P1 | Cloud Run rollback tags + runbook | Open |
| #66 | P1 | Health probes | Likely done (blockers P1.2) — verify & close |
| #67 | P1 | Migration automation | Open (see §16) |
| #68 | P2 | Secret scanning expansion | Open |
| #69 | P2 | Duplicate `npm run build` in Cloud Build | Open |
| #70 | — | Canonical prod decision | Closed (Cloud Run) — propagate to docs |
| #71 | P3 | Repo rename `my_publishing` → `mangu-publishers` | Open |
| #72 | P3 | Pre-commit hooks (husky/lint-staged) | Open |

Plus RICEF E.7: close remaining superseded agent PRs / stale branches.

---

## 23. Prioritized Roadmap (Suggested Epics)

### Epic A — Make the money path real (P0)
1. Fix all schema↔code identity mismatches (§3.1–3.4) with a shared `getAuthorForUser()`/`profiles`-only convention.
2. Rewrite webhook fulfillment: correct `orders` insert + `order_items` + `book_sales` + confirmation email + idempotency (§4, §10).
3. Purchase gate + signed URLs for `/reading/[bookId]` and audio; make `published-epubs` private (§11).
4. Integration tests for checkout→webhook→library (§14).

### Epic B — Security hotfixes (P0)
5. Lock down `/api/resonance/embed`; auth the analytics SSE stream; auth/validate `resonance/track` (§6).
6. Remove the `127.0.0.1:7600` debug ingest from `/api/health` (§6).
7. Fix `auto-merge.yml` to gate on the real CI workflow (§13).
8. Unify rate limiting on Upstash; resolve fail-open vs fail-closed; apply or supersede Finding 1 (§6).

### Epic C — Ship the reader (P1)
9. Real EPUB/PDF reader with TOC, position sync, bookmarks (§5.1).
10. Library → reader continuity; reading history (§5.4).

### Epic D — Ship the advertised social layer (P1)
11. Mount `ReviewSection` on all detail pages; finish delete/report/moderation (§5.2).
12. Reading lists, wishlist, activity feed, follows pages; fix broken joins (§5.4, §5.5).
13. `/authors` index page and the other 404ing nav/code references (§5.7).

### Epic E — Portals & admin write-paths (P1)
14. Partner onboarding + ARC workflow (§5.3).
15. Admin: book create, manuscript review workflow, role management, review moderation (§5.9).
16. Author: real analytics page or redirect; earnings from `book_sales`; pricing UI (§5.8, §9).

### Epic F — Deploy/CI consolidation (P1)
17. Delete Amplify path, `deploy.yml` (or rewrite to cloudbuild), `vercel-deploy.yml` stub, `deploy_master.sh`, `fix-lockfile.yml`, multi-repo admin cruft (§12, §13).
18. Add unit tests + (env-strategy) e2e to the pipeline; document the CI secret matrix; wire `validate-env` into CI (§13).
19. Migration hygiene: dedupe `content_type`, standardize on Supabase CLI, fix docs, add `config.toml` (§16).

### Epic G — Observability (P1)
20. Sentry, structured logging, uptime checks, alerting, budgets, release tagging (§15).

### Epic H — Payouts & revenue completion (P2)
21. Stripe Connect onboarding + payouts UI; refund handling; order history views (§9).

### Epic I — Real Resonance or honest relabeling (P2)
22. pgvector similarity with correct embedding writes and dimensions, secured embed, wired discover page — or relabel as Trending and delete dormant AI code (§8).

### Epic J — Email & notifications (P2)
23. Wire all transactional emails; notifications table + UI or removal (§10).

### Epic K — Hygiene & docs (P2–P3)
24. Delete/mount dormant modules & components; remove stale artifacts (nexus, finding-1, blockers one-liners) (§18).
25. Reconcile every contradiction in §19; produce a canonical docs index; rewrite LAUNCH_CHECKLIST for Cloud Run.
26. Dependency alignment: `@supabase/ssr`, bundle-analyzer, jsdom skew; pre-commit hooks (§17).

### Epic L — Operate the launch (OPS, parallel to everything)
27. §20 items 1–8: gcloud auth → secrets → deploy → migrations → Stripe webhook → domain → manual QA → rollback prep.
28. Phase 2 program reconciliation and execution (§21).

---

*This document supersedes the "what's missing" sections scattered across `blockers/`, the hardening plan, RICEF, and `IMPLEMENTATION_STATUS.md` as the single inventory of remaining revamp work (excluding the env-secrets-to-local workstream).*
