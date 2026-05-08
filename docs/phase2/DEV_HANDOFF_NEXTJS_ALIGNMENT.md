# Phase 2: Next.js Alignment Handoff

Welcome to the `mangu-publishers` Phase 2 production rollout.

The documentation you are looking at in `docs/phase2/` establishes a rigorous production launch framework (CI gates, RACI ownership, rollback discipline, and evidence logs). 

However, there is a technical divergence between the current state of these documents and the actual codebase.

## 1. Context & Current State

- **The Good:** The control framework in these docs is solid. It enforces strict security boundaries, proper CI/CD sequencing, and clear operational runbooks.
- **The Catch:** The technical details inside these markdown files were originally written for a fictional Vite/React static site served by Nginx on port 8080 (fetching content from Sanity at build time).
- **The Reality:** The actual application in this repository is `mangu-publishers` (formerly `mangu-platform`), which is a **Next.js 14 app** (Node.js runtime, port 3000, `output: 'standalone'`) using Supabase, Stripe, and Resend.

Your immediate task is to keep the rigorous *framework* but swap out the *technical details* to match the Next.js runtime.

## 2. The Next.js Runtime Shift

When updating the docs and pipelines, apply these technical shifts:

- **Port:** The container exposes and listens on `3000`, not `8080`. Cloud Run deploy commands must reflect this.
- **Build Steps:** Instead of Vite + Prerender steps, the pipeline will execute a standard Next.js build (e.g., `npm run build` which produces `.next/standalone/`).
- **Secrets & Env Vars:** Drop Sanity tokens. The runtime needs `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `RESEND_API_KEY`. Explicitly document the separation between public (`NEXT_PUBLIC_*`) variables built into the client and server-side secrets injected via Google Secret Manager at runtime.
- **Runtime:** Replace any mention of an "Nginx static server" with a "Node server running the Next.js standalone build".
- **Checks:** Instead of grepping `dist/assets/` or checking Nginx headers, validation checks should target `.next/standalone/` and the actual health endpoint (e.g., `/api/health`).

## 3. Environment & Secrets Intake

Before executing any commands, the environment variables used in the markdown templates must be filled.
- Refer to `docs/phase2/_intake/FIELDS_TO_GATHER.md`.
- Copy `docs/phase2/_intake/environment.example.sh` to `environment.local.sh` (which is gitignored) and fill in the real values.
- These values automatically populate the `cloudbuild.yaml` and `gcloud` command templates throughout `05`, `06`, and `07`.

## 4. File-by-File Alignment Checklist

Please go through these files and update the technical specifics:

- [ ] `03-functional-requirements.md`
  - Update hosting and routing requirements.
  - Revise the secrets requirements to match Supabase/Stripe/Resend.
- [ ] `04-architecture-decisions.md`
  - Remove ADRs related to Nginx/Static.
  - Add an ADR documenting the choice of a Next.js standalone Node server on Cloud Run.
- [ ] `05-milestone-implementation-plan.md`
  - Rewrite the canonical 16-step Cloud Build pipeline table to match the Next.js build sequence.
  - Fix Cloud Run deploy flags in the command templates (e.g., `--port 3000`).
- [ ] `06-acceptance-and-test-protocol.md`
  - Rewrite P0 checks. For example, P0-2 should check for `.next/standalone/`, P0-3/P0-4 should adjust expected headers, and P0-7 secret scans should target the Next.js output directories.
- [ ] `07-operational-runbook.md`
  - Update health probe commands to target the correct Next.js API endpoint (e.g., `curl -fsS -i "https://${CUSTOM_DOMAIN}/api/health"`).
- [ ] `08-risk-and-troubleshooting.md`
  - Remove Vite/Nginx specific risks.
  - Add Next.js specific risks (e.g., memory limits during build, missing runtime environment variables).
- [ ] `09-appendices.md`
  - Update the Environment Variable classification table to correctly classify Supabase, Stripe, and Resend variables.
- [ ] `_intake/environment.example.sh`
  - Update the template defaults (e.g., `SERVICE_NAME`, port notes) to match Next.js.
- [ ] `change-log-and-decisions.md`
  - Log a decision noting the shift from the static Nginx architecture to the Next.js standalone runtime for `mangu-publishers`.

## 5. Deployment Next Steps

1. Complete the alignment edits in the checklist above.
2. Ensure `_intake/environment.local.sh` and `12-ownership-raci.md` are fully populated with real, non-placeholder values.
3. Scaffold the actual `cloudbuild.yaml` in the repository root based on the aligned `05-milestone-implementation-plan.md`.
4. Ensure Cloud Run is configured with the correct `--set-env-vars` (for non-secrets) and `--set-secrets` (mapping Google Secret Manager payloads to `SUPABASE_SERVICE_ROLE_KEY`, etc.).
5. Execute the Cloud Build pipeline and proceed through the P0 acceptance gates.