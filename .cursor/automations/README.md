# Cursor Automations (human-created)

Agents **cannot** create or disable Cursor Automations via API (read-only `get-automation`).
You create these in the dashboard; prompts here are the source of truth.

## Before creating anything

1. Disable storm automations listed in `docs/COWORK_OPERATOR.md`.
2. Enable branch protection on `main` (`HUMAN_TASKS` H1.1).

## Create

1. Open https://cursor.com/automations → New automation.
2. Attach repo `redinc23/my_publishing`.
3. Paste the full contents of one prompt file below as the automation instruction.
4. Set schedule as documented in `docs/COWORK_OPERATOR.md`.
5. Enable **only** the safe automations (Phoenix next slice ± health triage).

## Prompt files

| File | Purpose |
| ---- | ------- |
| `phoenix-next-slice.prompt.md` | Continuous Phoenix WS waterfall (Path B) |
| `prod-health-triage.prompt.md` | Prod readiness triage when health is red |

## Verify

After toggle, ask any agent: “Check automation 094ce0ad… and ab582f50… enabled flags.”
Both must report `enabled: false`.
