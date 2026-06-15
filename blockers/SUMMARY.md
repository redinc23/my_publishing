# Blocker Pipeline — Launch Status

| Metric | Value |
|--------|-------|
| P0 Resolved | **5 / 5** |
| Launch readiness | **~72%** |
| Tracking branch | `chore/import-blockers-pipeline` |

## P0 PRs (draft, merge in order)

1. [P0.1 Lockfile + @upstash](https://github.com/redinc23/my_publishing/pull/79)
2. [P0.2 Node 20 pin](https://github.com/redinc23/my_publishing/pull/80)
3. [P0.3 UPSTASH env + graceful rate limit](https://github.com/redinc23/my_publishing/pull/82)
4. [P0.4 Rate-limit tests](https://github.com/redinc23/my_publishing/pull/83)

## Remaining (operator / P1)

- Real `.env.local` + GCP Secret Manager sync
- Supabase migrations on production project
- Stripe prod webhook endpoint
- Browser QA per OPERATOR_QA_LOG
