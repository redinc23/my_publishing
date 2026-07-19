# MANGU Publishers - Complete Feature And Story Backlog

**Repository:** `redinc23/my_publishing`  
**Baseline inspected:** `main` at `2d601705ef8596d8dc37bcbf6dd34014c73167b1`  
**Created:** 2026-07-19  
**Purpose:** Turn the existing MANGU platform, launch authority docs, and growth backlog into an actionable product feature/story map.

## 0. Product North Star

MANGU Publishers is a direct-to-reader publishing marketplace: readers discover, buy, read, listen, discuss, and build a library; authors publish, grow an audience, and earn transparently; partners source books and ARCs; admins protect trust, quality, revenue, and launch integrity.

The long-term ambition is not just "sell ebooks." The strategic product is:

- A Netflix-style home for books, comics, papers, audiobooks, series, and serialized fiction.
- A creator-growth operating system for authors.
- A spoiler-safe social reading network.
- A trust-first catalog with human verification, review integrity, and transparent rights/access.
- An AI-native discovery and re-entry layer powered by Resonance.
- A platform surface with APIs, affiliate widgets, and an MCP server.

## 1. Execution Tracks

| Track | Name | Goal | Current repo evidence | Priority |
| --- | --- | --- | --- | --- |
| T0 | Launch Readiness | Get 1.0 production-safe and honest. | `docs/NEXT_GO.md`, `docs/reports/repository-health-2026-07-18.md` | P0 |
| T1 | Reader Core | Make reading, listening, library, and book pages excellent. | `app/(consumer)`, `components/reader`, `components/players`, `components/audio` | P0/P1 |
| T2 | Author Core | Make authors publish, manage, sell, and understand readers. | `app/(portals)/author`, `app/dashboard/books/[id]/analytics` | P0/P1 |
| T3 | Marketplace Growth | Improve discovery, conversion, reviews, wishlist, follows, and email. | `app/(consumer)/books`, `app/api/reviews`, `app/api/wishlist`, `app/api/follows` | P1 |
| T4 | Serialization And Monetization | Build retention and micro-transaction loops. | Existing Stripe, orders, progress, follows, email foundations | P1/P2 |
| T5 | Social Reading | Spoiler-safe community, book clubs, highlights, challenges. | `readers-hub`, `book-clubs`, reviews, highlights tables | P2 |
| T6 | Resonance 2.0 | Semantic search, taste profiles, AI recaps, ask-this-book. | `lib/resonance`, `/api/resonance/*`, pgvector migrations | P1/P2 |
| T7 | Trust And Catalog Quality | Verification, moderation, content warnings, review integrity. | Admin routes, reviews schema, RLS hardening | P1/P2 |
| T8 | Platform And Partner Expansion | API, affiliate widgets, MCP, partner licensing, white label. | `/api/mcp/[transport]`, partner portal | P2/P3 |

## 2. Track 0 - Launch Readiness Stories

These stories must stay ahead of growth work. `docs/NEXT_GO.md` states that all G1-G13 gates must be true before a production-ready claim or release tag.

### EPIC T0.1 - Production Readiness Gate Closure

**Story T0.1.1 - Configure production secrets and readiness**

As the operator, I want production environment variables configured on the canonical deployment target so `/api/health?ready=1` returns `ready:true`.

- Priority: P0
- Repo anchors: `docs/NEXT_GO.md`, `docs/CANONICAL_PRODUCTION.md`, `app/api/health/route.ts`
- Acceptance:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Stripe keys, Upstash keys, and `NEXT_PUBLIC_SITE_URL` are present in production.
  - `USE_MOCKS` and `SKIP_EMAILS` are absent in production.
  - Health check failure reasons are specific and logged without secrets.
  - Evidence row is appended to `docs/OPERATOR_QA_LOG.md`.

**Story T0.1.2 - Verify Stripe purchase to reading entitlement**

As a reader, I want a paid purchase to grant access to my library and reader immediately after the signed webhook succeeds.

- Priority: P0
- Repo anchors: `app/api/checkout/route.ts`, `app/api/webhooks/stripe/route.ts`, `lib/reading/entitlement.ts`, `app/(consumer)/library/page.tsx`
- Acceptance:
  - Stripe Checkout creates an order intent from server-derived book and user data.
  - Webhook signature verification rejects unsigned events.
  - Completed payment creates order/order_items rows.
  - Purchased book appears in library.
  - Reader route permits entitled user and denies unentitled user.
  - Refund/reversal behavior is documented and tested.

