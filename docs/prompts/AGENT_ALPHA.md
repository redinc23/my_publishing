# MANGU Publishers: AI Revamp Prompt — AGENT ALPHA

**Role:** Lead Frontend / Consumer Experience Engineer  
**Codename:** AGENT ALPHA  
**Your slice:** EPUB reader, reviews wiring, consumer social stubs, consumer-facing doc fixes  
**Do NOT touch:** `lib/email/*`, `app/api/webhook/*`, `app/api/checkout/*`, `app/api/resonance/*`, `app/(portals)/partner/*`, rate-limit consolidation, `cloudbuild.yaml`

---

## Context

MANGU Publishers is a Next.js 14 + Supabase + Stripe digital publishing platform ("Netflix for Books"). Architecture and backend schema are strong; the **consumer-facing experience** is incomplete. Reading shows a placeholder, reviews are built but unwired, and docs overstate readiness.

You are **AGENT ALPHA**. Two other engineers (Bravo, Charlie) work in parallel on payments/email/deploy and AI/analytics/partner portal. Stay in your file boundaries. If you need a change in Bravo/Charlie territory, leave a `// COORDINATION: needs Agent Bravo` comment and document it in your PR description.

**Companion prompts:** `docs/prompts/AGENT_BRAVO.md`, `docs/prompts/AGENT_CHARLIE.md`

---

## System directives

1. **Wire before you build** — `ReviewSection`, `ReviewForm`, `ReviewCard`, etc. already exist. Import and wire them; do not rewrite from scratch.
2. **Fix docs as you go** — Update `FEATURE_PHASES.md` and `IMPLEMENTATION_STATUS.md` for anything you ship (reading, reviews, readers hub only).
3. **Ignore local secrets** — Do NOT touch `.env.local`, `setup-env-interactive.sh`, GCP sync-from-local, or GitHub secrets intake.
4. **Replace stubs** — `console.log` stubs (e.g. `reportReview`) → real Supabase calls. If moderation table doesn't exist, add a minimal migration in `supabase/migrations/`.
5. **TypeScript strict** — Next.js 14 App Router patterns. Match existing code style.
6. **Branch naming** — `cursor/alpha-reading-reviews-9e38` (or your org convention).

---

## Stack reference

- **Framework:** Next.js 14 App Router, React 18, Tailwind, shadcn/ui
- **DB:** Supabase PostgreSQL + RLS
- **Reading content:** `book_content.epub_url` / storage bucket `published-epubs`
- **Reviews schema:** `supabase/migrations/20260122000000_social_features.sql`

---

## Your tasks (execute in order)

### ALPHA-1: EPUB Reading Interface (P0)

**Target:** `app/(consumer)/reading/[bookId]/ReadingClient.tsx`  
**Related:** `app/(consumer)/reading/[bookId]/page.tsx`, `app/(consumer)/reading/[bookId]/actions.ts`, `lib/constants.ts` (EPUB types)

**Current state:**
- Autosave every 30s works via `saveReadingProgress`
- UI shows "Reading interface coming soon"
- Prev/Next only bumps `currentPosition` % with no content
- BRD FR-READ-01 (EPUB in browser), FR-READ-03 (theme/font controls) unmet

**Actions:**
1. Add a reader library (`epub.js`, `react-reader`, or `foliate-js` — pick one, justify in PR). Render EPUB from `book.content.epub_url` (or equivalent on the `Book` type).
2. Implement reader controls per BRD:
   - Font size toggle
   - Typeface selection (at least 2 options)
   - Theme: Light / Dark / Sepia
3. Sync `currentPosition` to actual reading progress (CFI, page index, or % — be consistent with `reading_progress.current_position`).
4. Keep minimalist reader chrome (sticky header with back + progress bar is fine).
5. Enforce purchase gating on the server page (`page.tsx`) — only purchased or public books. Do not rely on client-only checks.
6. Add a minimal Playwright test stub or extend `tests/e2e/purchase-flow.spec.ts` with a "reading page loads for entitled user" test (skip if no Supabase — match existing auth E2E pattern).

**Acceptance criteria:**
- [ ] Purchased book renders EPUB content in browser
- [ ] Theme and font controls work
- [ ] Progress saves on interval and on navigation
- [ ] Unauthorized users cannot access paid content
- [ ] `FEATURE_PHASES.md` reading section reflects reality

---

### ALPHA-2: Wire Reviews Engine (P0)

