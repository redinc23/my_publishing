# 08. Risk Assessment And Troubleshooting

Source baseline: `docs/phase2/_sources/litstream_phase2_sec07.md`

## Operator Quick Paths

- Secret-related concern -> `R1`, `R8`, `R9`
- Cloud Run deployment rejection -> `R2`, `R10`
- CI push/deploy blockage -> `R3`, `R4`, `R5`, `R6`
- Content not updating -> `R7`
- API route failures in production -> `R11`

## Risk Register

| Risk ID | Risk                                                                                                                                 | Probability | Impact   | Primary Mitigation                                                                          | Risk Owner (Named)                                             | Status | Escalation Path                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- | -------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------ | --------------------------------- |
| R1      | Secret leak via `NEXT_PUBLIC_*` misuse (public vars containing secrets) or server secret exposed to client                           | Medium      | Critical | Enforced token naming + audit gate                                                          | Same person as **Security Lead Primary** (`12` Role Directory) | Open   | Security Lead -> Engineering Lead |
| R2      | Cloud Run deploy fails due to invalid memory config                                                                                  | High        | High     | Enforce `--memory=512Mi` (Next.js standalone may need additional headroom)                  | Same person as **Platform Engineer Primary** (`12`)            | Open   | Platform Lead -> Engineering Lead |
| R3      | Developer Connect / OAuth interruption                                                                                               | Medium      | High     | Connection health checks + fallback auth remediation                                        | Same person as **Platform Engineer Primary** (`12`)            | Open   | Platform Lead -> Engineering Lead |
| R4      | Artifact tagging conflict or immutable tag failure                                                                                   | Medium      | Medium   | SHA-tag canonical deploy path                                                               | Same person as **Platform Engineer Primary** (`12`)            | Open   | Platform Lead                     |
| R5      | Vulnerability scan blocks deploy                                                                                                     | Medium      | High     | Patch/update base image and rerun                                                           | Same person as **Security Lead Primary** (`12`)                | Open   | Security Lead -> Platform Lead    |
| R6      | Next.js build memory limit or build timeout during `npm run build`                                                                   | Medium      | Medium   | Increase Cloud Build machine type; optimize build; split steps                              | Same person as **Engineering Lead Primary** (`12`)             | Open   | Engineering Lead                  |
| R7      | Webhook pipeline not updating site                                                                                                   | Medium      | High     | Webhook auth/trigger diagnostics; verify Supabase event triggers rebuild                    | Same person as **Platform Engineer Primary** (`12`)            | Open   | On-call Operator -> Platform Lead |
| R8      | `.env.local` committed to repo history                                                                                               | Low         | Critical | Ignore rules + history cleanup + token rotation                                             | Same person as **Security Lead Primary** (`12`)                | Open   | Security Lead -> Engineering Lead |
| R9      | Missing runtime environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` not injected at Cloud Run) | Medium      | Critical | Verify `--set-secrets` mapping in every deploy; validate `/api/health` before traffic shift | Same person as **Platform Engineer Primary** (`12`)            | Open   | Platform Lead -> Engineering Lead |
| R10     | Next.js standalone output misconfiguration (`output: 'standalone'` missing from `next.config.js`)                                    | Low         | High     | CI build gate asserts `.next/standalone/` exists; block deploy if absent                    | Same person as **Engineering Lead Primary** (`12`)             | Open   | Engineering Lead -> Platform Lead |
| R11     | API route failure in production (`/api/health` or other API routes fail due to missing secrets)                                      | Medium      | High     | Pre-traffic `/api/health` check; runtime env validation in server bootstrap                 | Same person as **Engineering Lead Primary** (`12`)             | Open   | Engineering Lead -> Security Lead |

### Risk Ownership Gate

- A release decision is automatically `NO-GO` if any `Critical` or `High` risk row has blank `Risk Owner (Named)` or blank `Status`.
- `REQUIRED_*_OWNER` placeholders **in archived exports** — replace by naming accountable people in [`12-ownership-raci.md`](12-ownership-raci.md); risk rows above reference those Primaries.

## Detailed Risks

### R1 Secret Leakage Via Client Exposure

- **Cause:** `NEXT_PUBLIC_*` prefix used for variables containing secrets, or a server-only secret imported into client component code / page logic.
- **Detection:** bundle scans, grep checks, `next build` warnings, gate failures, or runtime client-side inspection revealing sensitive values.
- **Action:** remove client exposure path, rotate any exposed token, rerun full security checks, enforce server-only imports via separate `lib/server/` directories.

### R2 Cloud Run Memory Mismatch

- **Cause:** deploy flag uses `256Mi` or Next.js standalone + Node.js server exceeds the allocated memory at runtime.
- **Detection:** deploy error references gen2 memory bounds, or container exits with OOMKilled.
- **Action:** set `--memory=512Mi`, verify `.next/standalone/` build fits, redeploy. Monitor cold-start memory after first deploy.

### R3 Integration Auth Disruption

- **Cause:** expired/invalid OAuth or connector state.
- **Detection:** trigger failures before build start.
- **Action:** re-auth connector, validate trigger health.

### R4 Image Tagging Conflict

- **Cause:** mutable/immutable tag policy mismatch.
- **Detection:** push step failure.
- **Action:** prefer SHA-tag deploy source-of-truth; repair tag policy.

### R5 Vulnerability Gate Failure

- **Cause:** high/critical CVEs in base image or dependencies.
- **Detection:** scan gate fails.
- **Action:** patch image/version, reassess policy only with documented exception.

### R6 Next.js Build Failure or Timeout

- **Cause:** `npm run build` exceeds available memory or timeout in Cloud Build; large dependency tree; unoptimized static generation.
- **Detection:** build step failure in Cloud Build logs; `Build step error` or timeout before `.next/standalone/` is produced.
- **Action:** increase Cloud Build machine type, optimize build (review heavy pages/API routes), split steps if needed, verify `next.config.js` has `output: 'standalone'`.

### R7 Content Publish Not Reflected

- **Cause:** webhook, trigger, Supabase event, or pipeline break; rebuild not triggered after content change.
- **Detection:** publish event with no deploy artifact; site still serves stale content.
- **Action:** trace webhook -> trigger -> build -> revision chain and repair first failing segment. Verify Supabase realtime/webhook events reach the CI trigger.
- **Escalation:** per risk register row — operator-first (`07-operational-runbook.md`), then Platform Lead as needed.

### R8 Secret Committed To Git

- **Cause:** `.env.local` accidentally tracked.
- **Detection:** commit/scan finding.
- **Action:** treat as compromise, rotate credentials, rewrite history if required.

### R9 Missing Runtime Environment Variables

- **Cause:** Cloud Run deploy missing `--set-secrets` or env vars; `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` not injected.
- **Detection:** API routes return 500, `/api/health` fails, or server logs show `undefined` secrets. Public env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) may also be missing at build time.
- **Action:** verify secret mapping in Cloud Run console, re-deploy with correct `--set-secrets`, confirm `/api/health` returns 200 before shifting traffic.

### R10 Next.js Standalone Output Misconfiguration

- **Cause:** `next.config.js` missing `output: 'standalone'`. Dockerfile or build script does not target `.next/standalone/`.
- **Detection:** CI build gate fails because `.next/standalone/` directory is not produced; Cloud Run container cannot find `server.js`.
- **Action:** add `output: 'standalone'` to `next.config.js`, ensure Dockerfile copies from `.next/standalone/`, rebuild and redeploy.

### R11 API Route Failure in Production

- **Cause:** API route depends on missing env var at runtime (e.g., `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` not available in the container).
- **Detection:** 500 errors on `/api/*` routes; `/api/health` returns non-200; Cloud Run error logs show initialization failures.
- **Action:** check runtime env in Cloud Run console, verify Secret Manager mapping, inspect server logs for specific missing variable names, re-deploy with corrected `--set-secrets`.

## Troubleshooting Playbooks

### M1 Class Failures

- server secret missing/empty validation failures
- incomplete rename remnants (`VITE_` -> `NEXT_PUBLIC_*`)
- secret leaks in `.next/` bundle or client chunks

### M5 Class Failures

- deploy rejected by memory mismatch
- scan gate failures
- runtime revision not healthy
- Next.js build failure (`npm run build` timeout or OOM)

### M6/M7 Class Failures

- DNS/TLS not completing
- uptime checks red
- alert policies missing or misrouted

Use `07-operational-runbook.md` procedures as primary response flow and record outcomes in incident logs.

## SDLC Quality Gates

These seven gates structure engineering work from planning through verified production behavior. Treat each gate as mandatory for Phase 2 closure unless the release evidence log records an explicit, approved exception.

| Gate   | Purpose                                                        | Primary artifacts / checks                                                                                                     |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| PLAN   | Scope, milestones, RACI, and risks agreed                      | `02-business-requirements.md`, `05-milestone-implementation-plan.md`, `08-risk-and-troubleshooting.md`, `12-ownership-raci.md` |
| BUILD  | Deterministic repo build produces complete `.next/standalone/` | Local + CI build scripts; `audit:secrets`; `output: 'standalone'` in `next.config.js`; no Dockerfile fallback                  |
| REVIEW | Architecture and security boundaries reviewed                  | `04-architecture-decisions.md`; secret naming; CSP and logging choices                                                         |
| TEST   | P0 protocol passes with command evidence                       | `06-acceptance-and-test-protocol.md`, `14-evidence-and-signoff-log.md`                                                         |
| STAGE  | CI/CD produces signed image and passes gates                   | `cloudbuild.yaml` ordering; vulnerability policy; Artifact Registry image                                                      |
| SHIP   | Traffic cutover and hosting configuration correct              | Cloud Run `--port 3000`, DNS/TLS, Cloud Run revision                                                                           |
| VERIFY | Monitoring, alerts, and cost controls active                   | `07-operational-runbook.md`, `06` P0-9; thresholds per `change-log-and-decisions.md` Decision 7                                |

Skipping a gate without documentation is a **NO-GO** for launch (`11-handoff-master-checklist.md`).
