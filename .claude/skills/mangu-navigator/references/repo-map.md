# Repo map — annotated (verified against main @ 9a8a940, 2026-07-20)

Facts here were verified by reading the tree at the SHA above. If HEAD has moved
(state-sync.sh prints it), trust the tree over this file and amend deltas.

## Routing (App Router is authoritative)

`pages/` contains only a dead `pages/_document.tsx` (recon D1, slated for
deletion in WS4). Everything real is under `app/`:

| Area | Paths | Notes |
| --- | --- | --- |
| Auth | `app/(auth)/` → `/login`, `/register`, `/reset-password(/confirm)`, `/verify-email`, `/callback` | Server actions per route; provider-branched since WS1 |
| Consumer | `app/(consumer)/` → `/`, `/books[/slug]`, `/authors[/id]`, `/genres[/genre]`, `/library`, `/reading/[bookId]`, `/discover*`, `/audio[/id]`, `/comics[/slug]`, `/papers[/slug]`, `/recommendations`, `/readers-hub`, marketing/legal pages | `/library` and `/reading` are auth-gated |
| Portals | `app/(portals)/author/*` (dashboard, projects, submit, analytics) · `app/(portals)/partner/*` (dashboard, orders + export, catalogs, arc-requests) | Role-gated: author / partner |
| Admin | `app/admin/*` (dashboard, books CRUD, users, orders, manuscripts, health) | Role-gated: admin; `app/admin/_lib` helpers |
| Dashboard | `app/dashboard/*` (my-reviews, books/[id]/analytics, settings) | Reader-facing account area |
| API | `app/api/` → `health`, `live`, `session`, `checkout`, `webhook` (canonical Stripe), `webhooks/`, `auth/` (incl. Better Auth `[...all]` handler), `upload`, `resonance`, `reviews`, `bookmarks`, `highlights`, `wishlist`, `follows`, `newsletter`, `email`, `analytics`, `audio`, `mcp` | `/api/health?ready=1` is the readiness contract (G7) |

Middleware (`middleware.ts`, Edge): rate limiting (fail-closed 503 when limiter
unavailable), then auth gating for `/reading*`, `/library*`, `/author(/)*`,
`/partner(/)*`, `/admin*`, `/dashboard*`, `/api/files*`. Branches on
`getAuthProvider()`: Supabase edge-JWT parse vs Better Auth
`getSessionCookie` + `MANGU_ROLE_COOKIE`. Cookie-only on Edge — no DB drivers.

## lib/ — business logic

