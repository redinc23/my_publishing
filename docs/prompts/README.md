# MANGU Revamp — Parallel Agent Prompts

Three self-contained prompts for running the MANGU Publishers revamp in parallel across three Claude accounts.

## How to use

1. Assign one prompt file per engineer / Claude account.
2. Paste the full contents of the assigned file into Claude (or point Claude at the file in the repo).
3. Each agent works on its own branch to avoid file conflicts.

| Agent | Prompt file | Branch suggestion | Domain |
|-------|-------------|-------------------|--------|
| **Alpha** | [AGENT_ALPHA.md](./AGENT_ALPHA.md) | `cursor/alpha-reading-reviews-9e38` | EPUB reader, reviews, readers hub |
| **Bravo** | [AGENT_BRAVO.md](./AGENT_BRAVO.md) | `cursor/bravo-payments-email-qa-9e38` | Email, Stripe, E2E, deploy |
| **Charlie** | [AGENT_CHARLIE.md](./AGENT_CHARLIE.md) | `cursor/charlie-resonance-partner-debt-9e38` | Resonance, analytics, partner portal, tech debt |

## Coordination

| Topic | Owner | Notes |
|-------|-------|-------|
| EPUB reader | Alpha | Blocks full purchase→read E2E |
| Reviews on book pages | Alpha | Independent |
| Email sends | Bravo | Independent |
| Subscription gating | Bravo | May touch reading page server guard |
| E2E purchase test | Bravo | Partial until Alpha merges |
| Resonance vectors | Charlie | Independent |
| Author earnings | Charlie | Independent |
| Partner portal | Charlie | Independent |
| Rate limit merge | Charlie | Don't touch until Charlie PR |
| Migration count doc | Bravo | 15 files |
| Phase 2 Vite→Next alignment | Charlie | Docs only |

**Suggested merge order:** Bravo → Alpha → Charlie (or rebase all onto `main` after each PR lands).

## Shared rules (all agents)

- Do **not** touch `.env.local`, interactive setup scripts, or GCP sync-from-local.
- **Wire before you build** — use existing components and actions first.
- Update docs for your slice as you complete work.
- Stay within your file ownership boundaries; use `// COORDINATION:` comments for cross-agent needs.

## Source inventory

The full revamp inventory these prompts were derived from is documented in conversation and cross-referenced in `docs/MANGU_PUBLISHERS_END_TO_END.md`.
