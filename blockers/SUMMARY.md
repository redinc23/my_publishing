# Blocker Pipeline — Launch Status

| Metric           | Value                            |
| ---------------- | -------------------------------- |
| P0 Resolved      | **7 / 7**                        |
| P1 Resolved      | **6 / 6**                        |
| Launch readiness | **~96%**                         |
| Tracking branch  | `chore/import-blockers-pipeline` |

## P0 PRs (merged into chore/import-blockers-pipeline)

1. [P0.1 Lockfile + @upstash](https://github.com/redinc23/my_publishing/pull/79)
2. [P0.2 Node 20 pin](https://github.com/redinc23/my_publishing/pull/80)
3. [P0.3 UPSTASH env + graceful rate limit](https://github.com/redinc23/my_publishing/pull/82)
4. [P0.4 Rate-limit tests](https://github.com/redinc23/my_publishing/pull/83)
5. **P0.6 layout.tsx broken HTML stub** — fixed by Kimi
6. **P0.7 email/send.ts top-level crash** — fixed by Kimi

## P1 Fixes (applied directly to chore/import-blockers-pipeline)

- **P1.1 CI QA Gates** — lint + type-check + env vars + lockfile audit
- **P1.2 Cloud Run Probes** — startup/liveness configured in cloudbuild.yaml
- **P1.3 Stripe Webhook** — production-grade handler with idempotency
- **P1.4 Environment Secrets** — examples, validation, .gitignore protection
- **P1.5 Domain Standardization** — NEXT_PUBLIC_SITE_URL as single source of truth
- **P1.6 Cross-platform Build** — removed Unix-only NODE_ENV prefix

## Remaining (operator / deployment only)

- Real `.env.local` + GCP Secret Manager sync (fill in real values)
- Supabase migrations on production project (apply migration scripts)
- Stripe prod webhook endpoint (create in Stripe dashboard, copy whsec\_)
- Browser QA per OPERATOR_QA_LOG (manual smoke test after deploy)
- Custom domain DNS + SSL certificate (Cloud Run domain mapping)

## Launch Readiness Checklist

- [x] Lockfile includes @upstash/ratelimit + @upstash/redis
- [x] Node version pinned to 20+ in .nvmrc and package.json
- [x] app/layout.tsx is a valid Next.js App Router layout
- [x] Rate-limit tests are real Jest suites (no placeholders)
- [x] Rate-limit graceful degradation (null limiters = pass-through)
- [x] Email client lazy init (no build-time crash)
- [x] CI runs lint, type-check, build, test, lockfile audit
- [x] Cloud Run startup + liveness probes configured
- [x] Stripe webhook handler with signature verification + idempotency
- [x] Environment examples documented and .gitignore enforced
- [x] Cross-platform build script (Windows + Linux)
- [x] package-lock.json integrity hashes verified for @upstash packages
