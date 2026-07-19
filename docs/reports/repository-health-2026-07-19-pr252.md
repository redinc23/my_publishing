# Repository Health Sweep — 2026-07-19

**Repository:** `redinc23/my_publishing`  
**Sweep trigger:** PR #252 `ready_for_review` @ 2026-07-19T02:09 UTC (PR since **merged** to `main`)  
**Base branch:** `main` @ `8593d1c` — `docs(phoenix): add agent skills packs for platform and MCP ops (#252)`

---

## Executive Summary

| Metric                                | Value                                                        |
| ------------------------------------- | ------------------------------------------------------------ |
| Open PRs                              | **10** (5 ready, 5 draft)                                    |
| Merge conflicts with `main`           | **4 PRs** — exact files identified below                     |
| Merge-ready (GHA green, no conflicts) | **#261**, **#249**; draft pick **#258**                      |
| Trigger PR #252                       | **Merged** ✅                                                |
| Vercel deployment checks              | **FAILING repo-wide** — build rate limit (not a code defect) |
| Remote branch cleanup candidates      | **65** (20 merged + 11 stale + 34 orphan autofix)            |

---

## 1. Open PR Triage

### 1.1 Merge Conflicts (⚠️ WARNING)

Detected via local `git merge --no-commit` against `origin/main`:

