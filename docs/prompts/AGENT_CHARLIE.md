# MANGU Publishers: AI Revamp Prompt — AGENT CHARLIE

**Role:** Lead Platform / AI / B2B Engineer  
**Codename:** AGENT CHARLIE  
**Your slice:** Resonance Engine, analytics telemetry, partner portal, social follows, tech debt consolidation, Phase 2 doc alignment (technical portions)  
**Do NOT touch:** `ReadingClient.tsx`, `lib/email/send.ts`, `app/api/webhook/route.ts`, `app/api/checkout/route.ts`

---

## Context

MANGU Publishers has AI recommendation infrastructure (pgvector, OpenAI embeddings, RPCs) but the runtime uses popularity fallbacks. Analytics tracker exists but is never called. The entire partner portal is stub UI. Duplicate rate-limiters and ErrorBoundaries need consolidation.

You are **AGENT CHARLIE**. Alpha owns reading/reviews; Bravo owns email/payments/E2E.

**Companion prompts:** `docs/prompts/AGENT_ALPHA.md`, `docs/prompts/AGENT_BRAVO.md`

---

## System directives

1. **Wire before you build** — `use-recommendations.ts`, `analytics-tracker.ts`, `viral-logic.ts`, `follows.ts` exist. Wire or delete dead code; don't duplicate.
2. **Fix docs as you go** — Resonance, analytics, partner portal, Phase 2 Next.js alignment (your sections).
3. **Ignore local secrets** — No `.env.local`, setup scripts, GCP sync-from-local.
4. **Graceful degradation** — Resonance must fall back to genre/popularity when `OPENAI_API_KEY` missing.
5. **Consolidate, don't duplicate** — One rate limiter, one ErrorBoundary.
6. **Branch naming** — `cursor/charlie-resonance-partner-debt-9e38`

---

## Stack reference

- **AI:** OpenAI embeddings, pgvector, RPCs `get_similar_books` / `get_recommendations` (in migrations)
- **Rate limit:** Upstash Redis via `@upstash/ratelimit` in `lib/utils/rate-limit.ts`
- **Partner RBAC:** `middleware.ts` allows `partner` and `admin` roles on `/partner/*`
- **Phase 2 docs:** Written for Vite/Nginx/Sanity — must align to Next.js standalone port 3000

---

## Your tasks (execute in order)

### CHARLIE-1: Resonance Engine — Real pgvector (P1)

**Targets:**
- `app/api/resonance/recommend/route.ts`
- `lib/resonance/server.ts`
- `lib/resonance/embeddings.ts`
- `lib/hooks/use-recommendations.ts`
- `app/(consumer)/discover/recommendations/page.tsx`
- `app/(consumer)/books/[slug]/page.tsx` (`getSimilarBooks` function)

**Current state:**
- Recommend API uses `popularity_recency_v1` scoring (views + purchases + recency)
- `lib/resonance/server.ts` labels algorithm `vector_similarity` but queries by `total_reads`
- Discover page queries trending books directly, bypassing API
- Book detail "similar" uses genre filter only
- `use-recommendations.ts` has zero consumers

**Actions:**
1. Read migrations for `get_similar_books` / `get_recommendations` RPC signatures.
2. Update `recommend/route.ts`:
   - Try pgvector RPC when embeddings exist for anchor book/user
   - Fall back to `popularity_recency_v1` when no embeddings or no OpenAI key
   - Return `algorithm` field accurately (`vector_similarity_v1` vs `popularity_recency_v1`)
3. Update `discover/recommendations/page.tsx` to call `/api/resonance/recommend` (server-side fetch or server action).
4. Update book detail `getSimilarBooks` to use resonance API/RPC with book ID, fallback to genre.
5. Wire `use-recommendations.ts` into at least one client component OR delete if unused after server wiring.
6. Delete or wire `lib/resonance/viral-logic.ts`.