**Story T0.1.3 - Complete real auth/RBAC QA**

As an operator, I want real backend QA for signup, login, reset, role gates, and portal access so launch claims are defensible.

- Priority: P0
- Repo anchors: `middleware.ts`, `app/(auth)`, `app/admin`, `app/(portals)`
- Acceptance:
  - Signup creates profile row.
  - Email verification and PKCE callback work on canonical host.
  - Reset password flow works.
  - Non-admin is denied admin.
  - Non-author is denied author portal.
  - Non-partner is denied partner portal.
  - Admin, author, and partner roles reach the correct dashboards.

**Story T0.1.4 - Close or refresh stale PRs and branch noise**

As the maintainer, I want old duplicate/superseded PRs closed and stale branches pruned so engineering attention goes to the true release path.

- Priority: P0
- Repo anchors: `docs/reports/repository-health-2026-07-18.md`, `docs/NEXT_GO.md`
- Acceptance:
  - Superseded PRs are closed with explanatory comments.
  - Dependabot majors are held or regenerated after launch.
  - Branch cleanup list is executed by an authorized operator.
  - No growth PR merges during launch freeze unless explicitly approved.

### EPIC T0.2 - Honest Product Truth

**Story T0.2.1 - Replace "coming soon" dead ends with useful states**

As a reader, I want unavailable features to clearly say what is unavailable and give a useful next action.

- Priority: P0/P1
- Current signals: `ReadingClient` placeholder, `WishlistButton`, `FollowAuthorButton`, `HighlightPopover`, `book-clubs` pages.
- Acceptance:
  - Every incomplete feature is either hidden, functional, or explicitly unavailable.
  - Public pages do not claim ready functionality when backend/env is missing.
  - Analytics tracks disabled-feature clicks to prioritize completion.

## 3. Track 1 - Reader Core Stories

### EPIC T1.1 - Real Web Reader

**Story T1.1.1 - Render actual book content in the reader**

As a reader, I want the reading route to display the purchased book content instead of a placeholder.

- Priority: P0
- Repo anchors: `app/(consumer)/reading/[bookId]/ReadingClient.tsx`, `book_content`, `reading_progress`
- Implementation notes:
  - Use EPUB/PDF-safe rendering based on uploaded format.
  - Keep current entitlement gate.
  - Persist location using stable locators, not only percent.
- Acceptance:
  - Purchased book opens and renders content.
  - Reader resumes from last saved position.
  - Reader handles missing/corrupt files gracefully.
  - Mobile and desktop layouts are usable.

**Story T1.1.2 - Reader settings**

As a reader, I want typography controls so long sessions are comfortable.

- Priority: P1
- Acceptance:
  - Font size, line height, theme, width, and typeface are adjustable.
  - Preferences persist per user/device.
  - Controls are keyboard and screen-reader accessible.

**Story T1.1.3 - Offline reading PWA**

As a reader, I want selected books available offline so I can read without a connection.

- Priority: P2
- Acceptance:
  - User can mark a book for offline.
  - Entitlement is checked before caching.
  - Offline access expires/revalidates on reconnect.
  - Cached content is removed on logout or revoked access.

### EPIC T1.2 - Highlights, Notes, Wishlist, Follows

**Story T1.2.1 - Complete highlight creation**

As a reader, I want to select text, highlight it, and optionally add a note.

- Priority: P1
- Repo anchors: `components/reader/HighlightPopover.tsx`, `app/api/highlights/route.ts`, `readers-hub`
- Acceptance:
  - Highlight is saved with selected text, color, position, and note.
  - Highlight is visible in reader and Readers Hub.
  - Highlight can be edited/deleted.
  - Failed saves roll back the UI.

**Story T1.2.2 - Complete wishlist from book page**

As a reader, I want to wishlist a book from the book detail page and manage it in Readers Hub.

- Priority: P1
- Repo anchors: `components/reader/WishlistButton.tsx`, `app/api/wishlist/route.ts`
- Acceptance:
  - Toggle adds/removes wishlist row.
  - Signed-out users are prompted to log in.
  - Book page state reflects current user wishlist state.
  - Readers Hub removal works.

**Story T1.2.3 - Complete author follow from book page**

