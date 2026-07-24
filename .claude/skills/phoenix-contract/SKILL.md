---
name: phoenix-contract
description: This skill should be used when the user or agent mentions Project Phoenix, workstreams WS1–WS6, Task IDs, feature freeze, amending PROJECT_PHOENIX.md, migration PRs, North Star definition of done, or asks what order Phoenix work must land. Enforces the Phoenix contract and stops improvisation.
version: 1.0.0
---

# Phoenix Contract

## Source of truth

1. Read `docs/PROJECT_PHOENIX.md` (v4.0) before planning code.
2. Read `CLAUDE.md` for execution order and guardrails.
3. Read `docs/PHOENIX_RECON.md` for repo reality vs doc deltas.
4. If reality conflicts with the doc: **STOP**, amend the Phoenix doc in the same PR with a `docs:` commit. Do not improvise silently.

## Non-negotiables

- Feature freeze: migration parity + WS6 hardening only.
- Never migrate password hashes (bcrypt ≠ scrypt). Locked credentials + forced reset only.
- Stripe webhook must be idempotent (`stripe_payment_intent_id` unique + upsert + 200 on duplicate).
- Zero `@supabase` imports in `app/ lib/ components/ types/` after PR #4.
- No secrets in the repo. Missing credentials → `HUMAN_TASKS.md`.
- Edge middleware: cookie-only session check; no MongoDB driver on Edge.
- Every PR keeps CI green (Jest + Playwright). Do not merge red PRs.

## Merge order (strict)

| Order | PR       | Workstream             | Branch pattern                     |
| ----- | -------- | ---------------------- | ---------------------------------- |
| 0     | docs     | Recon / skills / docs  | `cursor/…` or `feat/phoenix-ws0-…` |
| 1     | PR #1    | WS1 Auth               | `feat/phoenix-ws1-…`               |
| 2     | PR #2a–d | WS2 Data               | `feat/phoenix-ws2-…`               |
| 3     | PR #3    | WS3 Storage            | `feat/phoenix-ws3-…`               |
| 4     | PR #4    | WS4 Health/env/cleanup | `feat/phoenix-ws4-…`               |
| 5     | PR #5    | WS5 Tests              | `feat/phoenix-ws5-…`               |
| 6     | PR #6    | WS6 Observability      | `feat/phoenix-ws6-…`               |

## PR body requirements

Every Phoenix PR must:

1. List Task IDs implemented (from doc §4.3 / §5).
2. Paste Verification column evidence (commands/output).
3. Tick relevant §9.4 Master Checklist boxes.
4. Note any doc amendments.

Use `assets/pr-body-template.md`.

## Commit conventions

- `feat(phoenix-wsN): …`
- `fix(phoenix-wsN): …`
- `docs(phoenix): …`
- `chore(phoenix-wsN): …`

## North Star (Definition of Done)

Do not claim Phoenix complete until all eight boxes in doc §1.2 are certifiable
(build, health ready, QA matrix, PRs merged, mongodump, zero supabase imports,
forced-reset telemetry, rate-limit + Sentry + logs).

## References

- Task ID map: `references/task-id-index.md`
- Recon deltas D1–D8: `references/delta-list.md`
- PR template: `assets/pr-body-template.md`