| PR                                                         | Branch                                | Conflicting Files                              |
| ---------------------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| [#142](https://github.com/redinc23/my_publishing/pull/142) | `cursor/copilot-cli-integration-3cae` | `.github/workflows/copilot-setup-steps.yml`    |
| [#234](https://github.com/redinc23/my_publishing/pull/234) | `cursor/mongodb-scaffold-dffa`        | `app/api/health/route.ts`, `package-lock.json` |
| [#248](https://github.com/redinc23/my_publishing/pull/248) | `cursor/phoenix-recon-deep-dive-95d8` | `HUMAN_TASKS.md`                               |
| [#254](https://github.com/redinc23/my_publishing/pull/254) | `fix/changelog-prettier`              | `CHANGELOG.md`                                 |

**Clean merge (6 PRs):** #261, #259, #258, #255, #253, #249

### 1.2 Full Open PR Inventory

| PR                                                         | Title                                                          | Draft | Merge           | GHA CI                | Notes                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ----- | --------------- | --------------------- | --------------------------------------------- |
| [#261](https://github.com/redinc23/my_publishing/pull/261) | Repo detox + Dependabot react guard + CHANGELOG prettierignore | ❌    | ✅ Clean        | ✅ All green          | **Merge-ready**                               |
| [#259](https://github.com/redinc23/my_publishing/pull/259) | Cloud Build CI anon key (autofix)                              | ✅    | ✅ Clean        | ✅ All green          | Duplicate — close                             |
| [#258](https://github.com/redinc23/my_publishing/pull/258) | Cloud Build CI anon key (autofix)                              | ✅    | ✅ Clean        | ✅ All green          | **Best autofix pick** — mark ready if merging |
| [#255](https://github.com/redinc23/my_publishing/pull/255) | Supabase anon key default (autofix)                            | ✅    | ✅ Clean        | ✅ All green          | Superseded approach — close                   |
| [#254](https://github.com/redinc23/my_publishing/pull/254) | Format CHANGELOG for Prettier                                  | ❌    | ⚠️ **Conflict** | N/A (stale)           | **Superseded by #261** — close                |
| [#253](https://github.com/redinc23/my_publishing/pull/253) | Cloud Build CI anon key (autofix)                              | ✅    | ✅ Clean        | ✅ All green          | Duplicate — close                             |
| [#249](https://github.com/redinc23/my_publishing/pull/249) | release 1.0.2 (release-please)                                 | ❌    | ✅ Clean        | N/A (docs-only)       | **Merge-ready** after #261                    |
| [#248](https://github.com/redinc23/my_publishing/pull/248) | Phoenix Phase 0 recon deep-dive                                | ✅    | ⚠️ **Conflict** | ❌ format/CI/E2E      | Rebase onto `main`, resolve `HUMAN_TASKS.md`  |
| [#234](https://github.com/redinc23/my_publishing/pull/234) | MongoDB Atlas scaffold (ADR-002)                               | ❌    | ⚠️ **Conflict** | ✅ (stale — pre-#252) | **Phoenix WS2a** — rebase required            |
| [#142](https://github.com/redinc23/my_publishing/pull/142) | Copilot CLI integration                                        | ❌    | ⚠️ **Conflict** | ❌ Playwright (Jul 9) | Stale 10d — close or full rebase              |

---

## 2. Merge-Ready Work

### 2.1 Ready to Merge Now

| PR       | Why ready                                                                                     | Blocker                                   |
| -------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **#261** | CI ✅ format ✅ lighthouse ✅ Playwright E2E ✅ dependency-review ✅ CodeQL ✅ — no conflicts | Vercel rate limit only (external)         |
| **#249** | Release-please bot PR — clean merge, version bump only                                        | Merge after #261 to avoid CHANGELOG drift |

### 2.2 Draft — Promote If Needed

| PR       | Why                                                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **#258** | Newest green autofix for `cloudbuild.yaml` CI anon-key guard; identical diff to #253/#259. Mark ready → merge, then close #253/#255/#259. |

### 2.3 Recently Merged (trigger context)

| PR       | Title                                                   | Merged                     |
| -------- | ------------------------------------------------------- | -------------------------- |
| **#252** | Agent skills packs for platform & MCP ops               | 2026-07-19 02:09 UTC ✅    |
| **#260** | Cache platform stats, no-store health, Stripe readiness | 2026-07-19 (prior to #252) |

### 2.4 CI Gate Reference

GitHub Actions gates on open PRs: **CI** (`test`), **Format Check**, **Lighthouse CI**, **Playwright E2E Tests**, **dependency-review**, **CodeQL**.  
Vercel preview deployments are **rate-limited** account-wide — do not block merges on Vercel status until quota resets.

---

## 3. Dead Code & Branch Hygiene

### 3.1 Merged into `main`, remote not deleted (20)

These branches are fully absorbed; safe to delete remotely:

- `claude/mangu-phase-1-authority-sv2hyn`
- `copilot/aggressive-performance-scalability-overhaul`
- `copilot/enhance`, `copilot/enhance-core-features-auth-profile`
- `copilot/featadmin-content-type`, `copilot/featmobile-nav`
- `copilot/plz-run-this-and-see-if-working`, `copilot/setup-ci-cd-tooling`
- `env-automation-v2`, `env-master-automation`
- `feat/add-rate-limiting`, `feat/mobile-nav`
- `fix/ENV-upstash-secret-sync`, `fix/P0.1-lockfile-upstash-deps`
- `fix/P0.2-node-version`, `fix/P0.3-upstash-env`, `fix/P0.4-rate-limit-tests`
- `fix/P1-launch-hardening`, `fix/distributed-rate-limiting`
- `fix/genre-counts-phase10`

Also delete post-merge: `cursor/phoenix-agent-skills-c5d8` (PR #252 branch, if still on remote).

### 3.2 Stale (>30 days, no open PR) — 11

Abandoned experiment/Jules/Copilot branches with no active PR:

- `enhanced-ci-workflow-8017118246652943162`
- `feat-parallelize-stats-fetching-14978014903356121747`
- `feature-analytics-growth-rate-13351340939507986598`
- `jules/file-hashing-deduplication-12685668244175777573`
- `perf-analytics-parallelization-932205919193246865`
- `jules-launch-readiness-10563070484880350534`
- `feat/frontend-improvements`, `feat/improved-k6-load-test`, `feat/k6-load-test-final`
- `fix/critical-build-blockers`, `fix/production-audit-findings-1-8`

### 3.3 Orphan CI-autofix branches (34, no open PR)

One-shot automation branches from resolved CI failures. All safe to delete except heads with open PRs (#253, #255, #258, #259 — close PRs first or keep one).

### 3.4 Recommended PR Closures (no merge)

| PR               | Action          | Reason                                          |
| ---------------- | --------------- | ----------------------------------------------- |
| #254             | Close           | Superseded by #261 `.prettierignore` + conflict |
| #253, #255, #259 | Close           | Duplicate autofix drafts; keep #258             |
| #142             | Close or rebase | 10-day stale, conflict, Playwright red          |

---

## 4. Copy-Paste Cleanup Script

**Review before running.** No destructive commands were executed by automation.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch origin --prune
git checkout main && git pull origin main

# ── MERGES (review order) ──────────────────────────────────────
gh pr merge 261 --squash --delete-branch   # repo detox — GHA green
gh pr merge 249 --squash --delete-branch   # release 1.0.2 — after #261
# Optional: mark #258 ready, then merge Cloud Build fix
# gh pr ready 258 && gh pr merge 258 --squash --delete-branch

# ── CLOSE superseded / duplicate PRs ───────────────────────────
gh pr close 254 --comment "Superseded by #261 (.prettierignore CHANGELOG.md)"
gh pr close 253 --comment "Duplicate autofix — keeping #258"
gh pr close 255 --comment "Duplicate autofix — keeping #258"
gh pr close 259 --comment "Duplicate autofix — keeping #258"
# gh pr close 142 --comment "Stale: conflict in copilot-setup-steps.yml + red E2E"

# ── DELETE remote branches merged into main (20) ───────────────
git push origin --delete \
  claude/mangu-phase-1-authority-sv2hyn \
  copilot/aggressive-performance-scalability-overhaul \
  copilot/enhance \
  copilot/enhance-core-features-auth-profile \
  copilot/featadmin-content-type \
  copilot/featmobile-nav \
  copilot/plz-run-this-and-see-if-working \
  copilot/setup-ci-cd-tooling \
  env-automation-v2 \
  env-master-automation \
  feat/add-rate-limiting \
  feat/mobile-nav \
  fix/ENV-upstash-secret-sync \
  fix/P0.1-lockfile-upstash-deps \
  fix/P0.2-node-version \
  fix/P0.3-upstash-env \
  fix/P0.4-rate-limit-tests \
  fix/P1-launch-hardening \
  fix/distributed-rate-limiting \
  fix/genre-counts-phase10 \
  cursor/phoenix-agent-skills-c5d8

# ── DELETE stale branches >30d (11) ───────────────────────────
git push origin --delete \
  enhanced-ci-workflow-8017118246652943162 \
  feat-parallelize-stats-fetching-14978014903356121747 \
  feat/frontend-improvements \
  feat/improved-k6-load-test \
  feat/k6-load-test-final \
  feature-analytics-growth-rate-13351340939507986598 \
  fix/critical-build-blockers \
  fix/production-audit-findings-1-8 \
  jules-launch-readiness-10563070484880350534 \
  jules/file-hashing-deduplication-12685668244175777573 \
  perf-analytics-parallelization-932205919193246865

# ── DELETE orphan ci-autofix branches (34) ─────────────────────
git push origin --delete \
  cursor/ci-autofix-automation-0017 \
  cursor/ci-autofix-automation-09f1 \
  cursor/ci-autofix-automation-1378 \
  cursor/ci-autofix-automation-1427 \
  cursor/ci-autofix-automation-197b \
  cursor/ci-autofix-automation-1c1d \
  cursor/ci-autofix-automation-24a2 \
  cursor/ci-autofix-automation-2529 \
  cursor/ci-autofix-automation-2797 \
  cursor/ci-autofix-automation-36be \
  cursor/ci-autofix-automation-4505 \
  cursor/ci-autofix-automation-5300 \
  cursor/ci-autofix-automation-609e \
  cursor/ci-autofix-automation-709e \
  cursor/ci-autofix-automation-8647 \
  cursor/ci-autofix-automation-96e5 \
  cursor/ci-autofix-automation-99be \
  cursor/ci-autofix-automation-9e07 \
  cursor/ci-autofix-automation-9e7c \
  cursor/ci-autofix-automation-a0f8 \
  cursor/ci-autofix-automation-ad57 \
  cursor/ci-autofix-automation-b1b2 \
  cursor/ci-autofix-automation-b9dc \
  cursor/ci-autofix-automation-c494 \
  cursor/ci-autofix-automation-ceab \
  cursor/ci-autofix-automation-d2bd \
  cursor/ci-autofix-automation-d494 \
  cursor/ci-autofix-automation-db24 \
  cursor/ci-autofix-automation-dd2a \
  cursor/ci-autofix-automation-dd48 \
  cursor/ci-autofix-automation-dfa4 \
  cursor/ci-autofix-automation-f6dc \
  cursor/ci-autofix-automation-f88c \
  cursor/ci-autofix-automation-fc78

# ── Local branch cleanup (after fetch --prune) ─────────────────
git branch -D cursor/repository-health-sweep-e7fd 2>/dev/null || true
git remote prune origin
```

---

## 5. Phoenix Migration Priority

After merges/cleanup, unblock Project Phoenix waterfall:

1. **Rebase #234** (`cursor/mongodb-scaffold-dffa`) — resolve `app/api/health/route.ts` + `package-lock.json` conflicts → merge as WS2a PR #2a
2. **Rebase #248** or open fresh recon PR from `main` — resolve `HUMAN_TASKS.md` add/add
3. Keep `main` linear: merge #261 → #249 → (optional #258) before Phoenix WS1 auth PR

---

_Generated by Cursor repository-health-sweep automation — 2026-07-19T02:09 UTC_