As a reader, I want to follow an author and see updates in my hub.

- Priority: P1
- Repo anchors: `components/reader/FollowAuthorButton.tsx`, `app/api/follows/route.ts`
- Acceptance:
  - Toggle follows/unfollows author.
  - Duplicate follows are prevented.
  - Readers Hub lists followed authors.
  - Follow event can feed email/notification stories.

### EPIC T1.3 - Read/Listen Continuity

**Story T1.3.1 - Audiobook resume and mini-player polish**

As a listener, I want audio to resume across navigation and devices.

- Priority: P1
- Repo anchors: `components/players/AudioPlayer.tsx`, `components/audio`, `app/api/audio/progress/route.ts`, `listening_progress`
- Acceptance:
  - Playback position persists.
  - Resume prompt works.
  - Mini-player mirrors active track.
  - Chapters, sleep timer, speed, skip, and keyboard shortcuts remain stable.

**Story T1.3.2 - Ebook-to-audio position sync**

As a hybrid reader, I want to switch from reading to listening at the same place.

- Priority: P2
- Dependencies: real reader locators, audio chapter metadata.
- Data needs:
  - `position_sync_maps`
  - `user_cross_format_positions`
- Acceptance:
  - User can jump from reader to audio with mapped timestamp.
  - User can jump from audio to reader with mapped text locator.
  - If no sync map exists, UI falls back to nearest chapter.

## 4. Track 2 - Author Core Stories

### EPIC T2.1 - Submission To Published Pipeline

**Story T2.1.1 - Manuscript lifecycle workflow**

As an author, I want manuscript status to move through draft, submitted, under review, needs changes, approved, and published.

- Priority: P0/P1
- Repo anchors: `app/(portals)/author/submit`, `app/admin/manuscripts`, `manuscripts`, `books`
- Acceptance:
  - Author sees each status and next action.
  - Admin can approve, request changes, reject, or publish.
  - Status changes are audited.
  - Published manuscript creates or updates book/catalog records.

**Story T2.1.2 - Author project detail workspace**

As an author, I want a project page that shows files, metadata, review status, notes, and publishing checklist.

- Priority: P1
- Repo anchors: `app/(portals)/author/projects/[id]/page.tsx`
- Acceptance:
  - Author can edit metadata while allowed by status.
  - Uploads are content-addressed/deduped.
  - Admin feedback is visible.
  - Publishing blockers are shown as checklist items.

### EPIC T2.2 - Author Analytics

**Story T2.2.1 - Replace zero earnings with real revenue rollup**

As an author, I want my dashboard earnings to reflect actual completed sales and payout state.

- Priority: P0/P1
- Repo anchors: `app/(portals)/author/dashboard/page.tsx`, `book_sales`, `author_payouts`
- Acceptance:
  - Earnings use completed orders/sales, not a hardcoded zero.
  - Dashboard separates gross sales, net revenue, platform fee, pending payout, paid payout.
  - Empty state explains when no sales exist.

**Story T2.2.2 - Chapter-level funnel analytics**

As an author, I want chapter-level drop-off and completion data so I can improve my book.

- Priority: P1/P2
- Dependencies: real reader locators/chapter model.
- Acceptance:
  - Started, completed, abandoned, average time, and sample-to-purchase conversion are shown per chapter.
  - No individual reader is exposed.
  - Category benchmark is shown only when sample size is sufficient.

**Story T2.2.3 - Highlight intelligence**

As an author, I want to see the most highlighted passages in my books.

- Priority: P2
- Acceptance:
  - Aggregated highlight counts by passage.
  - Optional notes sentiment summary.
  - Privacy threshold prevents exposing one-reader passages.

### EPIC T2.3 - Author Growth Suite

**Story T2.3.1 - Author storefront pages**

As an author, I want a polished public storefront for my catalog, bio, links, follows, and email signup.

- Priority: P1
- Repo anchors: `app/(consumer)/authors`, `app/(consumer)/authors/[id]`
- Acceptance:
  - Author page has banner, photo, verified marker, bio, socials, catalog shelves.
  - Reader can follow from page.
  - Page tracks views, book clicks, and follows.

**Story T2.3.2 - Reader email ownership with consent**

As an author, I want consenting followers exportable to my mailing list.

