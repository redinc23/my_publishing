# Repository Health Sweep — 2026-07-19 (PR #263 trigger)

**Repository:** `redinc23/my_publishing`  
**Sweep trigger:** PR #263 opened @ 2026-07-19T02:14 UTC  
**Base branch:** `main` @ `72c36e1`  
**Stack:** Next.js · Supabase · Stripe · Vercel

---

## Executive Summary

| Metric                                               | Value                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Open PRs                                             | **11** (6 non-draft, 5 draft)                                      |
| Merge conflicts with `main`                          | **4 PRs** — see §1.1                                               |
| Merge-ready (GHA green + no conflicts + non-draft)   | **#249** (Release Please 1.0.2)                                    |
| Draft PRs with green GHA (needs mark-ready + review) | **#258** (best CI autofix pick), #253, #255, #259                  |
| Recently merged during sweep                         | **#261** (`chore/repo-detox`) @ `1e87ad2`                          |
| Vercel deployment checks                             | **FAILING repo-wide** — build rate limit (external, not code)      |
| Remote branch cleanup candidates                     | **~75** (20 merged + 34 orphan autofix + 11 stale unmerged + misc) |

> **Note:** No CI check named "Development environment setup" exists in this repo. Closest equivalents: **CI** (`ci.yml`), **Format Check**, **Playwright E2E Tests**, **Lighthouse CI**, and **Copilot Setup Steps** (`.github/workflows/copilot-setup-steps.yml`).

---

## 1. Open PR Triage

### 1.1 Merge Conflicts (⚠️ WARNING)

Detected via local `git merge --no-commit --no-ff` against `origin/main` @ `72c36e1`:

