# CLAUDE CODE EXECUTION BRIEFING — PROJECT PHOENIX (ACTIVE)

> **Status — reactivated 2026-07-20 by owner (Faith Beckwith):** Project Phoenix is
> the active mission. Execute WS1→WS6 per `docs/PROJECT_PHOENIX.md` + this briefing.
> **Public production stays on Supabase Auth until cutover** via
> `AUTH_PROVIDER=supabase` (default). Do not flip `AUTH_PROVIDER=better-auth` in
> Vercel Production until Phase 11 forced-reset readiness. Feature freeze remains.

**Mission:** Implement the complete Supabase → Better Auth / MongoDB Atlas / Vercel Blob
migration for Mangu Publishers ("Project Phoenix") and carry it through production
cutover support. Humans own consoles, credentials, and DNS.

**Canonical contract:** `docs/PROJECT_PHOENIX.md` (v4.0, on `main`). That document is the
single source of truth. THIS briefing is your execution wrapper around it. Where they
conflict, the Phoenix doc wins — and if reality conflicts with both, STOP and amend the
Phoenix doc first (its own rule: "do not improvise").

---

## 1. REPOSITORY FACTS (verified 2026-07-19)

- **Repo:** `redinc23/my_publishing` — default branch `main`
- **Migration branch (exists):** `cursor/mongodb-scaffold-dffa` — may contain partial scaffolding. Inventory before writing (§3).
- **Stack evidence in repo:** Next.js (BOTH `app/` and `pages/` directories exist — see §3 warning), `middleware.ts` at root, `next.config.js` (NOT `.ts`), `tsconfig.json`, Jest (`jest.config.js`, `jest.setup.js`), Playwright (`playwright.config.ts`), Sentry configs (`sentry.client/server/edge.config.ts`), `supabase/` directory (legacy, to be removed per WS4), `lib/`, `components/`, `types/`, `tests/`, `scripts/`, `Dockerfile`, `cloudbuild.yaml` (legacy GCP Cloud Run), `vercel.json`, `.github/workflows/`, `pre-launch-verify.sh`, `setup.sh`, `.env.example`, `.env.local.example`, `.env.production.example`.
- **Phoenix doc location:** `docs/PROJECT_PHOENIX.md` on `main`.
- **Prod domain:** `https://www.mangu-publishers.com` (apex → 301 → www).

---

## 2. NON-NEGOTIABLE RULES

1. **The doc is the contract.** Every task you execute maps to a Task ID in
   `docs/PROJECT_PHOENIX.md` §4.3 / §5. Reference the ID in every commit and PR.
2. **Feature freeze is active.** No new features beyond migration parity + the
   hardening items defined in WS6.