- Priority: P1/P2
- Dependencies: follows, email preferences, export jobs.
- Acceptance:
  - Reader explicitly grants or denies email sharing per author.
  - Reader can revoke consent.
  - Author export includes only consenting followers.
  - Export event is audit logged.

**Story T2.3.3 - Cover/blurb A/B testing**

As an author, I want to test cover and blurb variants to improve conversion.

- Priority: P2
- Acceptance:
  - Author creates experiment with variants and traffic split.
  - Book impressions, page clicks, sample starts, purchases are tagged by variant.
  - Dashboard shows conversion and confidence warning for low sample sizes.
  - Author can select winner.

**Story T2.3.4 - Preorders and launch command center**

As an author, I want preorders, countdowns, follower launch emails, and launch-day analytics.

- Priority: P2
- Acceptance:
  - Book can be in preorder state.
  - Reader can preorder or request notification.
  - Launch unlock grants access automatically.
  - Dashboard shows preorder count and first-48-hour sales.

## 5. Track 3 - Marketplace Growth Stories

### EPIC T3.1 - Book Detail Conversion

**Story T3.1.1 - Personalized book action bar**

As a reader, I want the book page CTA to reflect whether I own, can sample, can buy, can listen, or can continue.

- Priority: P1
- Repo anchors: `app/(consumer)/books/[slug]/page.tsx`
- Acceptance:
  - Owned book shows Continue Reading/Listen.
  - Unowned paid book shows Buy and Sample.
  - Free book shows Add To Library/Read.
  - Audio availability and bundle availability are visible.

**Story T3.1.2 - Reviews that drive trust**

As a shopper, I want verified reviews, helpful sorting, spoiler handling, and author replies.

- Priority: P1
- Repo anchors: `app/api/reviews/route.ts`, `components/books/ReviewSection.tsx`
- Acceptance:
  - Review CRUD works for signed-in users.
  - Verified purchase badge is server-derived.
  - Helpful votes work once per user.
  - Spoiler reviews are collapsed by default.
  - Authors can reply to reviews for their books.

### EPIC T3.2 - Search, Shelves, And Recommendations

**Story T3.2.1 - Search result quality pass**

As a reader, I want search and filters to return accurate catalog results.

- Priority: P1
- Repo anchors: `app/(consumer)/books`, `BookFilters`, `lib/supabase/public-queries.ts`
- Acceptance:
  - Search supports title, author, genre, keyword.
  - Filters combine predictably.
  - Empty state suggests alternatives.
  - Query params preserve sharable URLs.

**Story T3.2.2 - Resonance recommendations with fallback chain**

As a reader, I want useful recommendations even when AI keys are unavailable.

- Priority: P1
- Repo anchors: `lib/resonance/recommendations.ts`, `/api/resonance/recommend`
- Acceptance:
  - With OpenAI configured, recommendations use embeddings.
  - Without OpenAI, fallback uses genre/trending/editorial logic.
  - UI honestly labels unavailable personalization.
  - Events track recommendation impressions and clicks.

**Story T3.2.3 - Taste onboarding quiz**

As a new reader, I want a short onboarding quiz so my first recommendations feel personal.

- Priority: P2
- Acceptance:
  - Quiz asks genre, tropes, mood, heat/content comfort, favorites.
  - Answers create structured preferences and/or a taste vector.
  - User can skip, retake, and edit.
  - Homepage shelves update from the profile.

## 6. Track 4 - Serialization And Monetization Stories

### EPIC T4.1 - Serialized Fiction

**Story T4.1.1 - Series and season model**

As an author, I want books grouped into series/seasons with reading order and upcoming releases.

- Priority: P1
- Acceptance:
  - `series` entity supports title, description, cover, status.
  - Books have `series_id` and `series_order`.
  - Series page shows order, progress, buy/continue CTAs.
  - Discovery can show Continue Series shelves.

**Story T4.1.2 - Scheduled chapter releases**

As an author, I want to schedule chapters so readers return on a cadence.

- Priority: P1/P2
- Dependencies: real reader content model.
- Acceptance:
  - Chapter has draft/scheduled/published state.
  - Author can bulk schedule cadence.
  - Scheduled job publishes due chapters.
  - Followers receive notifications if enabled.

**Story T4.1.3 - Wait-or-pay fast pass**

As a reader, I want to wait for a free unlock or pay credits to read immediately.

