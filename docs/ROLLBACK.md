# PERF PHASE 2 — Rollback Guide

## Quick Rollback (any task)

```bash
# Find the commit to revert
git log --oneline -10

# Revert the specific perf commit
git revert <commit-sha>

# Verify
npm run lint && npm run test
npm run build

# Deploy
git push origin main
```

## Per-Task Rollback

### Tasks 1+2: Streaming + Cached Queries
```bash
git revert <commit-sha-for-tasks-1-2>
```
**Verify:** Visit /books, /comics, /papers — pages should load without Suspense streaming.

### Task 3: Parallelize Dashboard Waterfalls
```bash
git revert <commit-sha-for-task-3>
```
**Verify:** Author dashboard loads (sequential fetches restored).

### Task 4: Analytics Dynamic Chart Islands
```bash
git revert <commit-sha-for-task-4>
```
**Verify:** Analytics page at /dashboard/books/[id]/analytics still renders charts.

### Task 5: Server Components (Landing/Nav)
```bash
git revert <commit-sha-for-task-5>
```
**Verify:** Landing page renders CTA, Stats, Features sections. Check for hydration errors.

### Task 6: Reading Route Server-First
```bash
git revert <commit-sha-for-task-6>
```
**Verify:** /reading/[bookId] loads, progress saves, back button works.

### Task 7: Resonance Cache
```bash
git revert <commit-sha-for-task-7>
```
**Verify:** /api/resonance/recommend returns results, /api/resonance/embed updates vectors.

### Task 8: Bundle Analyzer + CI Budget
```bash
git revert <commit-sha-for-task-8>
```
**Verify:** `npm run build` succeeds without analyzer, CI pipeline passes.

### Task 9: Config Tightening
```bash
git revert <commit-sha-for-task-9>
```
**Verify:** Server actions with large payloads (uploads) work again with 50mb limit.

### Task 10: Smoke Tests + Rollback Docs
```bash
git revert <commit-sha-for-task-10>
```
**Verify:** Existing test suite still passes.

## Emergency: Revert All Perf Phase 2

```bash
# Find the commit before perf phase 2 started
git log --oneline --all | head -20

# Reset to pre-perf state
git revert --no-commit <oldest-perf-commit>..<latest-perf-commit>
git commit -m "revert: roll back all PERF PHASE 2 changes"
npm run lint && npm run test
git push origin main
```
