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