- Priority: P2
- Dependencies: chapter releases, credits wallet.
- Acceptance:
  - Chapter lock state is server-calculated.
  - Countdown is visible.
  - Credit purchase unlocks instantly.
  - Unlock ledger is immutable.

### EPIC T4.2 - Pricing And Revenue Expansion

**Story T4.2.1 - Ebook plus audio bundles**

As a shopper, I want discounted ebook/audio bundles.

- Priority: P1/P2
- Acceptance:
  - Bundle can include ebook and audiobook products.
  - Checkout grants both entitlements.
  - Bundle price and savings are clear.

**Story T4.2.2 - Coupons and series funnels**

As an author, I want discount codes and book-one-free funnels.

- Priority: P2
- Acceptance:
  - Coupon supports percent/fixed/free, max uses, date range, and book scope.
  - Checkout validates coupon server-side.
  - Funnel analytics show free download to paid conversion.

**Story T4.2.3 - Credits wallet and gifting**

As a reader, I want credits for fast pass, gifts, and small purchases.

- Priority: P2/P3
- Acceptance:
  - Credit ledger is double-entry.
  - Stripe purchases mint credits only after payment success.
  - Credits can unlock eligible content.
  - Gifts support recipient email, note, redemption, and anti-fraud checks.

**Story T4.2.4 - Tipping at emotional peaks**

As a reader who loved a book, I want to tip the author when I finish.

- Priority: P2
- Acceptance:
  - Completion modal appears only after meaningful completion.
  - Author can opt out.
  - Tips are recorded and included in payouts.

## 7. Track 5 - Social Reading Stories

### EPIC T5.1 - Spoiler-Safe Community

**Story T5.1.1 - Progress-gated discussions**

As a reader, I want discussions hidden beyond my current progress so I can participate without spoilers.

- Priority: P2
- Dependencies: chapter/paragraph locators.
- Acceptance:
  - Comments are anchored to chapter or passage.
  - Server filters comments above reader progress.
  - Author/admin moderation can see all with clear labels.
  - Reporting and hiding are available.

**Story T5.1.2 - Popular highlights and margin reactions**

As a reader, I want to feel other readers around the text without noisy spoilers.

- Priority: P2
- Acceptance:
  - Aggregated highlight counts appear in reader.
  - Reactions are anchored to passages.
  - Individual reader identities are private by default.

### EPIC T5.2 - Book Clubs And Challenges

**Story T5.2.1 - Book clubs with pacing**

As a club organizer, I want milestones, discussion dates, and progress nudges.

- Priority: P2
- Repo anchors: `app/(consumer)/book-clubs`, `app/(consumer)/discover/book-clubs`
- Acceptance:
  - Club creator sets schedule.
  - Members see ahead/on-track/behind state.
  - Discussion threads open at milestones.

**Story T5.2.2 - Reading challenges and badges**

As a reader, I want seasonal challenges, genre bingo, streak badges, and shareable achievements.

- Priority: P2/P3
- Acceptance:
  - Admin creates challenge with rule set.
  - User progress updates from reading events.
  - Badges appear on profile and share cards.

**Story T5.2.3 - Author AMA and annotation events**

As a fan, I want scheduled author events and margin commentary.

- Priority: P3
- Acceptance:
  - Author schedules event and followers can RSVP.
  - Live Q&A supports moderation.
  - Archived transcript can be free or paid.
  - Author annotations can be toggled in reader.

## 8. Track 6 - Resonance 2.0 And AI Stories

### EPIC T6.1 - AI-Native Discovery

**Story T6.1.1 - Vibe search**

As a reader, I want to search by feeling, trope, and comparison instead of exact keywords.

- Priority: P1/P2
- Repo anchors: `lib/resonance/embeddings.ts`, `resonance_vectors`
- Acceptance:
  - Query embedding searches catalog vectors.
  - Results include match explanation.
  - Keyword/trope filters can narrow semantic results.
  - Feature is disabled honestly if AI key is missing.

**Story T6.1.2 - Trope taxonomy and power filters**

As a genre reader, I want filters for tropes, heat level, content warnings, and mood.

- Priority: P1/P2
- Acceptance:
  - Admin manages canonical taxonomy.
  - Author tags books during submission.
  - AI suggests tags but author confirms.
  - Trope landing pages are SEO-friendly.

**Story T6.1.3 - Personalized samples**

As a reader, I want the sample most likely to hook me.

