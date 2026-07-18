# Repository Health Sweep — 2026-07-18 (PR #235)

**Repository:** `redinc23/my_publishing`  
**Sweep trigger:** PR #235 ready-for-review automation @ 2026-07-18T19:17 UTC  
**Base branch:** `main` @ `0d8a4e3`

---

## Executive Summary

| Metric                                   | Value                                                     |
| ---------------------------------------- | --------------------------------------------------------- |
| Open PRs                                 | **11** (11 non-draft, 0 draft)                            |
| Merge conflicts with `main`              | **10 PRs** ⚠️                                             |
| Merge-ready (all CI green, no conflicts) | **0**                                                     |
| Near merge-ready                         | **#241** (release 1.0.1 — Vercel build rate limit only)   |
| `main` CI (`ci.yml`)                     | **FAILING** — npm Audit failure on #155 merge @ 19:18 UTC |
| Production Health Check                  | **PASSING** @ 18:49 UTC ✅                                |
| Remote branch cleanup candidates         | **87**                                                    |

### Merged During This Sweep Window

| PR                                                         | Title                                            | Merged    |
| ---------------------------------------------------------- | ------------------------------------------------ | --------- |
| [#235](https://github.com/redinc23/my_publishing/pull/235) | docs(ops): repository health sweep 2026-07-18    | 19:17 UTC |
| [#237](https://github.com/redinc23/my_publishing/pull/237) | fix: Prettier formatting for PROJECT_PHOENIX.md  | 19:17 UTC |
| [#239](https://github.com/redinc23/my_publishing/pull/239) | chore: root CLAUDE.md for agent auto-briefing    | 19:17 UTC |
| [#240](https://github.com/redinc23/my_publishing/pull/240) | fix(ci): format check + bug-to-issue rebase race | 19:17 UTC |
| [#155](https://github.com/redinc23/my_publishing/pull/155) | chore(deps): bump react-dom and @types/react-dom | 19:18 UTC |

---

## 1. Open PR Triage

### 1.1 Merge Conflicts (⚠️ WARNING)

Detected via local `git merge --no-commit` against `origin/main`:

| PR                                                         | Branch                                | Conflicting Files                                                               |
| ---------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| [#142](https://github.com/redinc23/my_publishing/pull/142) | `cursor/copilot-cli-integration-3cae` | `.github/workflows/copilot-setup-steps.yml`                                     |
| [#184](https://github.com/redinc23/my_publishing/pull/184) | `cursor/reorder-supabase-migrations`  | `docs/NEXT_GO.md`                                                               |
| [#212](https://github.com/redinc23/my_publishing/pull/212) | `cursor/ci-autofix-automation-fc78`   | `docs/NEXT_GO.md`, `docs/adr/ADR-001-canonical-platform.md`                     |
| [#220](https://github.com/redinc23/my_publishing/pull/220) | `cursor/ci-autofix-automation-d2bd`   | `lib/mcp/guard.ts`                                                              |
| [#222](https://github.com/redinc23/my_publishing/pull/222) | `cursor/ci-autofix-automation-9e07`   | `lib/mcp/guard.ts`                                                              |
| [#224](https://github.com/redinc23/my_publishing/pull/224) | `cursor/ci-autofix-automation-f6dc`   | `app/api/mcp/[transport]/route.ts`, `tests/unit/mcp-transport-security.test.ts` |
| [#228](https://github.com/redinc23/my_publishing/pull/228) | `cursor/ci-autofix-automation-2529`   | `.github/workflows/bug-to-issue.yml`                                            |
| [#230](https://github.com/redinc23/my_publishing/pull/230) | `cursor/ci-autofix-automation-5300`   | `.github/workflows/bug-to-issue.yml`                                            |
| [#232](https://github.com/redinc23/my_publishing/pull/232) | `cursor/ci-autofix-automation-ad57`   | `.github/workflows/bug-to-issue.yml`, `.github/workflows/health-check.yml`      |
| [#234](https://github.com/redinc23/my_publishing/pull/234) | `cursor/mongodb-scaffold-dffa`        | `package-lock.json`                                                             |

**Clean merge (1 PR):** [#241](https://github.com/redinc23/my_publishing/pull/241) (release-please 1.0.1)

### 1.2 CI Status by Open PR

| PR   | Title                           | Merge        | CI Failures                                    | Notes                                          |
| ---- | ------------------------------- | ------------ | ---------------------------------------------- | ---------------------------------------------- |
| #241 | release 1.0.1                   | Clean        | Vercel – manguprojectz, Vercel – my_publishing | Vercel **build rate limit** — not code failure |
| #234 | MongoDB Atlas scaffold          | **Conflict** | Vercel – my_publishing                         | Core CI green; rebase `package-lock.json`      |
| #232 | health-check DNS + bug-to-issue | **Conflict** | e2e                                            | Superseded by merged #231 — close              |
| #230 | bug-to-issue npm fix            | **Conflict** | e2e                                            | Superseded by merged #240 — close              |
| #228 | bug-to-issue working tree       | **Conflict** | e2e                                            | Superseded by merged #240 — close              |
| #224 | MCP route helpers               | **Conflict** | e2e                                            | Superseded by merged #223 — close              |
| #222 | MCP guard helpers               | **Conflict** | —                                              | Superseded by merged #223 — close              |
| #220 | MCP guard helpers               | **Conflict** | —                                              | Superseded by merged #223 — close              |
| #212 | format-check + vuln-scan        | **Conflict** | —                                              | Superseded by merged #225/#237/#240 — close    |
| #184 | Supabase migration reorder      | **Conflict** | e2e, format, Playwright                        | Needs rebase + CI fix                          |
| #142 | Copilot CLI integration         | **Conflict** | Playwright                                     | Stale (9 days) — close or rebase               |

---

## 2. Merge-Ready Work

### 2.1 Fully Merge-Ready: **None**

No open PR has all required checks green **and** a clean merge with `main`.

### 2.2 Near Merge-Ready

**[#241](https://github.com/redinc23/my_publishing/pull/241) — `chore(main): release 1.0.1`**

- Merge state: `unstable` (mergeable, no conflicts)
- GitHub CI: not yet fully reported (release-please bot PR)
- Blocker: **Vercel build rate limit** on both projects (`upgradeToPro=build-rate-limit`)
- Action: wait for Vercel quota reset or upgrade; then merge for semver release

**[#234](https://github.com/redinc23/my_publishing/pull/234) — MongoDB Atlas scaffold**

- Core CI: ✅ `CI`, `Format Check`, `Playwright E2E`, `Lighthouse CI`, `CodeQL`
- Copilot Setup Steps / Development environment setup: ✅ (passes on PRs touching workflow files)
- Blockers: merge conflict in `package-lock.json`; Vercel – my_publishing FAILURE
- Action: rebase onto `main`, resolve lockfile, re-run CI

### 2.3 Main Branch CI

| Workflow                        | Status     | Last Run                           |
| ------------------------------- | ---------- | ---------------------------------- |
| `ci.yml`                        | ❌ FAILURE | 2026-07-18 19:18 UTC (#155 merge)  |
| `health-check.yml` (Production) | ✅ SUCCESS | 2026-07-18 18:49 UTC               |
| `npm Audit`                     | ❌ FAILURE | 2026-07-18 19:18 UTC (#155 merge)  |
| `Copilot Setup Steps`           | ✅ per-PR  | Validates `npm ci` dev environment |

**Note:** Production readiness probe (`/api/health?ready=1`) is green. Main CI failure is from the #155 dependabot merge triggering npm Audit — investigate separately from production health.

---

## 3. Dead Code & Stale Branches

### 3.1 Already Merged into `main` (21 branches)

Safe to delete — fully contained in `main`:

```
claude/mangu-phase-1-authority-sv2hyn       (PR #210)
copilot/plz-run-this-and-see-if-working     (PR #105)
copilot/enhance-core-features-auth-profile  (PR #102)
copilot/enhance                             (PR #101)
feat/mobile-nav                             (PR #100)
copilot/featadmin-content-type              (PR #99)
copilot/featmobile-nav                      (PR #98)
fix/ci-esm-and-deploy-workflow              (PR #97)
feat/task-1.3-add-content-type              (PR #90)
feat/hero-depth-layer                       (PR #95)
feat/retailer-urls                          (PR #94)
feat/comics-papers-routes                   (PR #93)
feat/library-dropdown-nav                   (PR #92)
feat/content-type-types                     (PR #91)
fix/lint-unused-passthrough                 (PR #96)
fix/critical-build-blockers                 (PR #89)
fix/ENV-upstash-secret-sync                 (PR #84)
fix/P1-launch-hardening                     (PR #85)
fix/P0.1-lockfile-upstash-deps              (PR #86)
fix/distributed-rate-limiting               (PR #77)
feat/add-rate-limiting                      (PR #74)
```

### 3.2 Orphan `cursor/ci-autofix-automation-*` (26 branches)

Automation churn with no open PR — safe to delete.

### 3.3 Abandoned Branches (no open PR, not merged) — 40 branches

Includes stale feature branches (`cursor/launch-readiness-*`, `cursor/homepage-seo-*`, `feat/frontend-improvements`, Jules analytics branches, etc.). Review before deleting — some may have unmerged work.

**Total cleanup candidates: 87 remote branches**

---

## 4. Recommended Actions

### 4.1 Close Superseded PRs

```bash
gh pr close 212 --comment "Superseded by merged #225/#237/#240"
gh pr close 220 --comment "Superseded by merged #223"
gh pr close 222 --comment "Superseded by merged #223"
gh pr close 224 --comment "Superseded by merged #223"
gh pr close 228 --comment "Superseded by merged #240"
gh pr close 230 --comment "Superseded by merged #240"
gh pr close 232 --comment "Superseded by merged #231"
```

### 4.2 Close or Rebase Stale PRs

```bash
# Stale — close unless actively needed
gh pr close 142 --comment "Stale Copilot CLI integration — 9+ days, conflicts with main"

# Worth saving — rebase required
# gh pr checkout 184 && git fetch origin main && git rebase origin/main
# gh pr checkout 234 && git fetch origin main && git rebase origin/main
```

### 4.3 Merge Order (when ready)

1. Fix `main` npm Audit failure from #155 merge
2. **#241** — merge release 1.0.1 after Vercel rate limit clears
3. **#234** — rebase + resolve `package-lock.json`, then merge MongoDB scaffold
4. Run branch cleanup script below

---

## 5. Copy-Paste Cleanup Scripts

> **Review before running.** These are destructive. No commands are executed by automation.

### 5.1 Close Superseded PRs + Delete Remote Branches

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch origin --prune

# --- Close superseded PRs ---
for n in 212 220 222 224 228 230 232; do
  gh pr close "$n" --comment "Superseded — see repository health sweep 2026-07-18" || true
done

# --- Delete merged + orphan remote branches ---
BRANCHES=(
  claude/mangu-phase-1-authority-sv2hyn
  copilot/enhance
  copilot/enhance-core-features-auth-profile
  copilot/featadmin-content-type
  copilot/featmobile-nav
  copilot/plz-run-this-and-see-if-working
  cursor/ci-autofix-automation-0017
  cursor/ci-autofix-automation-09f1
  cursor/ci-autofix-automation-1378
  cursor/ci-autofix-automation-1427
  cursor/ci-autofix-automation-197b
  cursor/ci-autofix-automation-1c1d
  cursor/ci-autofix-automation-24a2
  cursor/ci-autofix-automation-36be
  cursor/ci-autofix-automation-4505
  cursor/ci-autofix-automation-609e
  cursor/ci-autofix-automation-709e
  cursor/ci-autofix-automation-8647
  cursor/ci-autofix-automation-96e5
  cursor/ci-autofix-automation-99be
  cursor/ci-autofix-automation-9e7c
  cursor/ci-autofix-automation-a0f8
  cursor/ci-autofix-automation-b1b2
  cursor/ci-autofix-automation-b9dc
  cursor/ci-autofix-automation-c494
  cursor/ci-autofix-automation-ceab
  cursor/ci-autofix-automation-d494
  cursor/ci-autofix-automation-db24
  cursor/ci-autofix-automation-dd2a
  cursor/ci-autofix-automation-dd48
  cursor/ci-autofix-automation-dfa4
  cursor/ci-autofix-automation-f88c
  feat/add-rate-limiting
  feat/comics-papers-routes
  feat/content-type-types
  feat/hero-depth-layer
  feat/library-dropdown-nav
  feat/mobile-nav
  feat/retailer-urls
  feat/task-1.3-add-content-type
  fix/ENV-upstash-secret-sync
  fix/P0.1-lockfile-upstash-deps
  fix/P1-launch-hardening
  fix/ci-esm-and-deploy-workflow
  fix/distributed-rate-limiting
  fix/lint-unused-passthrough
)

for b in "${BRANCHES[@]}"; do
  echo "Deleting origin/$b ..."
  git push origin --delete "$b" || echo "  (skip — already gone or protected)"
done
```

### 5.2 Local Branch Cleanup

```bash
git fetch origin --prune
git checkout main && git pull origin main

# Re-use BRANCHES array from §5.1
for b in "${BRANCHES[@]}"; do
  git branch -D "$b" 2>/dev/null || true
done
```

### 5.3 Merge Near-Ready PR (manual, after Vercel quota resets)

```bash
# Release 1.0.1 — only after Vercel checks pass
gh pr merge 241 --squash --delete-branch

# MongoDB scaffold — only after rebase + CI green
# gh pr checkout 234
# git fetch origin main && git rebase origin/main
# git push --force-with-lease
# gh pr merge 234 --squash --delete-branch
```

---

_Generated by repository-health-sweep automation — 2026-07-18T19:20 UTC_
