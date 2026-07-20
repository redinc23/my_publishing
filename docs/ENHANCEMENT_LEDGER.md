# Enhancement Ledger — ranked product backlog

Authority: `.claude/skills/mangu-navigator/references/enhancement-engine.md`.  
Freeze rule: **discovery never stops; shipping is lane-gated.** L0/L1 may ship
now under NEXT_GO permitted classes; L2 needs owner approval; L3+ waits for GO
or explicit unfreeze in `HUMAN_TASKS.md` / `CLAUDE.md`.

Statuses: `PROPOSED` → `APPROVED` → `BUILDING` → `SHIPPED(flag)` → `PROMOTED` / `KILLED`.

Seeded 2026-07-20 from navigator SCOUT @ `9a8a940`. Re-run
`.claude/skills/mangu-navigator/scripts/enhance-scan.sh` before each SCOUT pass.

---

### E-001 Honest book-clubs placeholder

Lane: L0 · Status: SHIPPED · Score: R3 I3 C5 /E1 = 45
Story: As a reader, I see an honest status (not fake “Coming Soon” that looks live) on book clubs.
Evidence: stub surface under `app/(consumer)/book-clubs`; G6 no false-success
Metric & target: zero false-success complaints on that route; G6 closer to TRUE
Flag: n/a (truth fix; remove misleading CTA if present)
Gate/Star tie: G6
Effort: S · Risk: none · Verification: visual QA on `/book-clubs` + `/discover/book-clubs`
Approval: not required (L0)
Shipped: 2026-07-20 — PR `cursor/e001-book-clubs-honesty-f698` (#320)

### E-006 MCP catalog dual-run (Phoenix prep)

Lane: L1 · Status: SHIPPED · Score: R4 I4 C5 /E2 = 40
Story: As an operator/agent, catalog MCP tools keep working when DATABASE_PROVIDER flips to mongodb.
Evidence: `lib/mcp/catalog.ts`; tool names stable; default supabase
Metric & target: health returns provider; smoke green on both providers in staging
Flag: n/a (provider switch already gated)
Gate/Star tie: North Star migration parity / MCP ops
Effort: M · Risk: response field drift · Verification: unit + mcp-transport-security
Approval: not required (L1 hardening / migration parity)
Shipped: 2026-07-20 — PR `cursor/mcp-dual-run-catalog-f698` (#324)

### E-002 Replace console.log with structured logger in app/lib

Lane: L0 · Status: PROPOSED · Score: R2 I3 C5 /E2 = 15
Story: As an operator, I get structured logs instead of raw console noise in production.
Evidence: enhance-scan hygiene signal; WS6 / `mangu-observability` path
Metric & target: `console.log` count in app+lib → 0
Flag: n/a (hygiene)
Gate/Star tie: North Star #8 (hardening)
Effort: S · Risk: log volume · Verification: `grep -r console.log app lib | wc -l` → 0
Approval: not required (L0)

### E-003 Friendly 429 / rate-limit UX

Lane: L1 · Status: SHIPPED(flag) · Score: R4 I3 C4 /E2 = 24
Story: As a reader hitting rate limits, I see a clear retry message instead of a blank error.
Evidence: WS6 rate-limit contract; CCR-019 a11y on critical states
Metric & target: 429 responses render Retry-After guidance; support tickets ↓
Flag: NEXT_PUBLIC_FEATURE_FRIENDLY_429 (default off until measured)
Gate/Star tie: North Star #8
Effort: S · Risk: none · Verification: unit tests in `tests/unit/friendly-429.test.ts`; enable flag in preview
Approval: not required (L1 hardening-adjacent)
Shipped: 2026-07-20 — `lib/rate-limit-response.ts` + `/too-many-requests` page; middleware wired.

### E-004 Metadata coverage for pages missing generateMetadata

Lane: L2 · Status: PROPOSED · Score: R5 I4 C4 /E3 = 26.7
Story: As a search crawler / social sharer, every public page has correct title/description/OG.
Evidence: enhance-scan SEO gap (~24 of 61 pages lack metadata)
Metric & target: 100% of public `page.tsx` export metadata; OG share previews correct
Flag: n/a (SEO hygiene; ship page-by-page)
Gate/Star tie: post-GO growth (or owner change-control during freeze)
Effort: M · Risk: wrong titles · Verification: crawl sample + Lighthouse SEO
Approval: required for L2 during freeze

### E-005 Audio↔text position sync (signature differentiator)

Lane: L3 · Status: PROPOSED · Score: R5 I5 C3 /E5 = 15
Story: As a reader, I switch between listening and reading and resume at the same place.
Evidence: benchmark map — few competitors do this well; MANGU has both engines
Metric & target: session resume cross-mode ≥80% within 30s of last position
Flag: NEXT_PUBLIC_FEATURE_AUDIO_TEXT_SYNC (default off)
Gate/Star tie: post-GO growth
Effort: L · Risk: scope / sync correctness · Verification: e2e cross-mode resume
Approval: wait for GO or explicit unfreeze

### E-007 Honest blog empty-state copy pass

Lane: L0 · Status: PROPOSED · Score: R2 I2 C5 /E1 = 20
Story: As a reader, the blog page does not imply a live editorial feed when no posts exist.
Evidence: enhance-scan stub `app/(consumer)/blog/page.tsx` @ 625f46d
Metric & target: G6 honesty; no false “newsroom” cues
Flag: n/a
Gate/Star tie: G6
Effort: S · Risk: none · Verification: visual QA `/blog`
Approval: not required (L0)

### E-008 Route-level code-splitting for heavy clients

Lane: L2 · Status: PROPOSED · Score: R4 I4 C3 /E3 = 16
Story: As a visitor, first load ships less JS by dynamically importing heavy reader/audio clients.
Evidence: enhance-scan — 90 `use client` vs 1 dynamic import
Metric & target: LCP/TBT improvement on `/books/[slug]` and reader routes
Flag: NEXT_PUBLIC_FEATURE_ROUTE_SPLIT (default off)
Gate/Star tie: post-GO / owner change-control
Effort: M · Risk: hydration · Verification: bundle analyzer before/after
Approval: required for L2 during freeze

---

## How to add an entry

Copy the proposal template from
`.claude/skills/mangu-navigator/references/enhancement-engine.md`.
Assign the next `E-###` id. Never reclassify upward to ship sooner.
