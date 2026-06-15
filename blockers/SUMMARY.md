# Blocker Pipeline — Launch Status

| Metric | Value |
|--------|-------|
| P0 Resolved | **5 / 5** |
| P1 Resolved | **7 / 7** |
| Engineering readiness | **88%** |
| Tracking branch | `chore/import-blockers-pipeline` |

## Score breakdown

| Component | Weight | Score |
|-----------|--------|-------|
| P0 automation | 60% | 60% (5/5) |
| P1 automation | 30% | 30% (7/7) |
| Full build green | 10% | 10% |
| **Total (engineering)** | | **88%** |

Operator steps (not automatable): real `.env.local`, GCP auth, prod migrations, browser QA.

## Draft PRs (merge in order)

| PR | Blocker |
|----|---------|
| [#79](https://github.com/redinc23/my_publishing/pull/79) | P0.1 Lockfile + @upstash |
| [#80](https://github.com/redinc23/my_publishing/pull/80) | P0.2 Node 20 |
| [#82](https://github.com/redinc23/my_publishing/pull/82) | P0.3 UPSTASH env |
| [#83](https://github.com/redinc23/my_publishing/pull/83) | P0.4 Rate-limit tests |
| [#84](https://github.com/redinc23/my_publishing/pull/84) | ENV + QA |
| [#85](https://github.com/redinc23/my_publishing/pull/85) | INF/DB/SEC |

## Verify locally

```bash
bash blockers/fix-all.sh
# or
bash scripts/launch-readiness.sh
```
# Blocker Pipeline — 100% Engineering Launch Ready

| Metric | Value |
|--------|-------|
| P0 Resolved | **6 / 6** |
| P1 Resolved | **8 / 8** |
| Engineering readiness | **100%** |
| Merged to main | **2026-06-15** (PR #87, commit `dfbf790`) |
| Operator steps | 4 manual (secrets, GCP, DB, QA) |

## Consolidated fix (replaces stacked PRs #79–#85)

This branch merges the full blocker fix stack and **repairs `main`** after PR #86 corrupted `package.json`.

| Area | Status |
|------|--------|
| Lockfile + @upstash | Resolved |
| Node 20 pin | Resolved |
| UPSTASH env + Cloud Run secrets | Resolved |
| Rate-limit tests | Resolved |
| ENV/INF/DB/SEC/QA scripts | Resolved |
| Operator docs | Resolved |

## Verify

```bash
bash scripts/launch-readiness.sh
bash blockers/fix-all.sh
```

## Operator-only (cannot automate)

1. `cp .env.local.example .env.local` — fill real values
2. `gcloud auth login` + `./scripts/sync-gcp-secrets-from-env.sh`
3. `./scripts/bundle-migrations.sh` → Supabase SQL Editor
4. Stripe webhook + browser QA per `docs/OPERATOR_QA_LOG.md`
