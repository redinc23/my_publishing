# MANGU Publishers — Agent Instructions

Primary project instructions for GitHub Copilot CLI (and compatible agents). Cursor simulation rules live in [`cursorrules`](cursorrules). Custom agent profiles live in [`.github/agents/`](.github/agents/). Full product docs: [`docs/MANGU_PUBLISHERS_END_TO_END.md`](docs/MANGU_PUBLISHERS_END_TO_END.md). Copilot CLI operator guide: [`docs/COPILOT_CLI.md`](docs/COPILOT_CLI.md).

## Project

MANGU Publishers is a Netflix-inspired digital publishing platform: book marketplace, reading progress, author/partner portals, Stripe checkout, Supabase auth, admin dashboard, and analytics.

## Stack and canonical paths

- **Framework:** Next.js 14 App Router, React 18, TypeScript (strict), Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, pgvector)
- **Payments:** Stripe
- **AI (product):** OpenAI embeddings for Resonance; heuristic AI insights elsewhere
- **Production path:** Google Cloud Build → Cloud Run (`cloudbuild.yaml`). Vercel/Amplify configs are secondary.

| Path | Role |
|------|------|
| `app/` | App Router pages and API routes |
| `lib/` | Business logic, server actions, services |
| `components/` | UI and feature components |
| `supabase/migrations/` | Ordered SQL migrations |
| `scripts/` | Setup, seed, bootstrap, CI helpers |
| `tools/` | Dev tooling (e.g. Copilot deep-dive packet) |
| `docs/` | Ops, deploy, Phase 2, standards |

## Hard constraints

- Prefer existing patterns over new abstractions; match local style.
- TypeScript strict; do not weaken types to “make it compile.”
- Never commit secrets, tokens, or real `.env` values. Use placeholders in examples.
- Do not invent migrations out of order; respect `supabase/migrations/` naming and apply order.
- Cloud Run via `cloudbuild.yaml` is the canonical production path—do not treat Vercel/Amplify as primary without an explicit request.
- Avoid drive-by refactors unrelated to the asked task.
- Confirm before destructive shell (`rm`, mass `sed`, `chmod`, force-push) unless the user explicitly allows all tools (`--yolo` / `--allow-all` / equivalent).

## Workflow modes (from `cursorrules`)

When the user asks for a mode—or you select a matching custom agent—behave accordingly:

| Mode | Agent profile | Behavior |
|------|---------------|----------|
| **Explore** | `explore` | Quick codebase analysis; clear answers; no context bloat; cite files |
| **Task** | `task` | Scripts, tests, automations; brief success summary; full verbose output on failure |
| **Code Review** | `code-review` | Real bugs, security, regressions; minimize stylistic noise |
| **Research** | `research` | Deep dive with a citation report and file paths |
| **Plan Mode** | `plan` | Collaborate on an implementation plan first; wait for approval before writing code |

## Slash-command mapping (Copilot CLI)

Copilot CLI has built-in plan mode (e.g. Shift+Tab / `/plan`). Map human shortcuts to agents as follows:

- `/plan` → use **plan** agent (or CLI plan mode); no code until approved
- `/review` → **code-review** agent on current file or recent changes
- `/research [topic]` → **research** agent; produce a citation report
- `/task [goal]` → **task** agent; emit exact shell/scripts/config to hit the goal
- `--yolo` / `--allow-all` → skip conversational confirmation; act directly within tool permissions

Invoke agents interactively with `/agent`, or programmatically:

```bash
copilot --agent code-review --prompt "Review the latest diff for security issues"
```

## Tool and file rules

- Prefer `@`-referenced files and paths the user names.
- Briefly explain *why* before large code or command blocks.
- Keep changes scoped; update docs only when behavior or operator workflow changes.
