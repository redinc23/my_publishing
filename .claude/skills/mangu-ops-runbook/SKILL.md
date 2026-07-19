---
name: mangu-ops-runbook
description: This skill should be used when the user asks about production incidents, Sev1/Sev2, health checks, /api/health, rollback, degraded service, Vercel deploy failures, Atlas connectivity, rate-limit false positives, or on-call triage for Mangu Publishers.
version: 1.0.0
---

# Mangu Ops Runbook

Post-Phoenix hosting target is **Vercel** (Edge + Serverless). Legacy Cloud Run stays on
standby for 48h after DNS cutover only. Prefer Vercel/Atlas/Upstash triage paths below;
use GCP paths only during rollback window.

## Severity

| Sev | Definition                                   | Initial response | Update cadence |
| --- | -------------------------------------------- | ---------------- | -------------- |
| 1   | Prod unavailable or security compromise risk | 10 min           | 15 min         |
| 2   | Major degradation with user impact           | 20 min           | 30 min         |
| 3   | Partial / internal                           | 60 min           | 2 hr           |

Escalate Sev1/Sev2 to Platform; Security Lead on suspected secret/security events.
Business owner for Sev1 or rollback decisions.

## First probes (always)

```bash
# Production
curl -fsS "https://www.mangu-publishers.com/api/health?ready=1" | jq .
# Local
curl -fsS "http://localhost:3000/api/health?ready=1" | jq .
```

Expect `{"ready":true}` with healthy sub-statuses (Mongo, auth config, Stripe key format,
Upstash + Blob presence — see WS4 Task 4.1).

Use `scripts/health-probe.sh` when available.

## Triage trees

### Build failing (CI / Vercel)

1. Identify failing commit + workflow / deployment.
2. Check lint, `tsc`, Jest, Playwright, env validation.
3. Secret audit / vulnerability gate failures → treat as security until disproven.
4. Fix forward; do not bypass gates without Security + Engineering Lead exception recorded.

### Runtime degraded

1. Health ready probe.
2. Vercel runtime logs + Sentry newest issues.
3. Atlas: paused cluster? IP allowlist? connection string?
4. Upstash: 429 storms? Redis down?
5. Stripe: webhook failures / signature mismatches?
6. Blob: 401 on `BLOB_READ_WRITE_TOKEN`?

### Auth / session

- Cookie not persisting → `BETTER_AUTH_URL` / site URL mismatch.
- Legacy user cannot sign in → **expected** until forced reset completes.
- Reset email missing → Resend domain + spam; re-trigger forgot-password (human may need Resend dashboard).

### Rollback

Read `references/rollback-decision-tree.md` and Phoenix §8.2–8.3.
DNS / Cloudflare / Cloud Run scale → **HUMAN GATE**. Agent prepares commands, evidence, and
`export-delta.ts` support; does not execute irreversible cutover/rollback without instruction.

## Human-only

See `references/human-gates.md` and root `HUMAN_TASKS.md`. Never fabricate tokens.

## References

- `references/sla-matrix.md`
- `references/rollback-decision-tree.md`
- `references/human-gates.md`
- Scripts: `scripts/health-probe.sh`, `scripts/vercel-status.sh`
