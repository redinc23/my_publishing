# Contributing to MANGU Publishers

Thanks for taking the time to contribute! This document describes how we work on this repo and what we expect from contributions.

## Table of contents

- [Development setup](#development-setup)
- [Branching model](#branching-model)
- [Commit conventions](#commit-conventions)
- [Pull request flow](#pull-request-flow)
- [Validation commands](#validation-commands)
- [Branch protection rules (`main`)](#branch-protection-rules-main)
- [Repository security settings](#repository-security-settings)
- [Automations / CI](#automations--ci)
- [Reporting security issues](#reporting-security-issues)

## Development setup

```bash
# Node 20+ required (see .nvmrc / package.json engines)
nvm use
npm ci
cp .env.example .env.local   # then fill in secrets
npm run dev
```

## Branching model

- `main` — protected, always deployable. All changes land via PR.
- `develop` — optional integration branch; CI also runs here.
- Feature branches: `<author>/<short-kebab-description>` (e.g. `redinc23/add-stripe-webhook`).
- AI-agent branches: `claude/<topic>`, `copilot/<topic>`, etc. — these are auto-merged once CI passes (see `.github/workflows/auto-merge.yml`).

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`, `build`.

Examples:
- `feat(checkout): add coupon code support`
- `fix(auth): handle expired magic links`
- `chore(deps): bump next from 14.2.0 to 14.2.1`

## Pull request flow

1. Create a feature branch from `main`.
2. Make your changes; keep PRs focused and small.
3. Run validation locally (see below).
4. Open a PR using the [PR template](./.github/PULL_REQUEST_TEMPLATE.md).
5. CI must pass; at least one approval is required from a CODEOWNER.
6. Merge using **squash** (the default). The auto-merge bot handles this once CI is green for labeled or AI-agent PRs.

## Validation commands

All of these must pass before merge:

```bash
npm run type-check   # tsc --noEmit
npm run lint         # next lint
npm run test         # jest
npm run build        # next build
npm run test:e2e     # Playwright (runs in CI on every PR)
```

## Branch protection rules (`main`)

> **Repository admin action required.** These rules are not stored in source — they must be configured in **Settings → Branches → Branch protection rules** for the `main` branch. Apply the following:

- **Require a pull request before merging**
  - Require approvals: **1**
  - Dismiss stale pull request approvals when new commits are pushed: **on**
  - Require review from Code Owners: **on**
- **Require status checks to pass before merging**
  - Require branches to be up to date before merging: **on**
  - Required checks:
    - `test` (from `ci.yml`)
    - `Analyze (javascript-typescript)` (from `codeql.yml`)
    - `Analyze (actions)` (from `codeql.yml`)
    - `Analyze (python)` (from `codeql.yml`)
    - `Playwright (chromium)` (from `e2e.yml`)
    - `Playwright (firefox)` (from `e2e.yml`)
    - `Playwright (webkit)` (from `e2e.yml`)
    - `dependency-review` (from `dependency-review.yml`, once added in Tier 2)
- **Require conversation resolution before merging:** on
- **Require signed commits:** recommended (optional)
- **Require linear history:** on (we squash-merge)
- **Restrict who can push to matching branches:** maintainers + the auto-merge bot
- **Do not allow bypassing the above settings:** on
- **Allow force pushes:** off
- **Allow deletions:** off

## Repository security settings

> **Repository admin action required.** Configure in **Settings → Code security and analysis**:

- **Dependency graph:** on
- **Dependabot alerts:** on
- **Dependabot security updates:** on
- **Dependabot version updates:** on (driven by [`.github/dependabot.yml`](./.github/dependabot.yml))
- **Code scanning (CodeQL):** on (already configured in [`.github/workflows/codeql.yml`](./.github/workflows/codeql.yml))
- **Secret scanning:** on
- **Push protection (for secrets):** on
- **Private vulnerability reporting:** on

## Automations / CI

This repo runs the following GitHub Actions workflows. See `.github/workflows/` for source.

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push/PR | type-check, lint, test, build (+ optional Vercel deploy) |
| `e2e.yml` | push/PR | Playwright E2E across chromium / firefox / webkit |
| `codeql.yml` | push/PR + weekly | Security scanning (JS/TS, Actions, Python) |
| `deploy.yml` | push to `main` | Deploy to Google Cloud Run (canonical prod) |
| `vercel-deploy.yml` | push/PR | Secondary Vercel build/test |
| `supabase-migrate.yml` | push to `main` (migrations only) | Apply Supabase migrations |
| `auto-merge.yml` | PR events | Auto-merge AI-agent PRs and labeled PRs once CI passes |
| `bug-to-issue.yml` | after CI completion | Open an issue after 3 consecutive CI failures on `main` |
| `admin-setup.yml` | manual | Bulk configure environments across listed repos |
| `copilot-setup-steps.yml` | self | Configures Copilot agent environment |

Dependency automation:

- Dependabot — [`.github/dependabot.yml`](./.github/dependabot.yml) — weekly npm + GitHub Actions + Docker updates.
- Code owners — [`.github/CODEOWNERS`](./.github/CODEOWNERS) — auto-requests reviewers for matching paths.

## Reporting security issues

**Do not** open public GitHub issues for security vulnerabilities. Use [GitHub Security Advisories](https://github.com/redinc23/my_publishing/security/advisories/new) instead. We'll acknowledge within 72 hours.
