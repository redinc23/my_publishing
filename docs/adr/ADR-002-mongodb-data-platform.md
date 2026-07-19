# ADR-002: MongoDB Atlas as Application Data Platform (Supabase Retirement)

| Field         | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **Status**    | **PROPOSED → operator-accepted direction (IN PROGRESS)** — scaffold only; cutover not complete |
| **Created**   | 2026-07-18                                                                                     |
| **Updated**   | 2026-07-18 (Atlas cluster + Drivers connection string in progress)                             |
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

### Phased cutover (required)

1. **Scaffold (this PR):** `mongodb` dependency, `lib/mongodb.ts`, env template, optional health ping, ADR.
2. **Operator Atlas:** Network Access allows Vercel (`0.0.0.0/0` or Atlas guidance); `MONGODB_URI` in `.env.local` + Vercel Production (never commit).
3. **Auth product choice** (blocking for query rewrite).
4. **Collection model + seed** (profiles, books, orders, etc. — embed vs reference).
5. **Rewrite data access** off `lib/supabase/*`; retire RLS scripts; update readiness to Mongo + new auth.
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