- Priority: P2
- Acceptance:
  - Author can define sample segments.
  - System selects segment by reader taste profile.
  - Anonymous readers receive default sample.
  - Sample choice is tracked for conversion.

### EPIC T6.2 - AI Reading Companions

**Story T6.2.1 - Spoiler-safe "Previously on" recap**

As a returning reader, I want a recap up to my current position.

- Priority: P1/P2
- Acceptance:
  - Trigger after configurable inactivity threshold.
  - Recap uses only text before current position.
  - Cache by book/version/position.
  - Author-provided recap overrides AI.

**Story T6.2.2 - Ask this book**

As a reader, I want to ask questions about a book I own without spoilers beyond my progress.

- Priority: P2/P3
- Acceptance:
  - RAG retrieval filters chunks above reader progress.
  - Answers cite in-book locations.
  - If answer is unavailable, system says it cannot answer yet.
  - Cost/rate limits protect the API.

**Story T6.2.3 - AI narration tier**

As an author, I want an opt-in synthetic audiobook option for books without human narration.

- Priority: P3
- Acceptance:
  - Author opts in and previews output before publishing.
  - Catalog labels narration as synthetic.
  - Audio files are chaptered and streamable.
  - Word/phrase timestamps generate sync maps where possible.

## 9. Track 7 - Trust And Catalog Quality Stories

### EPIC T7.1 - Quality And Safety

**Story T7.1.1 - Human-verified catalog program**

As a reader, I want signals that a book passed quality and rights checks.

- Priority: P1/P2
- Acceptance:
  - Admin checklist covers rights, formatting, metadata, cover, content policy.
  - Verified badge appears on book detail and cards.
  - Badge is revocable with audit log.

**Story T7.1.2 - Content warnings**

As a reader, I want reliable, structured content warnings and filters.

- Priority: P1/P2
- Acceptance:
  - Authors declare warnings.
  - AI suggests missing warnings for review.
  - Readers can flag missing/inaccurate warnings.
  - Search can exclude configured warnings.

**Story T7.1.3 - Review integrity**

As a shopper, I want reviews protected from spam, manipulation, and undisclosed conflicts.

- Priority: P1/P2
- Acceptance:
  - Verified purchase is server-derived.
  - Suspicious vote/review patterns are flagged.
  - Admin can hide, restore, or annotate moderation decisions.
  - Authors cannot delete unfavorable reviews.

### EPIC T7.2 - Rights, Payouts, And Compliance

**Story T7.2.1 - Payout and tax handling**

As an author, I want clear payout setup, tax form status, and monthly settlement.

- Priority: P2
- Repo anchors: `author_payouts`, `payout_items`
- Acceptance:
  - Author sees payout eligibility and missing setup tasks.
  - Monthly payout run is auditable.
  - Platform and processing fees are transparent.

**Story T7.2.2 - Social DRM and watermarking**

As the platform, I want downloadable assets watermarked enough to discourage casual sharing without punishing readers.

- Priority: P3
- Acceptance:
  - Downloads embed account/order watermark.
  - Watermark avoids exposing sensitive information.
  - Author/admin can trace leaked copy to order where legally appropriate.

## 10. Track 8 - Verticals, Platform, And Partners

### EPIC T8.1 - Verticals

**Story T8.1.1 - Comics/Webtoon reader**

As a comics reader, I want vertical scroll, episode releases, panel-friendly reading, and mobile-first navigation.

- Priority: P2
- Repo anchors: `app/(consumer)/comics`
- Acceptance:
  - Comic content type uses vertical reader.
  - Episodes support locked/unlocked states.
  - Images are optimized for mobile and desktop.

**Story T8.1.2 - Papers vertical**

As a researcher or curious reader, I want papers with abstracts, citations, references, and note-taking.

- Priority: P2
- Repo anchors: `app/(consumer)/papers`
- Acceptance:
  - Paper page supports abstract, authors, DOI/link, citation metadata.
  - PDF/HTML reader works.
  - Notes/highlights work with citations.

**Story T8.1.3 - Institutional lending**

As a library or school, I want controlled lending, seat/license counts, and usage reports.

- Priority: P2/P3
- Repo anchors: `app/(portals)/partner`
- Acceptance:
  - Partner has license pool.
  - Patrons can borrow within limits.
  - Partner sees usage and export reports.

