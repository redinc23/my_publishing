# Workflow Inventory (from recon)

**Retire/scrub in WS4 (Supabase/GCP-touching):**  
`supabase-migrate.yml`, `rls-check.yml`, `deploy.yml` (if GCP), related health that assumes Supabase, container-scan paths tied to Cloud Run as appropriate.

**Keep:** format-check, codeql, dependency-review, npm-audit, lighthouse-ci, auto-merge, bug-to-issue, stale, release-please, admin-setup (review individually).

**Extend in WS5:** `ci.yml` (Jest), `e2e.yml`, `preview-e2e.yml`.

**Incoming from scaffold:** `mongo-up.yml`.

Re-read `.github/workflows/*` before deleting — recon snapshot may drift.
