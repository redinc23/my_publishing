# Repository Health Sweep — 2026-07-18

**Repository:** `redinc23/my_publishing`  
**Sweep trigger:** Cron automation @ 2026-07-18T13:01 UTC  
**Base branch:** `main` @ `f8ea4b4`

---

## Executive Summary

| Metric                                   | Value                                                         |
| ---------------------------------------- | ------------------------------------------------------------- |
| Open PRs                                 | **21** (10 ready, 11 draft)                                   |
| Merge conflicts with `main`              | **9 PRs**                                                     |
| Merge-ready (all CI green, no conflicts) | **0 non-draft PRs**                                           |
| `main` CI (`ci.yml`)                     | **PASSING** (last green: 2026-07-18 05:56 UTC, PR #233 merge) |
| Production Health Check                  | **FAILING** — missing Stripe env vars on Vercel Production    |
| Remote branch cleanup candidates         | **56**                                                        |

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
| [#232](https://github.com/redinc23/my_publishing/pull/232) | `cursor/ci-autofix-automation-ad57`   | `.github/workflows/health-check.yml`                                            |

**Clean merge (12 PRs):** #129, #133, #145, #152, #154, #155, #160, #167, #214, #215, #218, #234

### 1.2 CI Status by PR

| PR   | Title                            | Draft | Merge        | CI Failures                                             | Notes                         |
| ---- | -------------------------------- | ----- | ------------ | ------------------------------------------------------- | ----------------------------- |
| #234 | MongoDB Atlas scaffold (ADR-002) | ✅    | Clean        | Vercel – my_publishing                                  | Core CI green; draft          |
| #232 | Health-check DNS + bug-to-issue  | ❌    | **Conflict** | e2e                                                     | Superseded by merged #231     |
| #230 | bug-to-issue rebase npm fix      | ✅    | **Conflict** | e2e                                                     | Superseded by merged #219     |
| #228 | bug-to-issue working tree        | ❌    | **Conflict** | e2e                                                     | Superseded by merged #219     |
| #224 | MCP route helpers                | ✅    | **Conflict** | e2e                                                     | Superseded by merged #223     |
| #222 | MCP guard helpers                | ✅    | **Conflict** | —                                                       | Superseded by merged #223     |
| #220 | MCP guard helpers                | ✅    | **Conflict** | —                                                       | Superseded by merged #223     |
| #218 | Trivy false positives            | ✅    | Clean        | —                                                       | Superseded by merged #225     |
| #215 | Trivy false positives            | ✅    | Clean        | —                                                       | Superseded by merged #225     |
| #214 | Trivy false positives            | ✅    | Clean        | —                                                       | Superseded by merged #225     |
| #212 | format-check + vuln-scan         | ✅    | **Conflict** | —                                                       | Superseded; close             |
| #184 | Supabase migration reorder       | ✅    | **Conflict** | e2e, format, Playwright                                 | Needs rebase                  |
| #167 | bump openai 6.48.0               | ❌    | Clean        | CI, format, Playwright, Vercel                          | Dependabot — failing          |
| #160 | bump jest 30.4.2                 | ❌    | Clean        | CI, format, Playwright, Vercel                          | Dependabot — failing          |
| #155 | bump react-dom                   | ❌    | Clean        | CI, copilot-setup-steps, format, lighthouse, Playwright | Dependabot — failing          |
| #154 | bump tailwind-merge 3.6.0        | ❌    | Clean        | CI, e2e, Playwright                                     | Dependabot — failing          |
| #152 | bump react-day-picker 10.0.1     | ❌    | Clean        | auto-merge, CI, e2e, Playwright                         | Dependabot — failing          |
| #145 | release 1.0.0 (release-please)   | ❌    | Clean        | e2e                                                     | Block on production readiness |
| #142 | Copilot CLI integration          | ✅    | **Conflict** | Playwright                                              | Stale — close or rebase       |
| #133 | bump @types/node 26.1.1          | ❌    | Clean        | CI, format, Playwright, Vercel                          | Dependabot — failing          |
| #129 | bump deploy-cloudrun action v3   | ❌    | Clean        | CI, e2e, format, Playwright                             | Dependabot — failing          |

---

## 2. Merge-Ready Work

### 2.1 Recently Merged (last 24h) ✅

| PR                                                         | Title                                 | Merged               |
| ---------------------------------------------------------- | ------------------------------------- | -------------------- |
| [#233](https://github.com/redinc23/my_publishing/pull/233) | ADR-001 Option B — Vercel canonical   | 2026-07-18 05:56 UTC |
| [#231](https://github.com/redinc23/my_publishing/pull/231) | Health-check DNS split + bug-to-issue | 2026-07-18 05:14 UTC |
| [#229](https://github.com/redinc23/my_publishing/pull/229) | Phase 7 migration reconcile           | 2026-07-18 04:53 UTC |
| [#225](https://github.com/redinc23/my_publishing/pull/225) | vuln-scan + bug-to-issue race fix     | 2026-07-18 04:29 UTC |
| [#223](https://github.com/redinc23/my_publishing/pull/223) | MCP guard build fix                   | 2026-07-18 03:52 UTC |

Remote branches for #233/#231/etc. already deleted — good hygiene.

### 2.2 Candidates NOT Ready to Merge

**No non-draft PR is fully merge-ready today.**

- **#234** (MongoDB scaffold): Core CI passes (`CI`, `Format Check`, `Playwright E2E`, `Lighthouse CI`, `CodeQL`) but is **draft**, has **Vercel – my_publishing FAILURE**, and E2E against Preview is skipped. Not production-ready.
- **#218/#215/#214** (Trivy fixes): All CI green, no conflicts — but **superseded by merged #225**. Close, do not merge.
- **#145** (release 1.0.0): Clean merge but **e2e failing** and production health check red. Hold until Stripe/Supabase env vars configured on Vercel Production.
- **#232**: Non-draft but **conflicts** with main and **superseded by #231**. Close.

### 2.3 Main Branch CI

| Workflow                                               | Status                        | Last Run             |
| ------------------------------------------------------ | ----------------------------- | -------------------- |
| `ci.yml` (validate-env, type-check, lint, test, build) | ✅ SUCCESS                    | 2026-07-18 05:56 UTC |
| `health-check.yml` (Production Health Check)           | ❌ FAILURE                    | 2026-07-18 12:34 UTC |
| `Copilot Setup Steps`                                  | ✅ (on PRs touching workflow) | Per-PR               |

**Health check root cause:** `/api/health?ready=1` returns HTTP 503 — missing `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` on Vercel Production. Operator action required per `docs/CANONICAL_PRODUCTION.md`.

---

## 3. Dead Code & Stale Branches

### 3.1 Already Merged into `main` (19 branches)

These branches are fully contained in `main` and safe to delete:

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
fix/ENV-upstash-secret-sync
fix/P0.1-lockfile-upstash-deps
fix/P0.2-node-version
fix/P0.3-upstash-env
fix/P0.4-rate-limit-tests
fix/P1-launch-hardening
fix/distributed-rate-limiting
```

> `claude/mangu-phase-1-authority-sv2hyn` served 8 merged PRs (#210–#223). Delete after confirming no open work references it.

### 3.2 Orphan `cursor/ci-autofix-automation-*` (26 branches, no open PR)

Automation churn branches with no associated open PR — safe to delete.

### 3.3 Stale Unmerged (>30 days, no open PR) — 11 branches

| Branch                                                  | Last Commit |
| ------------------------------------------------------- | ----------- |
| `feat-parallelize-stats-fetching-14978014903356121747`  | 2026-01-20  |
| `feature-analytics-growth-rate-13351340939507986598`    | 2026-01-20  |
| `jules/file-hashing-deduplication-12685668244175777573` | 2026-01-20  |
| `perf-analytics-parallelization-932205919193246865`     | 2026-01-20  |
| `enhanced-ci-workflow-8017118246652943162`              | 2026-01-21  |
| `jules-launch-readiness-10563070484880350534`           | 2026-01-22  |
| `feat/frontend-improvements`                            | 2026-06-13  |
| `feat/improved-k6-load-test`                            | 2026-06-14  |
| `feat/k6-load-test-final`                               | 2026-06-14  |
| `fix/critical-build-blockers`                           | 2026-06-15  |
| `fix/production-audit-findings-1-8`                     | 2026-06-15  |

**Total cleanup candidates: 56 remote branches**

---

## 4. Recommended Actions

### 4.1 Close Superseded PRs (no merge needed)

```
gh pr close 212 --comment "Superseded by merged #225/#233"
gh pr close 214 --comment "Superseded by merged #225"
gh pr close 215 --comment "Superseded by merged #225"
gh pr close 218 --comment "Superseded by merged #225"
gh pr close 220 --comment "Superseded by merged #223"
gh pr close 222 --comment "Superseded by merged #223"
gh pr close 224 --comment "Superseded by merged #223"
gh pr close 228 --comment "Superseded by merged #219"
gh pr close 230 --comment "Superseded by merged #219"
gh pr close 232 --comment "Superseded by merged #231"
```

### 4.2 Close Failing Dependabot PRs (re-open fresh later)

```
gh pr close 129 133 152 154 155 160 167 --comment "Stale dependabot PR — CI failing on outdated base; will regenerate"
```

### 4.3 Merge Order (when ready)

1. Configure Stripe + Supabase env vars on Vercel Production → re-run health-check
2. **#234** — mark ready for review after Vercel preview green + E2E completes
3. **#145** — merge release 1.0.0 after main health-check green
4. Run branch cleanup script below

---

## 5. Copy-Paste Cleanup Scripts

### 5.1 Remote Branch Deletion (56 branches)

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch origin --prune

BRANCHES=(
  claude/mangu-phase-1-authority-sv2hyn
  copilot/aggressive-performance-scalability-overhaul
  copilot/enhance
  copilot/enhance-core-features-auth-profile
  copilot/featadmin-content-type
  copilot/featmobile-nav
  copilot/plz-run-this-and-see-if-working
  copilot/setup-ci-cd-tooling
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
  env-automation-v2
  env-master-automation
  feat/add-rate-limiting
  feat/mobile-nav
  fix/ENV-upstash-secret-sync
  fix/P0.1-lockfile-upstash-deps
  fix/P0.2-node-version
  fix/P0.3-upstash-env
  fix/P0.4-rate-limit-tests
  fix/P1-launch-hardening
  fix/distributed-rate-limiting
  enhanced-ci-workflow-8017118246652943162
  feat-parallelize-stats-fetching-14978014903356121747
  feat/frontend-improvements
  feat/improved-k6-load-test
  feat/k6-load-test-final
  feature-analytics-growth-rate-13351340939507986598
  fix/critical-build-blockers
  fix/production-audit-findings-1-8
  jules-launch-readiness-10563070484880350534
  jules/file-hashing-deduplication-12685668244175777573
  perf-analytics-parallelization-932205919193246865
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

for b in "${BRANCHES[@]}"; do
  git branch -D "$b" 2>/dev/null || true
done
```

> Replace `"${BRANCHES[@]}"` with the same array from §5.1, or source it from a shared file.

---

_Generated by repository-health-sweep automation — 2026-07-18T13:02 UTC_
