# 09. Appendices

Source baseline: `docs/phase2/_sources/litstream_phase2_sec08.md`

## Appendix A: Environment Variable Reference

Complete classification (consolidated from `litstream_phase2_sec08.md`). Client-bound vars **must** use the `NEXT_PUBLIC_` prefix so only non-secrets are inlined into the browser bundle.

| Variable                             | NEXT_PUBLIC prefix? | Source                         | Used by                                 | Required? | Notes                                   |
| ------------------------------------ | ------------------- | ------------------------------ | --------------------------------------- | --------- | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | Yes                 | `.env.local` / Cloud Build env | Client JS, server components            | Required  | Public Supabase project URL             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Yes                 | `.env.local` / Cloud Build env | Client JS, server components            | Required  | Public anon key for client-side queries |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes                 | `.env.local` / Cloud Build env | Client JS                               | Required  | Stripe publishable key for checkout     |
| `NEXT_PUBLIC_SITE_URL`               | Yes                 | `.env.local` / Cloud Build env | Sitemap, SEO meta                       | Required  | Canonical site URL                      |
| `NEXT_PUBLIC_APP_VERSION`            | Yes                 | Cloud Build (`SHORT_SHA`)      | Client, Sentry release                  | Required  | Set in CI                               |
| `SUPABASE_SERVICE_ROLE_KEY`          | **No**              | Secret Manager → runtime only  | Server-side API routes / server actions | Required  | Never `NEXT_PUBLIC_` prefixed           |
| `STRIPE_SECRET_KEY`                  | **No**              | Secret Manager → runtime only  | Server-side API routes / server actions | Required  | Never `NEXT_PUBLIC_` prefixed           |
| `RESEND_API_KEY`                     | **No**              | Secret Manager → runtime only  | Server-side API routes / server actions | Required  | Never `NEXT_PUBLIC_` prefixed           |
| `PORT`                               | No                  | Cloud Run / Next.js standalone | Node.js server                          | Auto      | Do not set manually                     |

**Security boundary.** `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `RESEND_API_KEY` must be injected via `secretEnv` or Google Secret Manager at Cloud Run deploy time only. They must never be present in the Docker build context, build-time environment, or client bundle. `NEXT_PUBLIC_*` variables are safe for the client because they contain only public credentials.

## Appendix B: Content Model Reference

Core document domains:

- books
- authors
- categories

Key behavior:

- Data fetching for routes uses Supabase queries at build time or request time (SSR/ISR).
- Next.js generates page shells via `getStaticProps`, `getServerSideProps`, or App Router data fetching depending on the route strategy.

## Appendix C: Cloud Build Step Categories

| Category        | Purpose                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| setup           | install dependencies and prep build context                                      |
| build           | Next.js compile (`npm run build`) producing `.next/standalone/`                  |
| security gates  | bundle secret scan; vulnerability scan **after** image push to Artifact Registry |
| artifact/deploy | image build/push and Cloud Run deployment with runtime secrets                   |

## Appendix D: File Inventory (Documentation Package)

- `docs/phase2/README.md`
- `docs/phase2/01-executive-summary.md`
- `docs/phase2/02-business-requirements.md`
- `docs/phase2/03-functional-requirements.md`
- `docs/phase2/04-architecture-decisions.md`
- `docs/phase2/05-milestone-implementation-plan.md`
- `docs/phase2/06-acceptance-and-test-protocol.md`
- `docs/phase2/07-operational-runbook.md`
- `docs/phase2/08-risk-and-troubleshooting.md`
- `docs/phase2/09-appendices.md`
- `docs/phase2/10-agent-execution-playbook.md`
- `docs/phase2/11-handoff-master-checklist.md`
- `docs/phase2/12-ownership-raci.md`
- `docs/phase2/13-cutover-day-runbook.md`
- `docs/phase2/14-evidence-and-signoff-log.md`
- `docs/phase2/15-onboarding-quickstart.md`
- `docs/phase2/change-log-and-decisions.md`

## Appendix E: Estimated Effort Framework

Use this planning baseline for implementation staffing:

- M1-M2: high engineering concentration (security and build pipeline).
- M3-M5: platform + CI/CD concentration.
- M6: domain, DNS, and launch validation concentration.
- M7a-M7b: pre-cutover guardrails then post-cutover stabilization.

Adjust actual estimates by team maturity, cloud readiness, and existing pipeline quality.

## Appendix F: Repository And Drive File Inventory

### F.1 Repository targets (typical Drive → repo)

| Artifact                       | Milestone | Repo destination                      |
| ------------------------------ | --------- | ------------------------------------- |
| `cloudbuild.yaml`              | M5        | Repo root                             |
| `Dockerfile`                   | M3        | Repo root                             |
| `next.config.js`               | M3        | Repo root                             |
| `firebase.json`                | M6        | Repo root                             |
| `artifact-cleanup-policy.json` | M4        | Repo root                             |
| `prune-cloud-run-tags.sh`      | M7b       | `scripts/ops/prune-cloud-run-tags.sh` |

### F.2 Drive download checklist

Verify downloaded MIME types and checksums; align filenames with the table above.

## Appendix G: Critical Path Analysis

Blocking chain: **M1 → M2 → M3 → M5 → M6**. **M4** may run in parallel with M2/M3 until CI requires registry and secrets. **M7a** is pre-cutover; **M7b** is post-cutover steady-state. Skipping gates produces ambiguous failures.

The build pipeline hard gate is a successful `.next/standalone/` artifact with a passing bundle secret scan before any container image is produced.

## Appendix H: Daily Work Log Template

Each session: milestone, branch, stopping point, session goal, completed checklist, what worked / broke, open questions, next-session first action, docs touched, commit SHAs. Store under `logs/`. Extended rationale: `_sources/litstream_phase2_sec08.md` §8.6.
