# Task router — from any request to the right execution path

For each task category: which specialist skill(s) to load from
`.claude/skills/`, which docs to read, what proof closes the task, and which
human gates typically block it. Load specialists *in addition to* the
navigator, not instead of it.

| # | Task category (trigger examples) | Load skills | Read | Proof that closes it | Likely human gates |
|---|---|---|---|---|---|
| 1 | Planning / "what's next" / prioritization | (this skill) + `phoenix-contract` | `CLAUDE.md` §4, Phoenix §4.3/§5, NEXT_GO §4–6 | A named slice with Task IDs + branch created | Path/scope decisions → owner |
| 2 | Auth: login, register, sessions, verify-email, forced reset, middleware gating | `better-auth-mangu` | `lib/auth.ts`, `lib/auth/*`, `middleware.ts`, recon §5, `docs/AUTH_TESTING.md` | Signup creates `user`+`profiles`; verify-email flow; `/api/auth/ok` 200; gated routes redirect with `?next=`; Jest green | Resend key; Vercel env |
| 3 | Data layer: Mongo schema, queries, indexes, server actions | `mongodb-atlas-mangu` + `phoenix-contract` | Phoenix §4.2, WS2 spec in `CLAUDE.md` §7, `types/` | `tsc --noEmit` clean; query unit tests; `npm run db:mongo:ping`/`indexes` output (human runs with real keys) | Atlas API keys (P1.4) |
| 4 | Payments: checkout, webhook, orders, refunds | `stripe-webhook-mangu` | `lib/stripe/`, `docs/STRIPE_WEBHOOK_PRODUCTION.md`, `docs/WEBHOOK_TESTING.md` | Idempotency test: deliver event twice ⇒ 1 order; signed-event 2xx (G8 evidence) | Stripe dashboard endpoint config (P8.x) |
| 5 | Storage: uploads, covers/manuscripts, Blob migration | `phoenix-storage-blob` | `CLAUDE.md` §8, `lib/uploads/` | `storage-migration-report.json` 0 failed; 10 sampled URLs HEAD 200; entitlement-gated `/api/files` 403s | `BLOB_READ_WRITE_TOKEN` |
| 6 | Env & secrets: new vars, validate-env, examples | `mangu-env-and-secrets` | `.env*.example`, `scripts/validate-env.ts`, `docs/SECRET_INVENTORY.md` | `npm run validate-env` passes; examples updated; zero real values committed | All real values → consoles |
| 7 | Incident / prod weirdness / rollback | `mangu-ops-runbook` | `docs/ROLLBACK.md`, `docs/OPERATOR_QA_LOG.md` | Probes green again; QA-log append with SHA + revision | DNS, Vercel/Cloud Run consoles |
| 8 | CI red / flaky tests / workflow edits | `mangu-ci-quality` | `.github/workflows/`, `scripts/ci-local.sh` | `./scripts/ci-local.sh` green locally; Actions green on the PR SHA | Actions billing/permissions |
| 9 | Data migration window: export/transform/import/verify | `phoenix-data-migration` (+ `phoenix-cutover` on the day) | Phoenix §5.5–5.8, `CLAUDE.md` §11 | Transform report (counts/orphans/collisions); `verify-migration.mongo.js` all PASS | pg_dump, mongoimport, mongosh runs (P11.x) |
| 10 | Legacy Supabase SQL / RLS / migrations | (none dedicated) — follow `docs/MIGRATIONS.md` | `supabase/migrations/`, `docs/MIGRATIONS.md` | Ordered file naming; `npm run verify-rls`; rls-check workflow green | Supabase dashboard SQL runs |
| 11 | MCP server work at `/api/mcp` | `mcp-catalog-ops` (+ `mcp-catalog-authz`/`write` when activated) | `docs/MCP_SERVER.md`, `lib/mcp/` | `mcp-smoke.sh` / `mcp-load-check.sh` pass; `MCP_ENABLED` gating respected (fail-closed) | — |
| 12 | Roles, permissions, admin actions, audit | `mangu-rbac-admin` | `lib/auth/roles.ts`, role matrix ref | RBAC smoke: non-admin denied, non-partner export denied (G5 evidence); audit rows written | — |
| 13 | Observability: logging, Sentry, rate limits | `mangu-observability` | WS6 spec (`CLAUDE.md` §9), `lib/rate-limit.ts`, `sentry.*.config.ts` | 429 + Retry-After verified; Sentry event received; structured logs visible | Log-drain attach; alert routing consoles |
| 14 | Content/commerce product flows (freeze-permitting) | `mangu-content-commerce` | `docs/FEATURE_PHASES.md`, NEXT_GO §7 scope classes | Flow checklist pass; no false-success surfaces (G6) | — |
| 15 | Security hygiene: secret scans, supabase purge, dep audits | `mangu-security-hygiene` | its `post-ws4-grep.md`, `HUMAN_TASKS.md` H0.x | Forbidden-pattern grep clean; `grep -ri supabase app/ lib/ components/ types/` trending → 0 | Key disable/rotation in consoles (H0.1) |
| 16 | Release / GO assessment / cutting v1.0.0 | (this skill) + all evidence refs | NEXT_GO §6 gates + §12 sign-off | All G1–G13 TRUE at one exact SHA; sign-off block filled | Owner sign-off; #145 release |
| 17 | Docs/reporting/status | — | authority-chain.md | Amended doc merged with `docs:` commit; baselines refreshed (CCR-020) | — |
| 18 | Cowork/automation setup | — | `docs/COWORK_OPERATOR.md`, `.cursor/automations/` | `./scripts/cowork-status.sh` clean; storm automations confirmed disabled | C0.1/C0.2 (Cursor dashboard) |
| 19 | Product enhancement: "improve UI", "new feature", "best in class", growth ideas | (navigator §4b) + relevant vertical skill for the build | `references/enhancement-engine.md`, `docs/ENHANCEMENT_LEDGER.md`, NEXT_GO §7 scope classes | Ledger entry with lane+score+flag; if building: flagged PR green + metric instrumented | L2 approval / L3 unfreeze → owner |

## Routing edge cases

- **A task spans lanes** (e.g., "wire checkout to Mongo") → load both
  specialists (`stripe-webhook-mangu` + `mongodb-atlas-mangu`) and keep the
  Phoenix Task ID (2b.1) as the unit of work.
- **A "quick feature" request during freeze** → check NEXT_GO §7 scope classes
  first. If it's not Launch-in-MVP parity or a permitted class, the productive
  answer is *no* plus a `Post-launch` backlog note — that protects GO.
- **Anything touching production or DNS** → rollback-first rule (CCR-012):
  verified known-good target + rehearsed rollback before execution, and it's
  almost certainly a human gate.
- **You're asked to "just disable the checks"** → the checks are the product's
  evidence system. Fix the underlying issue or supersede-and-append; never
  rewrite the QA log or force-merge red.