**Acceptance criteria:**
- [ ] Recommendations use vectors when data + key available
- [ ] Graceful fallback when OpenAI key missing
- [ ] Discover page and book detail use resonance path
- [ ] No misleading algorithm labels in logs/responses
- [ ] Docs updated

---

### CHARLIE-2: Analytics Telemetry & Author Earnings (P1)

**Targets:**
- `lib/services/analytics-tracker.ts`
- `components/analytics/AnalyticsOverview.tsx`
- `app/(portals)/author/dashboard/page.tsx` (earnings hardcoded `0`)
- `app/(portals)/author/analytics/page.tsx` (stub)
- `app/dashboard/books/[id]/analytics/page.tsx` (reference implementation)

**Current state:**
- `analytics-tracker.ts` exported but never imported
- `AnalyticsOverview.tsx`: `growthRate: 0` hardcoded TODO
- Author dashboard: `const earnings = 0`
- Author analytics page: "coming soon" stub
- Per-book analytics at `/dashboard/books/[id]/analytics` is fully built

**Actions:**
1. Wire `trackView` on book detail pages (server or client mount).
2. Wire `trackRead` — **COORDINATION:** call from Alpha's `ReadingClient` if merged; otherwise add hook in reading page wrapper Charlie can merge later.
3. Wire purchase tracking in webhook (**COORDINATION:** prefer Bravo adds call in webhook; if not merged, add in analytics-tracker export for Bravo to import).
4. Fix `AnalyticsOverview.tsx` — calculate `growthRate` from historical `analytics_events` or `book_stats` (compare current vs prior period).
5. Author dashboard: query `author_payouts` / revenue tables for real earnings.
6. Author analytics page: reuse `AnalyticsDashboard` component pattern from per-book analytics, scoped to author's books.

**Acceptance criteria:**
- [ ] Analytics events fire on view (and read when reading exists)
- [ ] Growth rate is computed, not hardcoded 0
- [ ] Author dashboard shows real earnings
- [ ] Author analytics page is functional, not stub
- [ ] Docs updated

---

### CHARLIE-3: Partner Portal B2B UI (P1)

**Targets:**
- `app/(portals)/partner/dashboard/page.tsx`
- `app/(portals)/partner/arc-requests/page.tsx`
- `app/(portals)/partner/catalogs/page.tsx`
- `app/(portals)/partner/orders/page.tsx`
- `app/(portals)/partner/orders/[id]/page.tsx` (currently `notFound()`)

**Current state:** All routes are "coming soon" shells with `eslint-disable`. Order detail immediately 404s.

**Actions:**
1. Audit schema for partner-relevant tables (orders, books, ARC if exists — grep `arc`, `partner`, `institution`).
2. If ARC tables missing, add minimal migration: `arc_requests` (partner_id, book_id, quantity, status, notes).
3. Build partner dashboard:
   - Summary cards: pending ARC requests, recent orders, catalog size
   - Quick links to sub-pages
4. ARC requests: list + create form (request copies for institutional review).
5. Catalogs: browse published books available to partners (filter by partner agreement or all published).
6. Orders: list institutional/bulk orders; detail page shows line items.
7. Remove all `eslint-disable` stubs and "coming soon" text.
8. Match UI patterns from author portal (Card, Table, Container).

**Out of scope:** Readers Hub, wishlist (Alpha), email on ARC approval (Bravo).

**Acceptance criteria:**
- [ ] Partner dashboard shows real data
- [ ] ARC request CRUD works
- [ ] Orders list + detail work (no `notFound()` stub)
- [ ] RBAC still enforced via middleware
- [ ] Docs updated

---

### CHARLIE-4: Social Features — Follows (P2)

**Targets:**
- `lib/actions/follows.ts` (exists)
- Author profile pages: `app/(consumer)/authors/[id]/page.tsx`
- New route if needed: `app/dashboard/following/page.tsx`

**Current state:** Follow actions exist; no UI; no `/dashboard/following` route.

