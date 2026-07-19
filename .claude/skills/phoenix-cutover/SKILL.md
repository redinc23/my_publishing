---
name: phoenix-cutover
description: This skill should be used when preparing or supporting DNS cutover, Phase 12–15, Cloud Run standby, watch period, production QA matrix, mongodump evidence, or go/no-go around Phoenix launch.
version: 1.0.0
---

# Phoenix Cutover (Phases 12–15)

Most steps are **HUMAN GATES**. Agent role: prep checklists, verify code/CI, draft commands,
record evidence paths, update `HUMAN_TASKS.md`, never silently flip DNS.

## Entry criteria

- PR #1–#6 merged (or merge plan per §5.6 complete for code cutover)
- Phase 11 migration signed off (P11.6)
- Feature freeze still respected
- Rollback plan rehearsed on paper

## Phase 13 — DNS

| ID    | Action                            | Owner                              |
| ----- | --------------------------------- | ---------------------------------- |
| P13.0 | TTL → 60s (24h before)            | Human (Cloudflare)                 |
| P13.x | Point to Vercel                   | Human                              |
| P13.4 | Cloud Run min=0, keep 48h standby | Human                              |
| —     | Verify dig / curl www             | Agent can probe after human change |

## Phase 14–15

- P14.2 `mongodump` stored (human) — agent confirms evidence exists when shown
- 22-point QA matrix in prod (human runs; agent supports)
- P15.1 7-day watch: errors, p95, reset completion, webhook lag
- Token revocation / Supabase pause only after watch (human)

## Agent support checklist

- [ ] `/api/health?ready=1` → ready true on prod URL
- [ ] MCP flag intentional
- [ ] Rate limit + Sentry receiving (WS6)
- [ ] Forced-reset batch telemetry visible
- [ ] `grep -ri supabase app/ lib/ components/ types/` → 0
- [ ] Rollback decision tree linked in ops skill

## References

- `references/qa-matrix-pointer.md`
- `references/watch-period.md`
- `assets/cutover-day-checklist.md`
