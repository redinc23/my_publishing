# HUMAN_TASKS — Project Phoenix

Human-owned gates. Agents write scripts and docs; humans operate consoles, credentials, and DNS.
Click-paths reference `docs/PROJECT_PHOENIX.md` unless noted.

**Status legend:** ⬜ pending · 🟡 in progress · ✅ done · ⏸️ blocked

---

## Immediate (unblocks local / scaffold)

| ID | Task | Status | Notes |
| -- | ---- | ------ | ----- |
| H-RECON-1 | Provide local Supabase + Stripe secrets (or confirm CI-only e2e) so Playwright can establish a local baseline | ⬜ | Recon D7 — `npm run dev` → `validate-env` |
| H-P5.2 | Run `npm run db:mongo:up` with Atlas API keys once scaffold lands on a WS branch | ⬜ | Doc P5.2 — agent writes scripts; human runs |
| H-P5.3 | `npm run db:mongo:ping` | ⬜ | |
| H-P5.4 | `npm run db:mongo:indexes` | ⬜ | |

## Phase 1 — prep (from Phoenix §5)

| ID | Task | Status |
| -- | ---- | ------ |
| P1.4 | Create MongoDB Atlas API key | ⬜ |
| P1.5 | Create Vercel token (env sync) | ⬜ |
| P1.7 | Feature-freeze communications to stakeholders | ⬜ |
| P1.8 | Full Supabase `pg_dump` + storage snapshot (restore-tested) | ⬜ |

## Phase 8 — Vercel env / Stripe

| ID | Task | Status |
| -- | ---- | ------ |
| P8.x | Load all Phoenix §9.1 (+ amended SITE_URL / extras) into Vercel Production + Preview | ⬜ |
| P8.x | Point Stripe webhook at Vercel `/api/webhook` (keep Cloud Run standby) | ⬜ |

## Phase 11 — data cutover

| ID | Task | Status |
| -- | ---- | ------ |
| P11.1 | Run `scripts/export-supabase.sh` with `SUPABASE_DB_URL` | ⬜ |
| P11.4 | Production `mongoimport` | ⬜ |
| P11.5 | `mongosh` verification script sign-off | ⬜ |
| P11.6 | Human sign-off on transform report | ⬜ |
| — | Trigger `scripts/send-forced-resets.ts` in prod (rate-limited) | ⬜ |

## Phase 13–15 — cutover / teardown

| ID | Task | Status |
| -- | ---- | ------ |
| P13 | Cloudflare DNS → Vercel; Cloud Run standby 48h | ⬜ |
| P14 | Prod QA matrix, mongodump to cloud storage, token revocation, Supabase pause | ⬜ |
| P15 | Post-mortem | ⬜ |

## Doc decisions needed from humans (recon §10)

| ID | Decision | Status |
| -- | -------- | ------ |
| D8 | Confirm manuscripts stay non-public (proxy-only) even if Blob `put` uses path obscurity | ⬜ |
| D12 | Confirm feature freeze: resonance/MCP/social-beyond-reviews/payouts deferred post-Phoenix unless listed in §1.4 | ⬜ |

---

_Updated with Phase 0 deep dive (`docs/PHOENIX_RECON.md`)._