| PR                                                         | Branch                                | Conflicting Files                              |
| ---------------------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| [#254](https://github.com/redinc23/my_publishing/pull/254) | `fix/changelog-prettier`              | `CHANGELOG.md`                                 |
| [#248](https://github.com/redinc23/my_publishing/pull/248) | `cursor/phoenix-recon-deep-dive-95d8` | `HUMAN_TASKS.md`                               |
| [#234](https://github.com/redinc23/my_publishing/pull/234) | `cursor/mongodb-scaffold-dffa`        | `app/api/health/route.ts`, `package-lock.json` |
| [#142](https://github.com/redinc23/my_publishing/pull/142) | `cursor/copilot-cli-integration-3cae` | `.github/workflows/copilot-setup-steps.yml`    |

**Clean merge (7 PRs):** #263, #262, #259, #258, #255, #253, #249

### 1.2 CI Status by PR

| PR                                                         | Title                               | Draft | Merge           | GHA | Blockers                                                                  |
| ---------------------------------------------------------- | ----------------------------------- | ----- | --------------- | --- | ------------------------------------------------------------------------- |
| [#263](https://github.com/redinc23/my_publishing/pull/263) | Genre counts Phase 10 **(trigger)** | ❌    | ✅ Clean        | ❌  | `format` (tests/unit/genre-counts.test.ts), `CI test` pending/in-progress |
| [#262](https://github.com/redinc23/my_publishing/pull/262) | Health sweep report (PR #252)       | ✅    | ✅ Clean        | ⏳  | Playwright E2E in progress                                                |
| [#259](https://github.com/redinc23/my_publishing/pull/259) | CI autofix (Cloud Build anon key)   | ✅    | ✅ Clean        | ✅  | Duplicate of #258 — close                                                 |
| [#258](https://github.com/redinc23/my_publishing/pull/258) | CI autofix (Cloud Build anon key)   | ✅    | ✅ Clean        | ✅  | **Best autofix pick** — mark ready if still needed                        |
| [#255](https://github.com/redinc23/my_publishing/pull/255) | CI autofix (Supabase anon default)  | ✅    | ✅ Clean        | ✅  | Superseded by #258 — close                                                |
| [#254](https://github.com/redinc23/my_publishing/pull/254) | CHANGELOG Prettier                  | ❌    | ⚠️ **Conflict** | ✅  | Superseded by merged #261 — **close**                                     |
| [#253](https://github.com/redinc23/my_publishing/pull/253) | CI autofix (Cloud Build anon key)   | ✅    | ✅ Clean        | ✅  | Duplicate — close                                                         |
| [#249](https://github.com/redinc23/my_publishing/pull/249) | Release Please 1.0.2                | ❌    | ✅ Clean        | ✅  | **Merge-ready** (no GHA failures)                                         |
| [#248](https://github.com/redinc23/my_publishing/pull/248) | Phoenix recon deep-dive             | ✅    | ⚠️ **Conflict** | ❌  | CI/format/lighthouse/e2e failing + conflict                               |
| [#234](https://github.com/redinc23/my_publishing/pull/234) | MongoDB Atlas scaffold              | ❌    | ⚠️ **Conflict** | ✅  | Rebase required before merge                                              |
| [#142](https://github.com/redinc23/my_publishing/pull/142) | Copilot CLI integration             | ❌    | ⚠️ **Conflict** | ❌  | Stale (10 days) — close or rebase                                         |

**Vercel checks:** All open PRs show `Vercel – my_publishing` / `Vercel – manguprojectz` **FAILURE** with message _"Deployment rate limited — retry in 24 hours."_ This is a Vercel plan quota issue, not a code defect.

---

## 2. Merge-Ready Work

### 2.1 Ready to Merge Now ✅

| PR                                                         | Branch                                                         | Why ready                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| [#249](https://github.com/redinc23/my_publishing/pull/249) | `release-please--branches--main--components--mangu-publishers` | Non-draft, clean merge, all GitHub Actions green |

### 2.2 Ready After Trivial Fix ⏳

| PR                                                         | Branch                     | Fix needed                                                                              |
| ---------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| [#263](https://github.com/redinc23/my_publishing/pull/263) | `fix/genre-counts-phase10` | Run `npx prettier --write tests/unit/genre-counts.test.ts`; verify CI + Playwright pass |

### 2.3 Draft — Green CI, Needs Mark-Ready

| PR                                                         | Branch                              | Recommendation                                                                            |
| ---------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| [#258](https://github.com/redinc23/my_publishing/pull/258) | `cursor/ci-autofix-automation-b64b` | Mark ready if Cloud Build anon-key fix still needed; close #253, #255, #259 as duplicates |

### 2.4 Close / Supersede (Do Not Merge)

| PR               | Reason                                                                    |
| ---------------- | ------------------------------------------------------------------------- |
| #254             | CHANGELOG formatting landed via merged #261                               |
| #253, #255, #259 | Duplicate CI autofix attempts; keep #258 only                             |
| #142             | 10-day-old stale branch; conflicts in copilot workflow                    |
| #248             | Failing CI + HUMAN_TASKS.md conflict; rebase after Phoenix doc stabilizes |

---

## 3. Dead Code & Branch Hygiene

### 3.1 Remote Branch Inventory

| Category                                             | Count | Action               |
| ---------------------------------------------------- | ----: | -------------------- |
| Total remote branches                                |   113 | —                    |
| Merged into `main`, not deleted                      |    20 | Safe to delete       |
| Orphan `cursor/ci-autofix-automation-*` (no open PR) |    34 | Safe to delete       |
| Stale unmerged (>30 days, no open PR)                |    11 | Review then delete   |
| Open PR head branches                                |    11 | Keep until PR closed |

### 3.2 Merged Branches Pending Deletion (20)

```
claude/mangu-phase-1-authority-sv2hyn
copilot/aggressive-performance-scalability-overhaul
copilot/enhance
copilot/enhance-core-features-auth-profile
copilot/featadmin-content-type
copilot/featmobile-nav
copilot/plz-run-this-and-see-if-working
copilot/setup-ci-cd-tooling
env-automation-v2
env-master-automation
feat/add-rate-limiting
feat/mobile-nav
fix/distributed-rate-limiting
fix/ENV-upstash-secret-sync
fix/P0.1-lockfile-upstash-deps
fix/P0.2-node-version
fix/P0.3-upstash-env
fix/P0.4-rate-limit-tests
fix/P1-launch-hardening
```

**Squash-merged PR branches** (not in `git branch --merged` but safe to delete after merge):

```
chore/repo-detox   # merged via #261
```

### 3.3 Stale Unmerged Branches (>30 days, no open PR)

```
enhanced-ci-workflow-8017118246652943162
feat-parallelize-stats-fetching-14978014903356121747
feature-analytics-growth-rate-13351340939507986598
jules/file-hashing-deduplication-12685668244175777573
jules-launch-readiness-10563070484880350534
perf-analytics-parallelization-932205919193246865
feat/frontend-improvements
feat/improved-k6-load-test
feat/k6-load-test-final
fix/critical-build-blockers
fix/production-audit-findings-1-8
```

---

## 4. Actionable Scripts (Manual — Review Before Running)

### 4.1 Merge Ready PR

```bash
cd my_publishing
git checkout main && git pull origin main

# Release Please 1.0.2 — GHA green, clean merge
gh pr merge 249 --merge --delete-branch
```

### 4.2 Close Superseded / Stale PRs

```bash
gh pr close 254 --comment "Superseded by merged #261 (CHANGELOG prettierignore)."
gh pr close 253 --comment "Duplicate CI autofix; keeping #258."
gh pr close 255 --comment "Duplicate CI autofix; keeping #258."
gh pr close 259 --comment "Duplicate CI autofix; keeping #258."
# Optional — stale 10-day Copilot integration with conflicts:
# gh pr close 142 --comment "Stale; conflicts in copilot-setup-steps.yml."
```

### 4.3 Delete Merged Remote Branches

```bash
git fetch origin --prune
for b in \
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
  fix/distributed-rate-limiting \
  fix/ENV-upstash-secret-sync \
  fix/P0.1-lockfile-upstash-deps \
  fix/P0.2-node-version \
  fix/P0.3-upstash-env \
  fix/P0.4-rate-limit-tests \
  fix/P1-launch-hardening
do
  git push origin --delete "$b" 2>/dev/null && echo "deleted origin/$b" || echo "skip origin/$b"
done

# Squash-merged PR branches
git push origin --delete chore/repo-detox 2>/dev/null && echo "deleted origin/chore/repo-detox" || echo "skip origin/chore/repo-detox"
```

### 4.4 Delete Orphan CI-Autofix Branches (34)

```bash
git fetch origin --prune
for b in \
  cursor/ci-autofix-automation-0017 cursor/ci-autofix-automation-09f1 \
  cursor/ci-autofix-automation-1378 cursor/ci-autofix-automation-1427 \
  cursor/ci-autofix-automation-197b cursor/ci-autofix-automation-1c1d \
  cursor/ci-autofix-automation-24a2 cursor/ci-autofix-automation-2529 \
  cursor/ci-autofix-automation-2797 cursor/ci-autofix-automation-36be \
  cursor/ci-autofix-automation-4505 cursor/ci-autofix-automation-5300 \
  cursor/ci-autofix-automation-609e cursor/ci-autofix-automation-709e \
  cursor/ci-autofix-automation-8647 cursor/ci-autofix-automation-96e5 \
  cursor/ci-autofix-automation-99be cursor/ci-autofix-automation-9e07 \
  cursor/ci-autofix-automation-9e7c cursor/ci-autofix-automation-a0f8 \
  cursor/ci-autofix-automation-ad57 cursor/ci-autofix-automation-b1b2 \
  cursor/ci-autofix-automation-b9dc cursor/ci-autofix-automation-c494 \
  cursor/ci-autofix-automation-ceab cursor/ci-autofix-automation-d2bd \
  cursor/ci-autofix-automation-d494 cursor/ci-autofix-automation-db24 \
  cursor/ci-autofix-automation-dd2a cursor/ci-autofix-automation-dd48 \
  cursor/ci-autofix-automation-dfa4 cursor/ci-autofix-automation-f6dc \
  cursor/ci-autofix-automation-f88c cursor/ci-autofix-automation-fc78
do
  git push origin --delete "$b" 2>/dev/null && echo "deleted origin/$b" || echo "skip origin/$b"
done
```

### 4.4 Delete Orphan CI-Autofix Branches (34)

```bash
git fetch origin --prune
for b in \
  cursor/ci-autofix-automation-0017 cursor/ci-autofix-automation-09f1 \
  cursor/ci-autofix-automation-1378 cursor/ci-autofix-automation-1427 \
  cursor/ci-autofix-automation-197b cursor/ci-autofix-automation-1c1d \
  cursor/ci-autofix-automation-24a2 cursor/ci-autofix-automation-2529 \
  cursor/ci-autofix-automation-2797 cursor/ci-autofix-automation-36be \
  cursor/ci-autofix-automation-4505 cursor/ci-autofix-automation-5300 \
  cursor/ci-autofix-automation-609e cursor/ci-autofix-automation-709e \
  cursor/ci-autofix-automation-8647 cursor/ci-autofix-automation-96e5 \
  cursor/ci-autofix-automation-99be cursor/ci-autofix-automation-9e07 \
  cursor/ci-autofix-automation-9e7c cursor/ci-autofix-automation-a0f8 \
  cursor/ci-autofix-automation-ad57 cursor/ci-autofix-automation-b1b2 \
  cursor/ci-autofix-automation-b9dc cursor/ci-autofix-automation-c494 \
  cursor/ci-autofix-automation-ceab cursor/ci-autofix-automation-d2bd \
  cursor/ci-autofix-automation-d494 cursor/ci-autofix-automation-db24 \
  cursor/ci-autofix-automation-dd2a cursor/ci-autofix-automation-dd48 \
  cursor/ci-autofix-automation-dfa4 cursor/ci-autofix-automation-f6dc \
  cursor/ci-autofix-automation-f88c cursor/ci-autofix-automation-fc78
do
  git push origin --delete "$b" 2>/dev/null && echo "deleted origin/$b" || echo "skip origin/$b"
done
```

### 4.5 Delete Stale Unmerged Branches (>30 days — verify first)

```bash
git fetch origin --prune
for b in \
  enhanced-ci-workflow-8017118246652943162 \
  feat-parallelize-stats-fetching-14978014903356121747 \
  feature-analytics-growth-rate-13351340939507986598 \
  jules/file-hashing-deduplication-12685668244175777573 \
  jules-launch-readiness-10563070484880350534 \
  perf-analytics-parallelization-932205919193246865 \
  feat/frontend-improvements \
  feat/improved-k6-load-test \
  feat/k6-load-test-final \
  fix/critical-build-blockers \
  fix/production-audit-findings-1-8
do
  git push origin --delete "$b" 2>/dev/null && echo "deleted origin/$b" || echo "skip origin/$b"
done
```

### 4.6 Local Branch Cleanup

```bash
git checkout main && git pull origin main
git remote prune origin
git branch -vv | grep ': gone]' | awk '{print $1}' | xargs -r git branch -D
```

---

## 5. Trigger PR (#263) Assessment

**Scope:** `components/home/GenreExplorer.tsx`, `lib/supabase/genre-counts.ts`, `tests/unit/genre-counts.test.ts`

| Check           | Status                                              |
| --------------- | --------------------------------------------------- |
| Merge conflicts | ✅ None                                             |
| Format Check    | ❌ `tests/unit/genre-counts.test.ts` needs Prettier |
| CI unit tests   | ❌ Failed (same PR run)                             |
| Playwright E2E  | ⏳ In progress at sweep time                        |
| Vercel preview  | ❌ Rate limited (external)                          |

**Recommendation:** Fix Prettier on the test file, push, wait for GHA green, then merge. Do not block on Vercel rate limit unless branch protection requires it.

---

_Generated by Cursor repository-health-sweep automation @ 2026-07-19T02:14 UTC_
