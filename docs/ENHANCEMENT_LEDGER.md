# Enhancement Ledger — MANGU Publishers

Ranked, freeze-gated product backlog owned by the **mangu-navigator** enhancement
engine (`.claude/skills/mangu-navigator/references/enhancement-engine.md`).

**Rule:** discovery never stops; shipping is lane-gated (L0/L1 now; L2 needs
owner approval; L3+ waits for GO or explicit unfreeze).

Statuses: `PROPOSED` → `APPROVED` → `BUILDING` → `SHIPPED(flag)` → `PROMOTED` / `KILLED`

Seeded 2026-07-20 from navigator SCOUT + benchmark map @ `9a8a940`.

---

### E-001 Honest book-clubs placeholder
Lane: L0 · Status: PROPOSED · Score: R8 I7 C9 /E2 = 25.2
Story: As a reader, I see an honest "not available yet" surface on `/book-clubs` instead of a false-success UI.
Evidence: stub/coming-soon surface in consumer routes; G6 no-false-success
Metric & target: zero false-success complaints on book-clubs path; Phase 12 QA row pass
Flag: n/a (truth fix — ship default-on)
Gate/Star tie: G6
Effort: S · Risk: none · Verification: visual QA on `/book-clubs`; no CTA that implies live clubs
Approval: freeze-permitted (L0 defect / G6)

### E-002 Replace console.log with structured logger in app/lib
Lane: L0 · Status: PROPOSED · Score: R6 I6 C9 /E3 = 10.8
Story: As an operator, I get structured JSON logs instead of ad-hoc console noise in production.
Evidence: enhance-scan prod hygiene signal; WS6 logger path
Metric & target: `grep -r console.log app/ lib/` → 0 (excluding intentional tests)
Flag: n/a (hygiene)
Gate/Star tie: NS8 / WS6 adjacent
Effort: M · Risk: log volume · Verification: `grep -rn 'console\.log' app/ lib/ --include='*.ts*'`
Approval: freeze-permitted (L0 hygiene)

### E-003 Friendly 429 / rate-limit UX
Lane: L1 · Status: PROPOSED · Score: R7 I6 C8 /E3 = 11.2
Story: As a reader hitting rate limits, I see a clear retry message with Retry-After instead of a blank error.
Evidence: middleware already returns 429; WS6 hardening adjacent
Metric & target: 429 pages include Retry-After guidance; zero support tickets for "blank error"
Flag: NEXT_PUBLIC_FEATURE_FRIENDLY_429 (default off until measured)
Gate/Star tie: NS8 / WS6
Effort: S · Risk: none · Verification: force 429 in preview; check headers + UI
Approval: freeze-permitted (L1 hardening)

### E-004 Page metadata coverage (24 uncovered pages)
Lane: L2 · Status: PROPOSED · Score: R8 I7 C8 /E4 = 11.2
Story: As a search engine / social crawler, every public page has accurate title/description/OG.
Evidence: enhance-scan SEO gap; benchmark map
Metric & target: metadata/generateMetadata coverage ≥ 95% of page.tsx files
Flag: n/a (SEO correctness — still needs owner approval during freeze)
Gate/Star tie: post-GO growth / L2
Effort: M · Risk: incorrect titles · Verification: script counting metadata exports
Approval: **required** (L2 during freeze)

### E-005 Audio↔text position sync (signature differentiator)
Lane: L3 · Status: PROPOSED · Score: R9 I9 C6 /E8 = 6.1
Story: As a reader, I resume the same position whether I last left off in text or audio.
Evidence: benchmark map — few competitors do this well; MANGU already has both engines
Metric & target: cross-mode resume rate +X%; sample→finish conversion +Y%
Flag: NEXT_PUBLIC_FEATURE_AUDIO_TEXT_SYNC (default off)
Gate/Star tie: post-GO growth
Effort: L · Risk: privacy / sync correctness · Verification: e2e cross-mode resume
Approval: wait for GO or explicit unfreeze
