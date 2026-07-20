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
Evidence: `/book-clubs` already honest; `/discover/book-clubs` was a hollow stub — now redirects to canonical page.
Metric & target: zero false-success complaints on that route; G6 closer to TRUE
Flag: n/a (truth fix)
Gate/Star tie: G6
Effort: S · Risk: none · Verification: `/discover/book-clubs` → 307/308 to `/book-clubs`
Approval: not required (L0)

### E-006 Honest reading surface (progress + file links)

Lane: L0 · Status: BUILDING · Score: R4 I4 C5 /E2 = 40
Story: As a purchaser, the reading page tells me what works (progress autosave, PDF/EPUB open) instead of a fake “interface coming soon” with no path forward.
Evidence: enhance-scan stub `ReadingClient.tsx`; library Continue Reading links here
Metric & target: zero “coming soon” dead-ends on `/reading/[bookId]`; file CTAs when `book_content` has urls
Flag: n/a (truth fix)
Gate/Star tie: G6
Effort: S · Risk: none · Verification: entitled user sees progress copy + Open PDF/EPUB or library fallback
Approval: not required (L0)

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

Lane: L1 · Status: PROPOSED · Score: R4 I3 C4 /E2 = 24
Story: As a reader hitting rate limits, I see a clear retry message instead of a blank error.
Evidence: WS6 rate-limit contract; CCR-019 a11y on critical states
Metric & target: 429 responses render Retry-After guidance; support tickets ↓
Flag: NEXT_PUBLIC_FEATURE_FRIENDLY_429 (default off until measured)
Gate/Star tie: North Star #8
Effort: S · Risk: none · Verification: trigger limit in staging; screenshot + header check
Approval: not required (L1 hardening-adjacent)

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

---

## How to add an entry

Copy the proposal template from
`.claude/skills/mangu-navigator/references/enhancement-engine.md`.
Assign the next `E-###` id. Never reclassify upward to ship sooner.
