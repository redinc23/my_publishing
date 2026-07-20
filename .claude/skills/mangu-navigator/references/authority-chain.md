# Authority chain — which document wins, and known traps

This repo has multiple governance documents written at different times by
different agents. Conflicts between them are *expected* and *documented*. Use
this precedence ladder instead of guessing.

## The ladder (highest wins)

1. **The owner's most recent explicit decision** (Faith Beckwith), wherever
   recorded — currently `HUMAN_TASKS.md` C0.3 and the `CLAUDE.md` status header.
   Owner reactivation/pause of Phoenix beats every doc that says otherwise.
2. **Domain authorities, each supreme in its lane:**
   - Launch/release/GO questions → `docs/NEXT_GO.md` (CCR-001: every companion
     doc is a subordinate snapshot; where they conflict, NEXT_GO wins).
   - Migration scope/order/mechanics → `docs/PROJECT_PHOENIX.md` (its own rule:
     "do not improvise"; if reality conflicts, STOP and amend the doc first).
   - Platform decisions → accepted ADRs (`docs/adr/ADR-001`: **Vercel is
     canonical production**; Cloud Run retained for emergency only. ADR-002:
     Mongo behind `DATABASE_PROVIDER`).
3. **Execution wrappers:** `CLAUDE.md` (Claude/Cursor briefing — wraps the
   Phoenix doc; where they conflict, the Phoenix doc wins, per its own §
   "canonical contract"), `AGENTS.md` (Copilot CLI), `cursorrules`.
4. **Ground-truth inventories:** `docs/PHOENIX_RECON.md`,
   `docs/OPERATOR_QA_LOG.md` (append-only evidence). These report reality;
   when they contradict a plan doc, reality wins and the plan doc gets amended.
5. **Snapshots:** `README.md`, `QUICK_START.md`, launch checklists, DOCX/PDF
   exports — informational only.

**Meta-rule:** documents are snapshots; `git log` is the timeline. When two
records disagree, check which commit is newer and whether the owner signed it.
The newest owner-confirmed record governs.

## Known stale-record traps (verified 2026-07-20)

1. **"Phoenix is paused."** `AGENTS.md` carries an integration note saying the
   paused record governs "unless the owner reactivates." The owner *did*
   reactivate on 2026-07-20 (`CLAUDE.md` header; `HUMAN_TASKS.md` C0.3, quote:
   "we gotta do that migration now"). **Phoenix is ACTIVE.** If you see a doc
   claiming paused, it predates the reactivation.
2. **"Zero Phoenix code is merged."** True in `PHOENIX_RECON.md` at its baseline
   (`9320407`, 2026-07-18); false since PR #304 (`9a8a940`) merged WS1 dual-run.
   The recon's *architecture* findings still hold; its *progress* snapshot
   doesn't. Lesson: re-verify any "current status" line against git.
3. **"Cloud Run is the canonical production path."** `AGENTS.md` still says so.
   Superseded by ADR-001 Option B (ACCEPTED 2026-07-18): **Vercel canonical**,
   Cloud Run/Amplify emergency-only, non-GO-evidence.
4. **Role model includes `editor`.** Old Phoenix doc text only. Live roles are
   `reader | author | partner | admin` (recon D9; Phoenix v4.0.1 amendment).
   Never introduce `editor`.
5. **Two Stripe webhook paths exist** (`app/api/webhook` canonical +
   `app/api/webhooks/`). Treat `/api/webhook` as canonical; don't duplicate
   fulfillment logic.
6. **Migration counts disagree everywhere.** `README.md` lists 15; NEXT_GO §3.1
   says 25 (true at its 2026-07-18 baseline, hosted↔repo exact-match); the tree
   held 33 by 2026-07-20. None of the prose is authoritative — trust
   `ls supabase/migrations | wc -l` and re-verify hosted parity before any
   migration/RLS claim.

## Conflict-resolution procedure

1. Identify the lane (launch? migration? platform? product?) → pick the lane
   authority from the ladder.
2. Check `git log --oneline -- <both files>` for recency and owner sign-off.
3. If reality (code, CI, prod probes) contradicts the winning doc: follow
   reality, and in the *same PR* amend the doc with a `docs(phoenix):` /
   `docs:` commit explaining the delta. Silent divergence is the failure mode
   this repo's whole governance system exists to prevent.
4. If the conflict requires an owner decision (scope, money, irreversible
   actions): write it as a decision request in `HUMAN_TASKS.md` and proceed
   with unblocked work.

## Change-control quick keys

- CCR-001 single authority · CCR-002 append-only evidence · CCR-003 all-true
  GO rule · CCR-004 P0>P1>P2 · CCR-005 exact-SHA evidence · CCR-009 secret
  hygiene · CCR-012 rollback-first · CCR-020 post-change baseline refresh.
  Full list: NEXT_GO §9.
