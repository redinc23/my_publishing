# HUMAN_TASKS — Project Phoenix

Human-owned gates the coding agent cannot complete. Click-paths reference `docs/PROJECT_PHOENIX.md` where applicable.

Last updated: 2026-07-18 (Phase 0 recon)

---

## Open — Phase 0 / immediate

| ID | Task | Why blocked for agent | Owner action |
| -- | ---- | --------------------- | ------------ |
| H0.1 | Local Playwright baseline against real Supabase | `npm run test:e2e` boots `npm run dev` → `validate-env` needs real secrets | Run `npx playwright test` with populated `.env.local`; paste summary into recon / WS5 notes |
| H0.2 | Product decision: partner vs editor roles (recon **D9**) | Doc says `editor`; repo uses `partner` | Amend Phoenix FRD or rename role before WS1 RBAC |
| H0.3 | Product decision: Vercel Blob `access: 'public'` for manuscripts (recon **D8**) | Security tradeoff | Decide public+UUID vs private Blob + signed URLs before WS3 |

---

## Open — Phoenix §10 consoles / credentials (unchanged)

| ID | Task | Notes |
| -- | ---- | ----- |
| P1.4 | Atlas API key | Console only |
| P1.5 | Vercel token | Console only |
| P1.7 | Feature-freeze communications | |
| P1.8 | Full Supabase `pg_dump` + storage snapshot (restore-tested) | |
| P5.x | Run `npm run db:mongo:up\|ping\|indexes` with real Atlas keys | Agent writes scripts; human runs |
| P8.x | Env vars into Vercel; Stripe webhook endpoint | |
| P11.1 | Supabase exports (`SUPABASE_DB_URL`) | |
| P11.4 | Production `mongoimport` | |
| P11.5 | `mongosh` verification | |
| P11.6 | Migration sign-off | |
| Phase 13 | Cloudflare DNS + Cloud Run standby/teardown | |
| Phase 14–15 | Prod QA matrix, mongodump, token revocation, Supabase pause, post-mortem | |
| Cutover | Mass forced-reset email send in prod | Agent writes batch script; human triggers |

---

## Closed

_(none yet)_
