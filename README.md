# 📚 Mangu Publishing Platform

A Netflix-style digital publishing platform for books, audiobooks, comics, and papers. Built with Next.js 14, Supabase, Stripe, and Tailwind CSS.

## 🚀 Quick Start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Stripe keys
npm run dev                  # http://localhost:3001
```

**Database setup:** apply the migrations in `supabase/migrations/` in order via the Supabase SQL editor or CLI. All launch migrations are idempotent.

**Embed backfill (optional):** with `OPENAI_API_KEY` + service-role env set, run

```bash
npx tsx scripts/backfill-resonance-embeddings.ts
```

to vectorize the catalog. The Resonance Engine works without it — it simply falls back to SQL trending/editorial ranking.

## ✍️ Author Portal

Self-service publishing for authors: upload manuscripts/covers, track review readiness, see sales. Route code lives in `app/author/`, server actions in `lib/actions/`, with RLS policies guarding every table.

---

## 🧪 Smoke Test Matrix (Feature Branches)

Run these after checking out each feature branch; all are designed to pass without breaking main.

| Branch | Feature | Happy-path smoke | Degradation smoke |
| --- | --- | --- | --- |
| `feat/topdog-reviews` | Reviews & ratings | Book page → write review → appears with verified badge when purchased | Migrations absent → section hides gracefully, page still renders |
| `feat/topdog-resonance` | Resonance engine | Home → "For You" rail loads (vector or fallback) | No `OPENAI_API_KEY` → falls back to trending/editorial SQL |
| `feat/topdog-audio` | Audiobook player | `/audio` catalog → play → pause → reopen → resume prompt | No audio URL → card hidden; 401 → localStorage-only progress |
| `feat/topdog-comms` | Transactional email | Sign up → welcome email (if `RESEND_API_KEY`) | Missing key → no-op logs; preference UI shows "unavailable" |
| `feat/topdog-engagement` | Reader engagement | Readers Hub tabs, wishlist & follow buttons work | Tables missing → APIs return 503 JSON, UI toasts "coming soon" |

---

## 🌟 Features

### ⭐ Reviews & Ratings
- Public API: `GET/POST /api/reviews` (pagination, sorting, stats) and `POST /api/reviews/[id]/helpful`.
- One review per reader per book; verified-purchase badges via server-side order lookup; author replies; helpful votes recounted by a DB trigger.
- `ReviewSection` on book pages with pagination, spoiler filtering, and tabs; `lib/actions/reviews.ts` server actions for votes/replies.

### 🤖 Resonance Engine (AI recommendations)
- Fallback chain **user-vector → similar-to-recent → trending → editorial** keeps rails populated even without embeddings.
- APIs: `GET /api/resonance/recommend`, `GET /api/resonance/similar`, `POST /api/resonance/track` (batched impression/click analytics), `POST /api/resonance/embed` (admin).
- `RecommendationsRail` + `BecauseYouReadRail` on the home page and `/recommendations`.
- `scripts/backfill-resonance-embeddings.ts` backfills pgvector embeddings when `OPENAI_API_KEY` is present (no-op otherwise).

### 📧 Transactional Email
- Resend + react-email; five branded templates: welcome, purchase receipt, author payout, new-review alert, newsletter double opt-in.
- Welcome on signup (never blocks registration); receipt in the Stripe webhook (never blocks fulfillment); new-review alerts fire-and-forget from review creation.
- Double opt-in newsletter at `POST /api/newsletter` with confirm/unsubscribe routes; preference center at `/dashboard/settings`.
- Every send degrades gracefully: missing `RESEND_API_KEY` → logged skip; opted-out users are respected via the `email_preferences` table.

### 🎧 Audiobook Experience
- Player: 0.5–3x speed, ±15s skip, sleep timer (minutes / end-of-chapter), keyboard shortcuts, chapters, buffered indicator, resume prompt, Media Session metadata.
- Global engine + persistent `MiniPlayer` (wired in `app/providers.tsx`) keeps playback alive across navigation; `/audio` catalog + `/audio/[id]` player pages.
- Progress syncs to `listening_progress` when signed in, localStorage otherwise.

### 🔖 Reader Engagement
- Bookmarks, highlights + notes (5 colors), wishlist, and author follows — APIs (`/api/bookmarks`, `/api/highlights`, `/api/wishlist`, `/api/follows`) plus `HighlightPopover`, `NotesPanel`, `WishlistButton`, `FollowAuthorButton`.
- Readers Hub (`/readers-hub`) aggregates highlights, notes, wishlist, and followed authors in tabs.
- Every route returns a uniform 503 when the engagement migration is missing, so the UI can degrade quietly.

### 📊 Analytics Dashboard
- Author-facing stats (views, purchases, revenue) built on Supabase tables with cached aggregations.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router, server components)
- **Database / Auth / Storage:** Supabase (Postgres + RLS + pgvector)
- **Payments:** Stripe Checkout + webhooks
- **Email:** Resend + react-email
- **AI:** OpenAI embeddings (`text-embedding-3-small`, 384-d) for the Resonance Engine
- **UI:** Tailwind CSS, Radix primitives, lucide-react icons, sonner toasts

---

## 🧪 Development

```bash
npm run dev        # develop on http://localhost:3001
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run test       # unit tests (vitest)
npm run test:e2e   # playwright e2e
```

### Testing

- Unit: `tests/unit/` (Vitest). Reviews API coverage: `tests/unit/reviews-api.test.ts` (9 tests).
- E2E: `e2e/` (Playwright) — public catalog flows stay green with feature flags off.

### Rate limiting posture

Site-wide fail-closed when Upstash env vars are absent (pre-existing behavior). All new API routes call `enforceRateLimit('api', …)` and honor its 503/429 semantics.

### Environment variables

See `.env.example`. Launch-critical: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; optional-but-recommended: `RESEND_API_KEY`, `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`.
