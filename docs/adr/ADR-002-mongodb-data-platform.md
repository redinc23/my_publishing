# ADR-002: MongoDB Atlas as Application Data Platform (Supabase Retirement)

| Field         | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **Status**    | **ACCEPTED (direction)** — automation path live; query/auth cutover still IN PROGRESS          |
| **Created**   | 2026-07-18                                                                                     |
| **Updated**   | 2026-07-18 (db:mongo:up automation: Atlas API → .env.local → Vercel → ping → indexes)          |
| **Deciders**  | Solo Operator (Chris)                                                                          |
| **Hard gate** | G7 (data/auth readiness) — remains FALSE until Mongo + replacement auth prove `ready:true`     |

## Context

The app currently uses **Supabase** (PostgreSQL + Auth + Storage + generated APIs) across ~100 TypeScript call sites (`lib/supabase/*`, RLS, migrations under `supabase/migrations/`).

The operator decided to leave Supabase and move to **MongoDB Atlas** as the primary database while hosting on **Vercel** (ADR-001 Option B).

MongoDB replaces the **database** only. Auth, file storage, and auto-generated REST/GraphQL are **not** included and must be replaced separately.

## Options

| Option                         | Description                                      | Notes                                                                 |
| ------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------- |
| **A — Stay on Supabase**       | Keep Postgres + Auth + Storage                   | Rejected by operator                                                  |
| **B — MongoDB Atlas + apps**   | Atlas for documents; separate auth + storage     | Chosen direction                                                      |
| **C — Dual-write transition**  | Write both engines during cutover                | Higher complexity; optional later if downtime must be near-zero       |

## Decision (direction)

**Option B — MongoDB Atlas is the target application database.**

| Item              | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| Database          | MongoDB Atlas (`MONGODB_URI`, optional `MONGODB_DB`, default `mangu`) |
| Driver            | Official `mongodb` Node driver (`lib/mongodb.ts`)                     |
| Hosting           | Vercel (ADR-001); use `attachDatabasePool` where available            |
| Auth (TBD)        | **Not** MongoDB — choose Clerk, Better Auth, or Auth.js before rewrite |
| File storage (TBD)| Vercel Blob or S3 (not Supabase Storage)                              |
| Supabase          | Retain until feature cutover; then remove keys and `@supabase/*`      |

### Automation (preferred — do not click Drivers by hand)

```bash
export ATLAS_PUBLIC_KEY=...   # Atlas Org → Access Manager → API Keys
export ATLAS_PRIVATE_KEY=...
export VERCEL_TOKEN=...       # vercel.com/account/tokens
npm run db:mongo:up           # bootstrap + ping + indexes + Vercel sync
```

Scripts: `scripts/mongo-up.ts`, `atlas-bootstrap.ts`, `mongo-ping.ts`, `mongo-ensure-indexes.ts`, `sync-mongodb-to-vercel.ts`.  
CI: `.github/workflows/mongo-up.yml` (`workflow_dispatch` + repo secrets).

`DATABASE_PROVIDER=mongodb` makes Atlas ping a hard readiness gate; Supabase checks become non-blocking.

### Phased cutover (required)

1. **Scaffold + automation (this PR):** driver, `lib/mongodb.ts`, `db:mongo:up`, health provider switch, ADR.
2. **Operator:** create Atlas API key + Vercel token once; run `npm run db:mongo:up` (or Actions).
3. **Auth product choice** (blocking for query rewrite).
4. **Collection model + seed** (indexes already ensured by `db:mongo:indexes`).
5. **Rewrite data access** off `lib/supabase/*`; retire RLS scripts.
6. **Remove Supabase** env vars, packages, migrations workflows.

## Consequences

- Readiness (`/api/health?ready=1`) continues to require Supabase until Phase 5 of cutover; Mongo ping is additive when `MONGODB_URI` is set.
- G7 / GO cannot flip on Mongo alone — auth + Stripe + Upstash + canonical origin still required.
- Data model changes: no SQL joins/RLS; authorization moves into application code.
- Export/import from Supabase is a separate operator task (CSV/JSON → Compass or scripts).

## Rollback

Keep Supabase credentials and code paths until Mongo + auth prove production readiness. Revert is “undeploy Mongo-only routes / restore prior Vercel deployment”; do not delete the Supabase project until GO evidence is on Mongo.

## Open decisions (operator)

- [ ] Auth: **Clerk** / **Better Auth** / **Auth.js**
- [ ] Storage: **Vercel Blob** / **S3**
- [ ] Atlas Network Access: allow Vercel egress (`0.0.0.0/0` acceptable for free tier if password is strong)