3. **Zero `@supabase` imports at the end** (North Star #6). `grep -ri "supabase" app/ lib/ components/ types/` must return 0 code hits after PR #4.
4. **Never migrate password hashes.** Supabase bcrypt ≠ Better Auth scrypt. All legacy
   users get locked credential accounts + forced reset (see §6.7). Any plan that
   "re-hashes on first login" is WRONG — that was the v3.0 bug.
5. **Stripe webhook must be idempotent** — unique index on
   `orders.stripe_payment_intent_id`, upsert by that key, 200 on duplicates.
6. **Every PR keeps CI green.** Jest + Playwright must pass before merge. Do not merge
   red PRs "temporarily".
7. **No secrets in the repo.** Ever. Use `.env.local` and the env-validation schema.
   When you need a secret you don't have, that's a HUMAN GATE (§10) — write it into
   `HUMAN_TASKS.md` and continue with what's unblocked.
8. **Rollback readiness:** until Phase 14 completes, nothing irreversible. Cloud Run
   stays on standby 48h; Supabase stays alive 30 days.
9. **Do not delete `docs/PROJECT_PHOENIX.md` or this briefing.** Update status in them
   as you complete items.

---

## 3. PHASE 0 — RECON (do this FIRST, before any code)

Produce `docs/PHOENIX_RECON.md` answering every item. Do not skip — the Phoenix doc was
written against assumed structure; verify it against reality:

1. **Routing reality:** The repo has BOTH `app/` and `pages/`. Determine which is
   authoritative (check `next.config.js`, `vercel.json`, which pages actually serve).
   The Phoenix doc assumes App Router (`app/api/...`, `app/(auth)/actions.ts`). If the
   live app is Pages Router, amend the doc's file paths before WS1 and flag the
   middleware/API-route implications.
2. **Migration branch inventory:** `git log main..cursor/mongodb-scaffold-dffa --stat`.
   What scaffolding exists? (`lib/mongo.ts`? scripts? deps?) Reuse what exists; note
   what diverges from the doc.
3. **package.json audit:** Are `better-auth`, `mongodb`, `@vercel/blob`,
   `@upstash/ratelimit`, `@upstash/redis`, `resend` already present? Which `@supabase/*`
   packages exist (to remove in WS4)?
4. **Existing auth surface:** Find all current Supabase auth usage:
   `grep -rn "supabase" app/ pages/ lib/ components/ middleware.ts --include="*.ts*" -l`.
   Catalog every file that must change; map each to a WS task ID.
5. **Existing scripts:** Read `setup.sh`, `pre-launch-verify.sh`, `verify-setup.sh`,
   `scripts/`, and all `npm run db:*` script definitions. The doc references
   `npm run db:mongo:up|ping|indexes` — if they don't exist, creating them is part of
   your Phase 5-7 support work (§9).
6. **Env examples:** Read `.env.example`, `.env.local.example`, `.env.production.example`.
   Diff against Phoenix doc §9.1 (14 vars). Note missing/extra.
7. **CI inventory:** List `.github/workflows/*` — which reference Supabase or GCP/Cloud
   Run (WS4 removes/replaces), what test jobs exist (WS5 extends).
8. **Test baseline:** Run `npm test` and `npx playwright test` (if runnable) and record
   the CURRENT pass/fail baseline. You are not allowed to make the baseline worse.

**Output:** `docs/PHOENIX_RECON.md` with findings + a delta list (doc says X, repo has Y,
resolution Z). Open it as PR #0 (docs only) before starting WS1.

---

## 4. EXECUTION ORDER (the waterfall — strict)

Branch off `main` per workstream. One PR per workstream (2a–2d may be separate PRs).
Merge order per Phoenix doc §5.6. Branch naming: `feat/phoenix-ws<N>-<slug>`.

| Order | PR       | Workstream                                   | Risk | Doc section |
| ----- | -------- | -------------------------------------------- | ---- | ----------- |
| 0     | docs     | Recon report                                 | —    | §3 above    |
| 1     | PR #1    | WS1 Auth                                     | 🔴   | §6 below    |
| 2     | PR #2a–d | WS2 Data layer                               | 🟡   | §7 below    |
| 3     | PR #3    | WS3 Storage (+ legacy file migration script) | 🟡   | §8 below    |
| 4     | PR #4    | WS4 Health/env/cleanup                       | 🟢   | §9 below    |
| 5     | PR #5    | WS5 Tests                                    | 🟢   | §9 below    |
| 6     | PR #6    | WS6 Observability & rate limiting            | 🟡   | §9 below    |

Every PR body MUST: (a) list the doc Task IDs implemented, (b) paste the doc's
Verification column for each and show evidence (command output/screenshot), (c) tick the
relevant boxes of §9.4 Master Checklist in the PR body, (d) note any doc amendments made.

---

## 5. CRITICAL ARCHITECTURE GUARDRAIL — EDGE MIDDLEWARE

Next.js `middleware.ts` runs on the **Edge runtime**. The `mongodb` Node driver CANNOT
run there. Therefore:

- Middleware session check = **cookie-only**. Use Better Auth's
  `getSessionCookie(request)` (optimistic, no DB call). Full session validation happens
  in server components / route handlers via `auth.api.getSession({ headers })`.
- Role-based redirects in middleware: either (a) encode role in a signed cookie set at
  login, or (b) do coarse auth-gating in middleware and enforce fine-grained RBAC in
  server-side route handlers/layouts. Document your choice in the PR.
- Rate limiting in middleware is fine — Upstash REST client is edge-safe.

Getting this wrong = production outage at PR #1. This is the #1 technical risk.

---

## 6. WS1 — AUTH (PR #1) — Implementation Spec

Files: `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`,
`middleware.ts`, auth actions (path per recon), `emails/reset.tsx`, login banner.

`lib/auth.ts` must include:

```ts
// better-auth with mongodbAdapter(getDb())
// emailAndPassword: { enabled: true, requireEmailVerification: true }
// user.additionalFields: { role: { type: "string", defaultValue: "reader",
//   input: false } }  // reader|author|partner|admin  (NOT editor — see Phoenix v4.0.1)
// emailVerification: { sendVerificationEmail: via Resend, autoSignInAfterVerification: true }
// emailAndPassword.sendResetPassword: via Resend (branded template emails/reset.tsx)
// databaseHooks.user.create.after: insert profiles doc
//   { auth_user_id: user.id, display_name: user.name ?? "", role: user.role,
//     created_at: new Date(), updated_at: new Date() }
```

- **1.3** Route: `export const { GET, POST } = toNextJsHandler(auth.handler)` (or
  `auth.handler` export pattern for your better-auth version). Verify `/api/auth/ok` → 200.
- **1.4** Middleware per §5 guardrail: public matcher list, protected routes
  (`/dashboard*`, `/admin*`, `/api/files*`), redirect `/login?next=<path>`.
- **1.7 Forced reset (CRITICAL):** create `scripts/request-password-reset.ts` that, given
  an email, calls Better Auth's `requestPasswordReset` so the migration script can batch
  it. Login page banner: "Legacy user? Check your inbox to set a new password."
- Verification per doc: signup creates BOTH `user` and `profiles` docs; verify-email
  required; sign-in/out; reset end-to-end locally (use Resend test key or Ethereal/mock).

---

## 7. WS2 — DATA LAYER (PRs #2a–d) — Implementation Spec

- **2a.1 `lib/mongo.ts`:** global-cached `MongoClient` singleton (standard Next.js
  pattern: `globalThis._mongoClientPromise`), `getDb()` helper, server-only.
- **2a.2 `types/mongo.ts`:** `Profile`, `Author`, `Book` (incl. `slug`, `cover_url`,
  `manuscript_url`, `avg_rating`, `review_count`, `status`), `Order` + embedded
  `OrderItem`, `Review`, `ReadingProgress`, `AuditLog`. `tsc --noEmit` clean.
- **2a.3 `lib/mongo-queries.ts`:** `getBooks` (aggregate w/ `$lookup` authors),
  `getBookBySlug`, `getUserOrders`, `searchBooks` (`$text` + score sort). All
  pagination-aware (default 20).
- **2b.1 API routes:** books list/create, book get/patch, checkout (Stripe session —
  reuse EXISTING Stripe code; only swap the data layer), webhook:
  ```ts
  // verify signature; on checkout.session.completed:
  // db.orders.updateOne(
  //   { stripe_payment_intent_id: pi },
  //   { $setOnInsert: { ...order } },
  //   { upsert: true })
  // always 200 on duplicate; unique sparse index on stripe_payment_intent_id
  ```
- **2c.1 Server actions:** books insert/update; reviews insert THEN atomic recompute:
  aggregate avg+count over reviews for that book → `books.updateOne({ _id }, { $set:
{ avg_rating, review_count } })`; profiles update. Call `revalidatePath` after every
  mutation.
- **2c.2 `lib/audit.ts`:** `recordAudit(actorId, action, target, metadata)` →
  `audit_logs` insert. Wire into admin role-change, suspend, content-approve.
- **2d.1** Update all pages/components to the new query layer. No type errors.

---

## 8. WS3 — STORAGE (PR #3) — Implementation Spec

- **3.1** `@vercel/blob`, `BLOB_READ_WRITE_TOKEN`, `next.config.js`
  `images.remotePatterns`: `**.public.blob.vercel-storage.com`.
- **3.2** Upload action: `put(path, file, { access: 'public' })`,
  path `{userId}/{covers|manuscripts}/{uuid}-{sanitized-original-name}`, return `blob.url`.
- **3.3** `/api/files/[id]/route.ts`: auth check → purchase check (orders contain book
  OR requester is admin OR author-owner) → stream blob; 403 otherwise.
- **3.4 `scripts/migrate-storage.ts` (do not skip — this is the v3.0 hole):**
  1. List all objects in Supabase Storage bucket(s) via `SUPABASE_SERVICE_ROLE_KEY`.
  2. Download each; `put` to Vercel Blob preserving relative path.
  3. Rewrite `books.cover_url` / `books.manuscript_url` in Mongo to new Blob URLs.
  4. Idempotent: skip objects whose target URL already exists; report
     `{ migrated, failed, skipped }` to `storage-migration-report.json`.
  5. Verification: report shows 0 failed; sample 10 URLs → HEAD 200.

---

## 9. WS4 / WS5 / WS6 — FINALIZATION SPECS

**WS4 (PR #4):**

- `app/api/health/route.ts`: `?ready=1` → ping Mongo (`db.command({ping:1})`), check
  Better Auth config, Stripe key format, Upstash+Blob env presence → composite JSON.
- `lib/utils/env-validation.ts` (Zod): remove Supabase vars; add the 13 vars from doc
  §9.1 (+ `SUPABASE_SERVICE_ROLE_KEY` marked TEMP). Fail fast on boot if invalid.
- Purge: delete `lib/supabase/`, `types/database.ts`, uninstall `@supabase/*`, remove
  Supabase DNS-prefetch from layout, remove/retire `supabase/` dir & Cloud Run
  workflows per recon. Update `.env*` examples.
- **Keep** `SUPABASE_SERVICE_ROLE_KEY` ONLY in local/Vercel env until Phase 14 (needed
  by migrate-storage + export-delta); it must not appear in code.

**WS5 (PR #5):**

- Unit: replace Supabase mocks with Mongo/Better Auth mocks; add tests for
  mongo-queries, webhook idempotency (deliver twice → 1 order), avg_rating recompute.
- E2E: auth flows against Better Auth, legacy forced-reset journey,
  purchase→webhook→download. CI: unit+e2e required before merge.

**WS6 (PR #6):**

- `lib/logger.ts`: JSON `{ level, route, requestId, message, stack }`; wrap API
  handlers; document Vercel Log Drain attach step (human gate for the dashboard part).
- Sentry: verify `sentry.*.config.ts` DSN wiring, add `SENTRY_RELEASE` in CI, source
  maps upload.
- `lib/ratelimit.ts`: `@upstash/ratelimit` sliding window — 100 req/60s per IP on
  `/api/*`, 10 req/60s on `/api/auth/*`; enforce in middleware; 429 + `Retry-After`;
  whitelist `/api/health`.
- Alerting config documented as HUMAN_TASKS (Vercel/Atlas/Upstash consoles).

---

## 10. HUMAN GATES — maintain `HUMAN_TASKS.md`

You CANNOT do these. Add each to `HUMAN_TASKS.md` with exact click-paths from the
Phoenix doc, and keep coding whatever is unblocked:

- P1.4 Atlas API key, P1.5 Vercel token (consoles)
- P1.7 freeze comms, P1.8 **full Supabase pg_dump + storage snapshot (restore-tested)**
- P5.x running `npm run db:mongo:up|ping|indexes` with real Atlas keys (you WRITE the
  scripts; human runs them)
- P8.x all env vars into Vercel; Stripe webhook endpoint config
- P11.1 Supabase exports (needs `SUPABASE_DB_URL`), P11.4 production `mongoimport`,
  P11.5 `mongosh` verification, P11.6 sign-off
- Phase 13 Cloudflare DNS + Cloud Run standby/teardown
- Phase 14-15 production QA matrix, mongodump to cloud storage, token revocation,
  Supabase pause, post-mortem
- Mass forced-reset email send in prod (you write the batch script; human triggers)

---

## 11. DATA MIGRATION SCRIPTS YOU OWN (Phase 11 support)

Write these; humans execute with real credentials:

1. `scripts/export-supabase.sh` — the exact `\copy (SELECT json_agg(row_to_json(t)) ...)`
   commands from doc §5.5 P11.1 (auth.users, profiles, authors, books, orders+items
   join, reviews). Output to `export/`, then `jq length export/*.json` verification.
2. `scripts/transform-data.ts` — implement doc §5.5 P11.2 Tasks 2.1–2.8 EXACTLY:
   - `user` docs: string `id` = legacy UUID, `emailVerified` from `email_confirmed_at`,
     `name` from `raw_user_meta_data`
   - `account` docs: `{ providerId: "credential", accountId: id, userId: id,
password: "!locked:<uuid>" }` — NEVER copy bcrypt hashes
   - UUID→ObjectId map persisted to `export/_id_map.json`; authors/books remapped;
     unique slug generation; `avg_rating:0, review_count:0` init
   - orders flattened to embedded `order_items[]`; preserve `stripe_payment_intent_id`
   - ISO strings → native Dates; final transform report (counts, orphans, collisions)
3. `scripts/migrate-storage.ts` (§8 above)
4. `scripts/export-delta.ts` — capture Phoenix-window writes per collection since a
   timestamp (rollback divergence, doc §8.3).
5. `scripts/send-forced-resets.ts` — batch: for each imported user →
   `requestPasswordReset` (rate-limited, dry-run flag, progress log, failure report).
6. `scripts/verify-migration.mongo.js` — the P11.5 count/integrity/storage checks as a
   runnable `mongosh` script printing PASS/FAIL per check.

---

## 12. DEFINITION OF DONE (your engagement ends when)

All 8 North Star boxes (doc §1.2) are certifiable:

1. `npm run build` exit 0, zero warnings
2. `/api/health?ready=1` → `{"ready":true}`
3. 22-point QA suite executed with documented results (prod = human runs, you support)
4. All PRs #1–#6 merged, Vercel prod green
5. mongodump stored (human gate — confirm it happened)
6. `grep -ri "supabase" app/ lib/ components/ types/` → 0 hits
7. Forced-reset batch script executed + completion telemetry visible
8. 429s verified, Sentry receiving, logs flowing

When done: update `docs/PROJECT_PHOENIX.md` status header to `🟢 COMPLETE` (final PR),
append your run summary to `POST_MORTEM.md` draft for the human post-mortem.

---

## 13. COMMUNICATION STYLE FOR THIS ENGAGEMENT

- One PR per workstream; descriptive PR bodies with Task IDs + verification evidence.
- If blocked by a human gate: log to `HUMAN_TASKS.md`, state it in your summary, move
  to unblocked work. Never fabricate credentials or skip a gate silently.
- If the Phoenix doc is wrong about reality: amend the doc in the same PR with a
  `docs:` commit explaining the delta. Do not improvise silently.
- Small, reviewable commits. Conventional messages: `feat(phoenix-ws1): ...`,
  `fix(phoenix-ws2): ...`, `docs(phoenix): ...`, `chore(phoenix-ws4): ...`.

---

## 14. AGENT SKILLS (procedural packs)

Repo-owned skills live under `.claude/skills/` (index: `.claude/skills/README.md`).
Specialized reviewers live under `.claude/agents/`.

Skills encode Phoenix + ops procedures for agents. They do **not** replace human gates
(consoles, credentials, DNS). When a skill applies, read its `SKILL.md` before acting.

Priority packs: **`mangu-navigator`** (load first every session — dual ledgers,
next-best-action, enhancement engine), then `phoenix-contract`,
`mangu-env-and-secrets`, `mcp-catalog-ops`, `better-auth-mangu`,
`mongodb-atlas-mangu`, `mangu-ops-runbook`, `phoenix-data-migration`.

## 15. CONTINUOUS COWORK

- Entry: `AGENTS.md` + `docs/COWORK_OPERATOR.md`
- Paste prompts: `.cursor/automations/*.prompt.md`
- Status script: `./scripts/cowork-status.sh`
- Storm automations must stay **disabled** (IDs in `HUMAN_TASKS.md` C0.1). Agents cannot
  toggle Cursor Automations via API — only the human can.
- Default path: **Phoenix (B)**. One PR per run.

---

_Briefing v1.2 — 2026-07-19. Pairs with `docs/PROJECT_PHOENIX.md` v4.0. Execute Phase 0
recon first. Godspeed. 🔥_
