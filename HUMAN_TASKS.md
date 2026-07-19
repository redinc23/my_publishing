# HUMAN_TASKS — MANGU Publishers production remediation

Work items that genuinely require console access or token scopes the agent swarm
does not have. Everything else is being executed autonomously. Ordered by priority.

## Cowork control (do these first)

### C0.1 Disable Cursor storm automations — STILL REQUIRED (verified 2026-07-19)

Both are still **`enabled: true`** and still opening draft PRs:

| Automation                   | ID                                     | Action                                                                            |
| ---------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| Fix CI failures              | `094ce0ad-7ba5-11f1-ba66-0e7d0216e441` | **Disable** → https://cursor.com/automations/094ce0ad-7ba5-11f1-ba66-0e7d0216e441 |
| pr (Repository health sweep) | `ab582f50-7ba7-11f1-ba66-0e7d0216e441` | **Disable** → https://cursor.com/automations/ab582f50-7ba7-11f1-ba66-0e7d0216e441 |

Agents cannot toggle these via API (read-only). Close duplicate draft PRs after disable.

### C0.2 Create safe Phoenix cowork automation (after C0.1)

Dashboard → New automation → paste entire file:

`.cursor/automations/phoenix-next-slice.prompt.md`

Schedule suggestion: 2×/day UTC. Details: `docs/COWORK_OPERATOR.md`.

Optional second automation: `.cursor/automations/prod-health-triage.prompt.md` (manual / rare).

### C0.3 Path decision — LOCKED to Phoenix (B)

**Resolved:** Project Phoenix is the active mission (`CLAUDE.md`, skills merged via #252,
`docs/COWORK_OPERATOR.md`). Path A (stabilize-only / pause Phoenix) is **off** unless
this section is explicitly revised.

---

## P0 — security-critical

### H0.1 Rotate the production Supabase ANON key

A real production anon-key JWT (project `tkzvikozrcynhwsqtkqp`, minted 2026-05-13,
expires 2036) was hardcoded in `next.config.js` and `cloudbuild.yaml` since commit
`c748ee8` (2026-07-10). The swarm removed it from HEAD, but **it remains in git
history — rotation is the only complete fix.**

1. Supabase dashboard → Settings → API → rotate anon key.
2. Update: GitHub repo secrets, Vercel env (Production + Preview), Cloud Build
   trigger substitutions, local `.env.local` files.
3. Redeploy. Old-key invalidation can be verified by probing the REST API with it.

### H0.2 Disable the external Cursor "ci-autofix-automation"

Superseded / expanded by **C0.1** (both storm automations). Keep this item until
`enabled: false` is verified for id `094ce0ad-7ba5-11f1-ba66-0e7d0216e441`.

### H0.3 Verify GCP Secret Manager entries (before first hardened deploy run)

`cloudbuild.yaml` mounts these via `--set-secrets`:
`supabase-service-role-key`, `stripe-secret-key`, `stripe-webhook-secret`
(plus optional `resend-api-key`, `openai-api-key`, `upstash-redis-rest-url`,
`upstash-redis-rest-token`). Create any that are missing in the GCP project.

### H0.4 Apply the deploy.yml hardening manually (token scope gap)

The swarm's GitHub token lacks the `workflow` OAuth scope, so
`.github/workflows/*` edits could not be pushed by the swarm. Apply this change
to `.github/workflows/deploy.yml` by hand (or grant the token `workflow` scope
and ask the swarm to re-run the CI-hardening workstream):

- Move `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  out of plaintext `env_vars:` into a `secrets:` block:
  `SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest`,
  `STRIPE_SECRET_KEY=stripe-secret-key:latest`,
  `STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest`
  (same Secret Manager names already used by cloudbuild.yaml).
- Add top-level `permissions: { contents: read }`,
  `concurrency: { group: deploy-production-cloud-run, cancel-in-progress: false }`,
  and `environment: production` + `timeout-minutes: 30` on the deploy job.
  The full hardened workflow-file set (all 19 workflows: permissions, concurrency,
  timeouts, bug-to-issue loop guard, auto-merge label-gate, ci.yml service-role
  removal from PR jobs) is produced by the swarm's CI audit — request it when a
  workflow-scoped token is available.

Also: if `cowork-operator-guard.yml` fails to land due to the same scope gap, apply
from the cowork PR manually.

## P1 — release governance

### H1.1 Enable branch protection on `main`

Require the `test` and `format` status checks + 1 review. This single setting
prevents most of the damage class seen this week (broken Dependabot major merged
on red CI).

### H1.2 Decide Project Phoenix vs. current Supabase stack

**DONE — Path B (Phoenix).** See Cowork control C0.3. Legacy Supabase remains until
WS4/Phase 14 per Phoenix doc; agents must not pause Phoenix unless this is reopened.

### H1.3 Vercel environment audit

- `NEXT_PUBLIC_SITE_URL` must be `https://www.mangu-publishers.com` in Production
  (the old repo fallback pointed at a preview domain).
- Confirm Production + Preview env sets match `.env.production.example`.

## P2 — environment-limited (swarm sandbox)

### H2.1 Docker build + scan

No Docker daemon in the swarm environment. Dockerfile was hardened statically
(`.dockerignore`); run `docker build` + `trivy image` in CI or locally to close
Phase 8.

### H2.2 Playwright authenticated E2E against Preview

Needs real Supabase test user + Vercel preview URL secrets. Public smoke probes
were run by the swarm; authenticated flows need a dedicated non-admin test user
(see directive Task 5.7).