### EPIC T8.2 - Platform Plays

**Story T8.2.1 - MANGU MCP server fully realized**

As an approved operator or agent, I want a secure MCP surface for catalog, analytics, and operational workflows.

- Priority: P2
- Repo anchors: `app/api/mcp/[transport]/route.ts`, `lib/mcp/guard.ts`
- Acceptance:
  - MCP is off by default.
  - When enabled, auth, rate limits, and scopes are enforced.
  - Tools are read-only until explicit write scopes exist.
  - Audit logs capture tool use.

**Story T8.2.2 - Public API and affiliate program**

As an affiliate or partner, I want API access and embeddable widgets to promote books and earn referrals.

- Priority: P3
- Acceptance:
  - Affiliate links attribute clicks and purchases.
  - API keys support catalog reads and reporting.
  - Widgets render book cards, buy buttons, and sample embeds.

**Story T8.2.3 - White-label storefronts**

As a publisher or institution, I want a branded storefront powered by MANGU.

- Priority: P3
- Acceptance:
  - Tenant branding, domain, catalog, and pricing rules are isolated.
  - Admin can manage tenant configuration.
  - Analytics and payouts are tenant-scoped.

## 11. Suggested Sequencing

### Phase A - Launch Truth And Core Completion

1. Close T0 readiness gates.
2. Replace reader placeholder with real content rendering.
3. Complete wishlist, follows, highlights, and review interactions.
4. Connect author earnings to real sales.
5. Verify payment to entitlement to reader path.

### Phase B - Conversion And Retention

1. Polish book detail CTAs.
2. Finish Resonance fallback and recommendation shelves.
3. Add author storefronts and follower consent.
4. Add series pages.
5. Add email notifications tied to follows and purchases.

### Phase C - Differentiation

1. Serialized chapters.
2. Chapter analytics.
3. Vibe search and trope filters.
4. Spoiler-safe recap.
5. Book clubs with pacing.

### Phase D - Prosperity Loops

1. Ebook/audio bundles.
2. Preorders and launch command center.
3. Coupons and series funnels.
4. Fast Pass and credits.
5. Challenges, wrapped, quote cards, and referrals.

### Phase E - Platform Expansion

1. Comics/webtoon reader.
2. Papers vertical.
3. Institutional lending.
4. API/affiliate widgets.
5. MCP and white-label storefronts.

## 12. Backlog Labels

Use these labels if creating GitHub issues from this document:

| Label | Meaning |
| --- | --- |
| `track:launch` | T0 release gate or production readiness |
| `track:reader` | Reader/library/listening experience |
| `track:author` | Author portal, publishing, analytics, growth |
| `track:marketplace` | Book detail, checkout, discovery, reviews |
| `track:monetization` | Pricing, bundles, credits, subscriptions, tips |
| `track:social` | Discussions, clubs, challenges, community |
| `track:resonance` | AI, embeddings, semantic discovery, recaps |
| `track:trust` | Moderation, warnings, verification, review integrity |
| `track:platform` | Partner, API, MCP, affiliate, white-label |
| `priority:p0` | Launch blocker |
| `priority:p1` | Next after launch or launch-adjacent completion |
| `priority:p2` | Growth differentiator |
| `priority:p3` | Platform expansion or later bet |

## 13. Issue Template For Each Story

```md
## User story
As a [persona], I want [capability] so that [outcome].

## Priority
P0/P1/P2/P3

## Repo anchors
- `path/or/module`

## Dependencies
- [dependency]

## Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Implementation notes
- [technical notes]

## Test plan
- [unit/e2e/manual checks]
```

## 14. Immediate Next Ten Issues To Create

1. T0.1.2 - Verify Stripe purchase to reading entitlement.
2. T0.1.3 - Complete real auth/RBAC QA.
3. T1.1.1 - Render actual book content in the reader.
4. T1.2.2 - Complete wishlist from book page.
5. T1.2.3 - Complete author follow from book page.
6. T1.2.1 - Complete highlight creation.
7. T3.1.2 - Reviews that drive trust.
8. T2.2.1 - Replace zero earnings with real revenue rollup.
9. T3.2.2 - Resonance recommendations with fallback chain.
10. T2.3.1 - Author storefront pages.

This order keeps the platform honest, makes the current UI real, and then starts turning MANGU into the author/reader growth machine it is aiming to become.
