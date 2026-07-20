# Enhancement Ledger

Ranked, lane-gated product improvements for MANGU Publishers.  
Authority: `mangu-navigator` skill §4b + `references/enhancement-engine.md`.

**During feature freeze:** only L0/L1 may ship without owner approval. L2+ need an
inline approval line. L3/L4 wait for GO or explicit unfreeze in `HUMAN_TASKS.md`.

Statuses: `PROPOSED` → `APPROVED` → `BUILDING` → `SHIPPED(flag)` → `PROMOTED` / `KILLED`

Run `bash .claude/skills/mangu-navigator/scripts/enhance-scan.sh` before SCOUT passes.

---

## Seed entries (from enhancement-engine benchmark map @ 9a8a940)

### E-001 Book clubs placeholder honesty
Lane: L0 · Status: PROPOSED · Score: R4 I3 C5 /E1 = 60  
Story: As a reader, I see an honest state on `/book-clubs` instead of a false "coming soon" that implies the feature exists.  
Evidence: `enhance-scan.sh` stub surface grep; G6 false-success class  
Metric & target: 0 placeholder-only routes in manual QA row 6  
Flag: n/a (copy-only)  
Gate/Star tie: G6  
Effort: S · Risk: scope · Verification: Phase 12 live acceptance  
Approval: —

### E-002 Console.log → structured logger (app/lib burn-down)
Lane: L0/L1 · Status: PROPOSED · Score: R3 I2 C5 /E2 = 15  
Story: As an operator, I get JSON logs from API paths instead of ad-hoc console output.  
Evidence: enhance-scan hygiene count (~15 `console.log` in app/lib)  
Metric & target: grep count → 0 in `app/` + `lib/`  
Flag: n/a  
Gate/Star tie: NS8 / WS6  
Effort: M · Risk: low · Verification: `grep -r console.log app/ lib/`  
Approval: —

### E-003 Page metadata coverage (24 uncovered routes)
Lane: L2 · Status: PROPOSED · Score: R4 I3 C4 /E3 = 16  
Story: As a discovery visitor, I get correct titles/descriptions on genre and author landing pages.  
Evidence: enhance-scan SEO signal (pages vs metadata exports)  
Metric & target: Lighthouse SEO ≥ 90 on 5 sampled uncovered routes  
Flag: n/a (no product flag needed)  
Gate/Star tie: post-GO growth  
Effort: M · Risk: low · Verification: `npm run build` + spot-check OG tags  
Approval: owner required during freeze

### E-004 Audio↔text position sync
Lane: L3 · Status: PROPOSED · Score: R5 I5 C3 /E5 = 15  
Story: As a reader, I resume audio where I left off in the ebook (signature differentiator).  
Evidence: enhancement-engine benchmark map — few competitors do this well  
Metric & target: cross-mode resume success rate ≥ 80% in dogfood cohort  
Flag: `NEXT_PUBLIC_FEATURE_AUDIO_TEXT_SYNC` (default off)  
Gate/Star tie: post-GO  
Effort: L · Risk: scope/perf · Verification: Playwright cross-mode spec  
Approval: post-GO only
