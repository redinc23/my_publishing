# Cowork Operator — Continuous Agent Playbook

**Mission:** Production site + catalog MCP working; Project Phoenix North Star complete.  
**Owner (human):** Faith / books@mangu-publishers.com  
**Agents:** Cursor Cloud / Claude Code reading this repo

This file is the **in-repo cowork control plane**. Cursor dashboard automations cannot be
created by agents via API — humans toggle those; agents keep this file + `HUMAN_TASKS.md` honest.

---

## Status check (agents: run first)

```bash
./scripts/cowork-status.sh
```

Or manually:

1. Read `HUMAN_TASKS.md` (especially **Cowork control** section).
2. `gh pr list --state open --limit 30`
3. Probe `https://www.mangu-publishers.com/api/health?ready=1`
4. Confirm storm automations are **disabled** (see below). If still enabled → stop opening new work; tell human.

---

## Path decision (locked)

| Path               | Meaning                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| **B — Phoenix**    | **ACTIVE.** Execute WS1→WS6 per `CLAUDE.md` + `docs/PROJECT_PHOENIX.md`. |
| A — Stabilize only | Paused. Do not use unless human flips this table.                        |

Skills live in `.claude/skills/` (merged). Load relevant `SKILL.md` every slice.

---

## Human must disable these Cursor automations (storm sources)

| Name                         | ID                                     | URL                                                                 | Required state |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------------- | -------------- |
| Fix CI failures              | `094ce0ad-7ba5-11f1-ba66-0e7d0216e441` | https://cursor.com/automations/094ce0ad-7ba5-11f1-ba66-0e7d0216e441 | **DISABLED**   |
| pr (Repository health sweep) | `ab582f50-7ba7-11f1-ba66-0e7d0216e441` | https://cursor.com/automations/ab582f50-7ba7-11f1-ba66-0e7d0216e441 | **DISABLED**   |

Verified enabled as of 2026-07-19 — they keep opening draft CI/health PRs.

---

## Safe Cursor automations to create (human, dashboard)

Create at https://cursor.com/automations — **only after** the two storm automations are off.

### Automation 1 — Phoenix next slice (cron 2×/day)

- **Name:** `Phoenix next slice`
- **Trigger:** Schedule — `0 14,22 * * *` UTC (adjust as needed)
- **Repo:** `redinc23/my_publishing`
- **Prompt:** paste from [`.cursor/automations/phoenix-next-slice.prompt.md`](../.cursor/automations/phoenix-next-slice.prompt.md)

### Automation 2 — Prod health triage (only on failure)

Prefer GitHub Actions `prod-health-watch.yml` (in-repo). If you also want a Cursor agent:

- **Name:** `Prod health triage`
- **Trigger:** Manual or rare cron (max 1×/day)
- **Prompt:** paste from [`.cursor/automations/prod-health-triage.prompt.md`](../.cursor/automations/prod-health-triage.prompt.md)

**Do not** recreate “fix every CI failure” without branch protection + max-1-PR guard.

---

## One-shot Cloud Agent prompt (manual)

When starting a new agent by hand, paste:

[`../.cursor/automations/phoenix-next-slice.prompt.md`](../.cursor/automations/phoenix-next-slice.prompt.md)

---

## Agent rules (non-negotiable)

1. One slice → one PR → stop. Branch `cursor/<slug>-c5d8`.
2. No duplicate recon / health-sweep / ci-autofix PRs.
3. Never invent secrets; append `HUMAN_TASKS.md`.
4. Keep CI green; feature freeze.
5. End every run with a **Next-run prompt** block the human can paste.

---

## Definition of done (engagement)

Phoenix North Star `docs/PROJECT_PHOENIX.md` §1.2 + prod `ready:true` + MCP gated correctly.