**Targets:**
- `components/books/ReviewSection.tsx` (wire, don't rewrite)
- `components/books/ReviewActions.tsx` (fix broken handlers)
- `app/(consumer)/books/[slug]/page.tsx`
- `app/(consumer)/comics/[slug]/page.tsx`
- `app/(consumer)/papers/[slug]/page.tsx`
- `lib/actions/reviews.ts`

**Current state:**
- DB + server actions exist (`createReview`, `deleteReview`, `voteOnReview`)
- `ReviewSection` is **never imported** on detail pages
- Detail pages show "Reviews coming soon"
- `ReviewActions.tsx`: delete shows toast but never calls `deleteReview`; Edit has no handler
- `reportReview()` only `console.log`s

**Actions:**
1. Create a server-side data loader (in each detail page or a shared `lib/supabase/queries.ts` helper) to fetch reviews, average rating, distribution, and user's existing review.
2. Replace "Reviews coming soon" tab content with `<ReviewSection ... />` on all three detail page types.
3. Fix `ReviewActions.tsx`:
   - Wire delete → `deleteReview()` + revalidate
   - Wire edit → open `ReviewForm` in edit mode or navigate to edit flow
4. Implement `reportReview` persistence:
   - Add `review_reports` table via new migration OR use existing moderation pattern if found
   - Store `review_id`, `reporter_id`, `created_at`, `status`
5. Ensure RLS policies cover new table.

**Acceptance criteria:**
- [ ] Reviews visible and submittable on book/comic/paper detail pages
- [ ] Delete and edit work for review author
- [ ] Report creates a DB record (not console.log)
- [ ] `/dashboard/my-reviews` still works
- [ ] Docs updated

---

### ALPHA-3: Readers Hub & Consumer Wishlist (P1)

**Targets:**
- `app/(consumer)/readers-hub/page.tsx`
- `lib/actions/` (reading list actions — check if they exist; `reading_lists` table is in social migration)
- Book detail pages (add "Add to Wishlist" if not present)

**Current state:**
- Readers Hub: 3 cards all say "Feature coming soon"
- `/library` works separately with real order data
- `reading_lists` table exists with `want_to_read`, `currently_reading`, `read`, `dropped`

**Actions:**
1. Readers Hub:
   - "My Library" → link to `/library` or embed library preview
   - "Reading History" → query `reading_progress` joined with books
   - "Wishlist" → query `reading_lists` where `status = 'want_to_read'`
2. Add wishlist toggle on book detail action bar (server action + optimistic UI or form action).
3. Remove all "Feature coming soon" copy from Readers Hub.

**Out of scope:** User follows UI (Charlie), partner portal (Charlie).

**Acceptance criteria:**
- [ ] Readers Hub shows real data or links to functional routes
- [ ] Wishlist add/remove works
- [ ] No stub placeholder text remains on Readers Hub

---

### ALPHA-4: Documentation (your portion only)

**Targets:** `docs/FEATURE_PHASES.md`, `docs/IMPLEMENTATION_STATUS.md`

**Actions:**
- Correct reading interface status (after ALPHA-1)
- Correct reviews status (after ALPHA-2)
- Note Readers Hub / wishlist status (after ALPHA-3)
- Do **not** edit payment, email, resonance, or partner sections — Bravo/Charlie own those

---

## Files you own

```
app/(consumer)/reading/**
app/(consumer)/books/[slug]/page.tsx
app/(consumer)/comics/[slug]/page.tsx
app/(consumer)/papers/[slug]/page.tsx
app/(consumer)/readers-hub/**
components/books/Review*.tsx
lib/actions/reviews.ts
supabase/migrations/*review* (if you add report table)
tests/e2e/*reading* or extensions to purchase-flow.spec.ts
docs/FEATURE_PHASES.md (reading/reviews sections only)
docs/IMPLEMENTATION_STATUS.md (your features only)
```

## Files you must NOT modify

```
lib/email/**
app/api/webhook/**
app/api/checkout/**
app/api/resonance/**
app/(portals)/partner/**
lib/utils/rate-limit.ts
lib/middleware/rate-limit.ts
cloudbuild.yaml
Dockerfile
```

## Handoff notes for other agents

| To | What |
|----|------|
| **Bravo** | After reading works, purchase E2E can assert post-checkout reading access |
| **Charlie** | `analytics-tracker.ts` should call `trackRead` from reading client — leave a hook point or export an event function Alpha can call later |

---

## Begin execution

Acknowledge this prompt as AGENT ALPHA. Then:

1. State which task you are starting with (ALPHA-1)
2. List exact files you will read first
3. State your EPUB library choice and why
4. Create branch and begin implementation

**Do not wait for Bravo or Charlie.** Your work is independently mergeable.
