# Enhancement engine — proactive path to industry leadership

Mission: make MANGU the platform readers compare *others* to. The engine runs
continuously — **discovery never stops; shipping is lane-gated** so ambition
can never break the migration or the GO. Losing looks like: shiny feature PRs
mid-freeze, a broken prod, a blown launch. Winning looks like: a deep, ranked,
evidence-backed backlog that starts landing the moment its lane opens.

## Lanes (classify every idea before writing code)

| Lane | May ship when | Examples |
| --- | --- | --- |
| **L0 Truth & defects** | Now (NEXT_GO permitted classes; G6 "no false success" is a *defect* class) | Placeholder/coming-soon surfaces made honest; broken flows; `console.log` → `lib/logger` |
| **L1 Hardening-adjacent** | Now, when it maps to a WS6/security/recovery item | Rate-limit UX (friendly 429 page), error-boundary polish, a11y fixes on critical states (CCR-019) |
| **L2 Perf/SEO/a11y improvements** | Owner-approved change-control OR post-GO | Metadata on the 24 uncovered pages, code-splitting the heavy client components, CWV budgets |
| **L3 Feature enhancements** | **Post-GO only**, or explicit owner unfreeze recorded in `HUMAN_TASKS.md`/`CLAUDE.md` | New rails, book clubs v1, audio↔text sync, subscriptions |
| **L4 Strategic bets** | Owner decision + design doc | Serialized publishing, creator monetization, mobile apps |

Never reclassify upward to ship sooner. When in doubt → L3.

## The pipeline (SCOUT → SPEC → RANK → LEDGER → GATE → BUILD → MEASURE)

1. **SCOUT** — run `scripts/enhance-scan.sh` (code signals); mine
   `analytics_events` patterns, reviews, stub surfaces, and the benchmark map
   below. Competitors to study when researching: Kindle/Audible, Spotify
   audiobooks, Everand, Fable, StoryGraph, Royal Road/serial platforms.
2. **SPEC** — one proposal per idea using the template at the bottom. An idea
   without a metric and a flag name is not a proposal.
3. **RANK** — score = (Reach × Impact × Confidence) / Effort, then adjust for
   strategic fit (does it deepen a moat MANGU already has: unified
   text+audio+social reading?). Tie-break toward lanes that can ship sooner.
4. **LEDGER** — append to `docs/ENHANCEMENT_LEDGER.md` (create if absent).
   Statuses: PROPOSED → APPROVED → BUILDING → SHIPPED(flag) → PROMOTED /
   KILLED. Owner approvals recorded inline with date. Optionally mirror as
   GitHub issues labeled `enhancement` + lane.
5. **GATE** — L0/L1 proceed citing the permitted class; L2 needs an owner
   approval line; L3/L4 wait for GO or explicit unfreeze. No silent exceptions.
6. **BUILD** — one PR per enhancement; **behind a flag, default OFF**
   (`NEXT_PUBLIC_FEATURE_*` or server flag); reuse house patterns (Radix +
   Tailwind + existing verticals — no new design languages); instrument
   impressions/clicks like the recommendation rails already do; a11y (WCAG 2.2
   AA on the surface touched) and CWV budgets are acceptance criteria; CI green;
   evidence in PR body.
7. **MEASURE → PROMOTE/KILL** — flag on for a slice, watch the named metric,
   then promote to default-on or delete the code. Dead flags are debt.

## Industry-leader benchmark map (what best-in-class means here)

Verified "have" against the tree @ `9a8a940`; gaps are the backlog seed.

| Domain | MANGU has | Gap toward leader | Lane |
| --- | --- | --- | --- |
| Discovery | Resonance embeddings, "Because you read", trending/editorial fallback, genre explorer | Taste onboarding flow; semantic search; per-book "more like this"; negative feedback ("not interested") | L3 |
| Reading UX | Progress, highlights+notes, follows, wishlist | Typography/theme controls (font, sepia, dyslexia-friendly); offline/PWA; cross-device position sync surfaced in UI | L3 (theme controls could be L2) |
| Audio | Full engine: speed, sleep timer, ±15s, chapters, resume, mini-player | Downloads/offline; car-mode UI; **audio↔text position sync** (the signature differentiator — few competitors do it well) | L3/L4 |
| Social | Activity feed, reading lists, readers-hub, follows | Book clubs v1 (route exists as placeholder → currently an L0 honesty item; the real feature is L3); shared highlights; reading challenges | L0 now / L3 later |
| Author tools | Portal, submissions, analytics dashboards | Funnel analytics (impression→sample→buy→finish); reader updates/newsletters per author; serialized drip publishing | L3/L4 |
| Commerce | Stripe checkout, wishlist, pricing/discount schema | Wishlist price-drop emails (Resend exists); gifting; bundles; credits/subscription model | L3 (model change = L4) |
| Perf | next/image adopted (0 raw `<img>`), ISR stub skill | Only 1 dynamic import vs 90 client components → route-level code-splitting; CWV budget in lighthouse-ci; `mangu-isr-cache` activation | L2 |
| SEO | JsonLd (46 uses), OG images, sitemaps | 24 of 61 pages lack `metadata`/`generateMetadata`; author/genre landing-page depth | L2 |
| A11y | 145 aria attrs, Radix primitives | Systematic WCAG 2.2 AA audit; keyboard paths through both players; captions/transcripts for audio | L1 (critical states) / L2 |
| Trust | Verified-purchase reviews, helpful votes, author replies | Content reporting; clearer refund/entitlement UX | L2/L3 |
| Hygiene | Sentry, structured logging path, rate limiting | 15 `console.log` in app/lib → logger; friendly 429/offline states | L0/L1 |

## Standing cadence

At session close (navigator §4 step 6), if ≥30 min remains or the frontier is
blocked: run one SCOUT pass and land 1–3 new/updated LEDGER entries. Ledger
grooming is always freeze-legal (document-only). During freeze, the engine's
output is *proposals and L0/L1 fixes* — that is the productive maximum, and it
compounds: on GO day the roadmap is already ranked, specced, and flag-named.

## Proposal template (copy into the ledger)

```
### E-### <title>
Lane: L0|L1|L2|L3|L4 · Status: PROPOSED · Score: R_ I_ C_ /E_ = __
Story: As a <reader|author|partner|admin>, I …
Evidence: <scan signal / analytics / benchmark ref>
Metric & target: <e.g., sample-play → purchase +X%>
Flag: NEXT_PUBLIC_FEATURE_<NAME> (default off)
Gate/Star tie: <G# or NS# or "post-GO growth">
Effort: S|M|L · Risk: <perf/privacy/scope> · Verification: <commands/QA>
Approval: <owner+date, required for L2+ during freeze>
```
