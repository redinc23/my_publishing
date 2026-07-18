# HUMAN_TASKS — Project Phoenix

Agent-owned code continues while these remain blocked. Exact click-paths from `docs/PROJECT_PHOENIX.md` where applicable.

| ID          | Gate                                                        | Status | Notes                                                                                                                    |
| ----------- | ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| H-D9        | Product decision: roles `partner` vs Phoenix `editor`       | OPEN   | Live schema + partner portal use `partner`. Phoenix Task 1.1 lists `editor`. Confirm before WS1 `additionalFields.role`. |
| H-D8        | Vercel Blob access mode for manuscripts                     | OPEN   | Public UUID paths vs private + `/api/files` proxy only.                                                                  |
| H-D7        | Live Playwright / staging e2e baseline                      | OPEN   | Local e2e needs secrets; CI placeholders are SoR until operator runs against staging.                                    |
| P1.4        | Atlas API key                                               | OPEN   | For `npm run db:mongo:up` (after scaffold merge).                                                                        |
| P1.5        | Vercel token                                                | OPEN   | Env sync / Blob token.                                                                                                   |
| P1.8        | Full Supabase `pg_dump` + storage snapshot (restore-tested) | OPEN   | Pre-cutover.                                                                                                             |
| P5.x        | Run `db:mongo:up\|ping\|indexes` with real Atlas            | OPEN   | Agent writes scripts; human executes.                                                                                    |
| P8.x        | Prod env vars on Vercel + Stripe webhook endpoint           | OPEN   | www already on Vercel per ADR-001.                                                                                       |
| P11.x       | Export / mongoimport / mongosh verify / sign-off            | OPEN   | Agent writes scripts.                                                                                                    |
| Phase 13    | Cloudflare DNS apex cutover + Cloud Run standby             | OPEN   |                                                                                                                          |
| Phase 14–15 | Prod QA matrix, mongodump, token revoke, Supabase pause     | OPEN   |                                                                                                                          |
| Mass reset  | Trigger `send-forced-resets` in prod                        | OPEN   | Agent writes batch script.                                                                                               |

_Created during Phase 0 deep-dive refresh (2026-07-18)._
