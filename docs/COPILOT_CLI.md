# GitHub Copilot CLI

Operator guide for using [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli) against this repository.

Project instructions load from [`AGENTS.md`](../AGENTS.md). Custom agents live in [`.github/agents/`](../.github/agents/). Cursor continues to simulate the same personas via [`cursorrules`](../cursorrules).

## Prerequisites

- Active GitHub Copilot subscription (CLI enabled for your org if applicable)
- Node.js 22+ if installing via npm (`@github/copilot`); the app itself targets Node ≥ 20 (see `.nvmrc`)

## Install

Pick one:

```bash
# npm (all platforms; requires Node 22+)
npm install -g @github/copilot

# Install script (macOS / Linux)
curl -fsSL https://gh.io/copilot-install | bash

# Homebrew (macOS / Linux)
brew install --cask copilot-cli
```

## Authenticate

From a terminal:

```bash
copilot
```

On first launch, run `/login` and follow the prompts.

For non-interactive use, set `GH_TOKEN` or `GITHUB_TOKEN` (precedence: `GH_TOKEN` first) with a fine-grained token that includes **Copilot Requests** permission.

## Run against this repo

```bash
cd /path/to/my_publishing   # repo root
copilot
```

Copilot CLI loads root `AGENTS.md` automatically. Use `/agent` to pick a custom agent, or pass one on the command line:

```bash
copilot --agent explore --prompt "Where is Stripe webhook verification handled?"
copilot --agent code-review --prompt "Review the latest uncommitted changes for security issues"
copilot --agent research --prompt "Trace Resonance embedding generation end to end"
copilot --agent plan --prompt "Plan adding a reviews table and API without writing code yet"
copilot --agent task --prompt "Give me the exact commands to run unit tests and lint"
```

### Mode mapping (from `cursorrules`)

| Shortcut / intent | Agent |
|-------------------|--------|
| Explore / orient | `explore` |
| `/task [goal]` | `task` |
| `/review` | `code-review` |
| `/research [topic]` | `research` |
| `/plan` / Plan Mode | `plan` (or CLI built-in plan mode) |
| Maintenance checklist | `my-agent` |

## Related tooling

- [`tools/copilot_deep_dive.py`](../tools/copilot_deep_dive.py) — generate a paste-ready markdown packet for Copilot Chat deep dives
- [`.github/workflows/copilot-setup-steps.yml`](../.github/workflows/copilot-setup-steps.yml) — environment bootstrap for Copilot coding-agent sessions on GitHub

## Safety

Confirm before destructive shell commands unless you explicitly allow all tools. Do not paste production secrets into prompts. Prefer placeholder env values when demonstrating setup.