**Actions:**
1. Add Follow/Unfollow button on author profile pages.
2. Create `/dashboard/following` showing who user follows.
3. Optional: follower count on author profile (query `user_follows`).

**Out of scope:** Comments, book clubs (stub page stays or minimal redirect), reading lists (Alpha).

---

### CHARLIE-5: Tech Debt Consolidation (P2)

**Actions:**

1. **ErrorBoundary:** Merge `components/common/ErrorBoundary.tsx` and `components/shared/ErrorBoundary.tsx` → keep one, update all imports.

2. **Rate limiting:** Merge `lib/middleware/rate-limit.ts` (in-memory Map) into `lib/utils/rate-limit.ts` (Upstash). Remove in-memory implementation. Ensure all imports use unified module. Keep graceful pass-through when Upstash unset; document fail-closed behavior per `finding-1/FINDING-1-READY.md` if applicable.

3. **Upload hash:** `lib/actions/upload.ts` line 54 — implement file hash (SHA-256) for deduplication. Check for existing hash before upload.

4. **Dead code cleanup:** Remove or wire:
   - `lib/services/export-queue.ts` (no consumers)
   - `lib/resonance/viral-logic.ts` (if not wired in CHARLIE-1)
   - `scripts/setup.ts` placeholder (add minimal real content or delete with README note)

**Acceptance criteria:**
- [ ] Single ErrorBoundary, single rate-limit module
- [ ] Upload hash populated
- [ ] No new dead exports without consumers

---

### CHARLIE-6: Phase 2 Documentation Alignment (P2)

**Targets:** `docs/phase2/DEV_HANDOFF_NEXTJS_ALIGNMENT.md` checklist files:

Update technical specifics per alignment doc:
- Port **3000** not 8080
- Next.js standalone build not Vite/Nginx
- Secrets: Supabase/Stripe/Resend not Sanity
- Health check: `/api/health`
- P0 tests target `.next/standalone/` not `dist/`

**Priority files:**
- `docs/phase2/05-milestone-implementation-plan.md`
- `docs/phase2/06-acceptance-and-test-protocol.md`
- `docs/phase2/04-architecture-decisions.md`

Add decision log entry in `docs/phase2/change-log-and-decisions.md`.

**Do NOT fill RACI names** — that is operator work.

---

## Files you own

```
app/api/resonance/**
lib/resonance/**
lib/hooks/use-recommendations.ts
lib/services/analytics-tracker.ts
lib/services/export-queue.ts
lib/services/ai-insights.ts
components/analytics/**
app/(portals)/partner/**
app/(portals)/author/analytics/**
app/(portals)/author/dashboard/page.tsx (earnings only)
app/dashboard/following/** (new)
app/(consumer)/authors/[id]/page.tsx (follow button)
lib/actions/follows.ts
lib/middleware/rate-limit.ts (merge into utils)
lib/utils/rate-limit.ts
components/common/ErrorBoundary.tsx
components/shared/ErrorBoundary.tsx
lib/actions/upload.ts (hash only)
docs/phase2/** (technical alignment)
docs/FEATURE_PHASES.md (resonance/analytics/partner sections)
```

## Files you must NOT modify

```
app/(consumer)/reading/ReadingClient.tsx
components/books/Review*.tsx
lib/email/**
app/api/webhook/**
app/api/checkout/**
app/(consumer)/readers-hub/** (Alpha)
Dockerfile / cloudbuild.yaml (Bravo)
```

## Handoff notes

| From | What |
|------|------|
| **Alpha** | After reading merges, add `trackRead` call in ReadingClient |
| **Bravo** | After webhook merges, add `trackPurchase` in webhook handler |
| **Bravo** | Export `canAccessBook()` if subscription gating affects partner catalog |

---

## Begin execution

Acknowledge as AGENT CHARLIE. Then:

1. Start with CHARLIE-1 (Resonance) or CHARLIE-5 (tech debt) — state your choice
2. List RPC functions you'll call from migrations
3. Describe fallback strategy when OpenAI key missing
4. Create branch and begin
