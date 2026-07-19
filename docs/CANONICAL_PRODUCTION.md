# Canonical Production Target

**Decision (2026-07-18):** **Vercel** is the authoritative production deployment path for MANGU Publishers ([ADR-001](./adr/ADR-001-canonical-platform.md) — **ACCEPTED Option B**).

> Cloud Run / `cloudbuild.yaml` / GCP Secret Manager launch checklists below the fold are **SUPERSEDED** for GO evidence. Apex may still resolve to Cloud Run until Phase 15 DNS cutover; do not treat that surface as canonical.

## Rationale (updated)

| Criterion                         | Vercel (canonical)                               | Cloud Run (retired for GO) |
| --------------------------------- | ------------------------------------------------ | -------------------------- |
| Operator decision 2026-07-18      | **Accepted**                                     | Rejected                   |
| Current `www` host                | Yes (`server: Vercel`)                           | No                         |
| Current apex host (pre-cutover)   | Not yet                                          | Still Google Frontend      |
| Production readiness (2026-07-18) | **Not yet** (`ready:false` — Stripe env missing) | Legacy `ready:true`        |

## Constants (Vercel)

| Constant                 | Value                                              |
| ------------------------ | -------------------------------------------------- |
| Platform                 | Vercel                                             |
| Project                  | `manguprojectz`                                    |
| Interim production URL   | `https://www.mangu-publishers.com`                 |
| Final production URL     | `https://mangu-publishers.com` (after DNS cutover) |
| Stripe webhook (interim) | `https://www.mangu-publishers.com/api/webhook`     |
| Monitors / Lighthouse    | `https://www.mangu-publishers.com`                 |
| Deploy                   | Vercel Git deploy from `main`                      |

## Operator cutover checklist (required for G7 / G9)

### 1. Local env (unchanged)

```bash
cp .env.local.example .env.local
# Fill from dashboards (never commit secrets)
npm run validate-env
```

### 2. Promote secrets to Vercel Production

In Vercel → Project → Settings → Environment Variables (Production), set at least:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MONGODB_URI` (ADR-002 Atlas; additive until Supabase cutover), optional `MONGODB_DB=mangu`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (fail-closed in production)
- `NEXT_PUBLIC_SITE_URL=https://www.mangu-publishers.com` (switch to apex after DNS cutover)
- Optional: `RESEND_API_KEY`, `OPENAI_API_KEY`, Sentry vars

**Forbidden in production:** `USE_MOCKS`, `SKIP_EMAILS`.

Repo-side check of the production-shaped config (names + formats only, never values — CCR-009):

```bash
npm run validate-env -- --production   # see docs/SECRET_INVENTORY.md
```

Redeploy Production after env changes (`NEXT_PUBLIC_*` require rebuild).

### 3. Prove Vercel readiness

```bash
curl -sS "https://www.mangu-publishers.com/api/health?ready=1"
# Expect: HTTP 200 and "ready":true
```

Until this passes, **G7/G9 stay FALSE** even though ADR-001 is ACCEPTED.

### 4. Stripe webhook

1. Stripe Dashboard → Webhooks → endpoint  
   `https://www.mangu-publishers.com/api/webhook` (or apex after cutover)
2. Copy signing secret → Vercel `STRIPE_WEBHOOK_SECRET` → redeploy

### 5. Apex DNS cutover (Phase 15)

Cloudflare zone `mangu-publishers.com`:

1. Export/screenshot current DNS (rollback aid).
2. Add Vercel’s recommended apex records for the project domain.
3. Remove Google Cloud Run apex A/AAAA (`216.239.*` / `2001:4860:4802:*`).
4. Keep `www` on Vercel (already CNAME to `*.vercel-dns-*.com`) or follow Vercel’s www guidance.
5. Verify cert SAN covers the hostname you serve; then set `NEXT_PUBLIC_SITE_URL` to the final origin and redeploy.

### 6. Retire Cloud Run (after Vercel green)

- Stop treating `./scripts/gcloud-build-submit.sh` as the launch path.
- Optionally delete/disable Cloud Run service `mangu-publishers` once traffic and webhook are stable on Vercel.

## SUPERSEDED — Cloud Run path (do not use for GO)

Previous checklist (GCP project `delta-wonder-488420-i3`, `gcloud-build-submit.sh`, Secret Manager sync) is historical only. See git history pre-ADR-001 Option B acceptance.

### Legacy operations scripts (compatibility/emergency path only — non-canonical per ADR-001)

The apex may still resolve to Cloud Run until the Phase 15 DNS cutover. Keep that legacy surface healthy — and retain an emergency verification path — with:

```bash
# Least-privilege secretAccessor bindings for the Cloud Run runtime SA (CCR-008)
DRY_RUN=1 ./scripts/grant-cloudrun-secret-access.sh   # preview, change nothing
./scripts/grant-cloudrun-secret-access.sh             # apply (idempotent)

# Liveness (/api/health → 200) + readiness (/api/health?ready=1 → ready:true)
# non-zero exit = NOT GO on that surface
./scripts/verify-gcp-production.sh
```

Overrides: `GCP_PROJECT_ID`, `GCP_REGION`, `CLOUD_RUN_SERVICE`, `PROD_BASE_URL`
(defaults: `delta-wonder-488420-i3` / `us-central1` / `mangu-publishers`).
Secret names, store-of-record IDs, and accessor bindings: [SECRET_INVENTORY.md](./SECRET_INVENTORY.md).

> Output of these scripts is evidence for the legacy surface only — never GO evidence. Canonical readiness proof is step 3 above (Vercel).

## Related

- Authority: [ADR-001](./adr/ADR-001-canonical-platform.md)
- Secrets: [SECRET_INVENTORY.md](./SECRET_INVENTORY.md)
- Evidence: [OPERATOR_QA_LOG.md](./OPERATOR_QA_LOG.md)
- Execution: [NEXT_GO.md](./NEXT_GO.md)
