# 01. Executive Summary

Source baseline: `docs/phase2/_sources/litstream_phase2_sec00.md`

## Project Purpose

Mangu Publishers Phase 2 takes the platform from local-only development to a production deployment on a custom domain over HTTPS, with a Next.js 14 application deployed to Cloud Run with Firebase Hosting edge entry, using Supabase for backend data, Stripe for payments, and Resend for email.

Core model:

- Content is fetched at build time or runtime from Supabase.
- Next.js renders pages via SSR/SSG/static generation.
- Runtime executes a Node.js app server (Next.js standalone).

## Scope Definition (M1–M7b)

| Milestone | Goal | Key Deliverable |
|---|---|---|
| M1 | Local security hardening | Server secret validation — ensure `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` never leak to client |
| M2 | Build pipeline scripts | Next.js build pipeline — `npm ci`, `npm run build` producing `.next/standalone/` |
| M3 | Runtime container | Hardened Node.js container with Next.js standalone output, non-root UID 1001, `/api/health` endpoint |
| M4 | GCP foundation | Artifact Registry, Secret Manager, IAM, Developer Connect, trigger foundation |
| M5 | Cloud Build end-to-end | Push to `main` executes deterministic Cloud Build pipeline and deploy |
| M6 | Firebase + domain | TLS-enabled custom domain, rewrite and deep-link correctness |
| M7a | Pre-cutover guardrails | Monitoring, alerts, budgets validated before GO-LIVE |
| M7b | Post-cutover stabilization | Webhook rebuilds, overnight review, steady-state handoff |

## Dependency Chain

- M2 depends on M1.
- M3 depends on M2.
- M4 can be done in parallel with M2/M3.
- M5 depends on M1–M4 complete.
- M6 depends on M5.
- M7a must complete before public cutover; M7b completes after launch before steady-state handoff signoff.

## Success Criteria (Launch-Grade)

- Production custom domain loads over HTTPS and resolves deep links (`CUSTOM_DOMAIN` in `05-milestone-implementation-plan.md`).
- `/api/health` returns HTTP 200.
- No `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or `RESEND_API_KEY` appears in browser bundle, image layers, logs, or runtime env.
- Next.js static assets served with appropriate cache headers.
- Source maps are not publicly exposed.
- CSP blocks unauthorized API access from browser.
- Container runs as non-root UID 1001.
- Supabase/webhook event typically triggers a build quickly (**target ~60s**); **worst-case SLO** is in [`06-acceptance-and-test-protocol.md`](06-acceptance-and-test-protocol.md) P0-8 (`<= 10 min` / `<= 20 min`).
- Sentry receives release-tagged events.
- Uptime checks and billing alerts are green/active.

## Intended Audience

- Engineering team implementing Phase 2.
- Platform/DevOps operators managing deployment and incidents.
- Future maintainers and AI agents executing the documented procedures.

## Canonical Follow-Ups

- For requirement-level intent and constraints: `02-business-requirements.md`
- For executable milestone steps: `05-milestone-implementation-plan.md`
- For launch gate checks: `06-acceptance-and-test-protocol.md`