| Module | Role |
| --- | --- |
| `lib/auth/provider.ts` | **The auth switch.** `AUTH_PROVIDER` env → `'supabase' \| 'better-auth'`, default supabase |
| `lib/db/provider.ts` | **The data switch.** `DATABASE_PROVIDER` env → default supabase (ADR-002) |
| `lib/auth.ts` / `lib/auth-client.ts` | Better Auth server (lazy Mongo init, Resend-backed verify/reset emails, role additionalField, profiles hook) / client |
| `lib/auth/` | `better-auth-actions.ts`, `roles.ts` (reader\|author\|partner\|admin + role cookie), `register-errors.ts` |
| `lib/supabase/` | Legacy live path: `client/server/admin.ts`, `edge-auth.ts`, `queries.ts`, `public-queries.ts`, `portal-queries.ts`, `author-ownership.ts`, `genre-counts.ts` — removed only in WS4 |
| `lib/mongodb.ts`, `lib/mongodb-config.ts` | Cached MongoClient singleton + config |
| `lib/stripe/` | Checkout + webhook logic (reuse, don't rewrite — WS2b swaps only the data layer) |
| `lib/resonance/` | AI recommendations (OpenAI embeddings, heuristic fallback) |
| `lib/email/` | Resend senders + guards (`isEmailConfigured`) |
| `lib/rate-limit.ts` | Upstash sliding-window, edge-safe, fail-closed |
| `lib/actions/`, `lib/services/`, `lib/validations/` (Zod), `lib/hooks/`, `lib/reading/`, `lib/uploads/`, `lib/mcp/`, `lib/sentry/`, `lib/seo/`, `lib/middleware/`, `lib/utils/` | Feature verticals; match existing patterns before adding abstractions |
| `lib/server-only-guard.ts` | Import-time guard for server-only modules |

## components/ — UI verticals

`ui/` (Radix wrappers) · `shared/` (Header, Nav, Search) · `layout/` (incl.
`AuthGuard`) · `home/`, `library/`, `audio/` (full audio engine + mini-player),
`reader/` (highlights, notes, wishlist, follows) · `cards/`, `players/`,
`social/`, `email/`, `seo/`, `animation/`, `admin/`, `providers/`, `common/`.

## Data & storage

- `supabase/migrations/` — **33 ordered SQL migrations at snapshot** (NEXT_GO's
  "25, hosted↔repo exact-match" was true at its 2026-07-18 baseline; 8 more
  landed 2026-07-19 — a live example of doc drift, so always
  `ls supabase/migrations | wc -l`). Never invent out-of-order migrations;
  naming `YYYYMMDDHHMMSS_slug.sql`. Tip at snapshot:
  `20260719042627_listening_progress_schema_reconciliation.sql`. Hosted-parity
  must be re-verified before any RLS/migration claim (Phase 7 recurs).
- Supabase Storage buckets: `book-covers`, `manuscripts`, `published-epubs`
  (WS3 migrates these to Vercel Blob; `scripts/migrate-storage.ts` owns it).
- `types/` — `database.ts` (Supabase types, deleted in WS4), `books/engine/
  revenue/analytics/stripe/upload/webhook/export`. Phoenix adds `types/mongo.ts`.

## scripts/ — grouped by purpose

| Purpose | Scripts |
| --- | --- |
| Quality/CI parity | `ci-local.sh` (quality + unit + build, run before every PR), `pre-launch-verify.sh`, `launch-readiness.sh` |
| Env | `validate-env.ts` (runs on `npm run dev`), `setup-env-interactive.sh`, `setup.sh` |
| Mongo/Phoenix | `mongo-up.ts`, `mongo-ping.ts`, `mongo-ensure-indexes.ts`, `mongo-import-uri.ts`, `atlas-bootstrap.ts`, `sync-mongodb-to-vercel.ts`, `request-password-reset.ts` |
| Supabase legacy | `apply-supabase-migrations.sh`, `run-migrations.ts`, `verify-migrations.sh`, `verify-rls.ts`, `seed-database.ts`, `backup-db.sh`, `update-supabase-anon-key.sh` |
| GCP legacy | `gcloud-build-submit.sh`, `gcp-config.sh`, `verify-gcp-production.sh`, `grant-cloudrun-secret-access.sh`, `sync-gcp-secrets-from-env.sh` |
| Cowork/ops | `cowork-status.sh` (prod probes + PR list), `create-stripe-webhook.sh`, `backfill-resonance-embeddings.ts` |
| Navigator | `state-sync.sh`, `enhance-scan.sh` (session ritual + enhancement SCOUT) |

## CI — `.github/workflows/` (21)

Core: `ci.yml`, `e2e.yml`, `preview-e2e.yml`, `format-check.yml`, `deploy.yml`.
Security: `codeql`, `container-scan`, `dependency-review`, `npm-audit`,
`rls-check`. Ops: `health-check`, `lighthouse-ci`, `bug-to-issue`, `stale`,
`auto-merge`, `ci-fix-loop`, `cowork-operator-guard`, `admin-setup`,
`supabase-migrate`, `release-please` (PR #145 HELD until GO),
`copilot-setup-steps`.

## docs/ — by authority tier (see authority-chain.md)

- **Authorities:** `NEXT_GO.md` (launch), `PROJECT_PHOENIX.md` (migration),
  `adr/ADR-001` (Vercel canonical, Option B ACCEPTED), ADR-002 (Mongo provider).
- **Ground truth:** `PHOENIX_RECON.md` (architecture inventory + deltas),
  `OPERATOR_QA_LOG.md` (append-only evidence), `SECRET_INVENTORY.md`.
- **Runbooks:** `ROLLBACK.md`, `MANGU_PRODUCTION_DEPLOYMENT.md`,
  `STRIPE_WEBHOOK_PRODUCTION.md`, `PHASE4_OPERATOR_RUNBOOK.md`,
  `COWORK_OPERATOR.md`, `MIGRATIONS.md`, `DEPLOYMENT.md`.
- **Product:** `MANGU_PUBLISHERS_END_TO_END.md` (everything-in-one),
  `BRD.md`, `FEATURE_PHASES.md`, `PRODUCT_FEATURE_STORIES.md`, `API.md`.
- **Subordinate snapshots:** `README.md`, `QUICK_START.md`, `LAUNCH_*` — they
  defer to NEXT_GO per CCR-001.

## Agent infrastructure

- `CLAUDE.md` — execution briefing (Phoenix ACTIVE wrapper, WS specs §6–§9,
  human gates §10, DoD §12). `AGENTS.md` — Copilot CLI modes. `cursorrules`,
  `.cursor/automations/*.prompt.md` — cowork prompts. `HUMAN_TASKS.md` —
  console-only work ledger.
- `.claude/skills/` — specialist packs, indexed in its `README.md` by tier
  (A always-load, B migration-window, C steady-state, D stubs). Includes
  **mangu-navigator** (master orchestration — load first).
- `.claude/agents/` — `phoenix-pr-reviewer`, `migration-verifier`,
  `mcp-security-reviewer`.
- Root: `Dockerfile` + `cloudbuild.yaml` (legacy Cloud Run, emergency only),
  `vercel.json` (canonical), `mangu-repo-janitor.sh`, `verify-setup.sh`.
- Node engine: `>=22.22.1` (`.nvmrc` present).
