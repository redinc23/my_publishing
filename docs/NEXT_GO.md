# MANGU Publishers — Go-Live Execution Authority (Next-Go v3.0)

> **STATUS: NO-GO / NOT RELEASE-READY**  
> **Date:** 17 Jul 2026  
> **Canonical path:** `docs/NEXT_GO.md`  
> **Mirror (operator export):** `~/Downloads/next-go-revamped.md`  
> **Supersedes:** `Downloads/next-go.pdf` (v2 audit snapshot), fragmented `OPERATOR_QA_LOG` checklists as _authority_, `LAUNCH_NOW.md` one-pagers as _authority_, `MASTER_EXECUTION_CHECKLIST.md` Phase 7B as _authority_, Phase 2 handoff docs as _automatic GO_.

---

## Table of contents

1. [Document control](#1-document-control)
2. [Executive decision summary](#2-executive-decision-summary)
3. [Verified baseline (refreshable)](#3-verified-baseline-refreshable)
4. [Corrections register](#4-corrections-register)
5. [Production readiness scorecard (RAG)](#5-production-readiness-scorecard-rag)
6. [Immediate 24–72 hour action sequence](#6-immediate-2472-hour-action-sequence)
7. [Workstream plans](#7-workstream-plans)
8. [Operator setup runbooks](#8-operator-setup-runbooks)
9. [Expected-results catalog (UX / functional truth)](#9-expected-results-catalog-ux--functional-truth)
10. [Feature & enhancement backlog](#10-feature--enhancement-backlog)
11. [Master backlog (P0 / P1 / P2)](#11-master-backlog-p0--p1--p2)
12. [Roadmap, milestones, release gates](#12-roadmap-milestones-release-gates)
13. [Verification matrix](#13-verification-matrix)
14. [Evidence register](#14-evidence-register)
15. [Known unknowns & human decisions required](#15-known-unknowns--human-decisions-required)
16. [Post-push refresh (dirty local commits)](#16-post-push-refresh-dirty-local-commits)
17. [Appendices A–G](#appendices-ag)

---

## 1. Document control

### 1.1 Title, version, status, owners

| Field                     | Value                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **Title**                 | MANGU Publishers — Go-Live Execution Authority (Next-Go v3.0)                             |
| **Version**               | 3.0.0                                                                                     |
| **Status**                | **NO-GO / NOT RELEASE-READY**                                                             |
| **Effective date**        | 2026-07-17                                                                                |
| **Release manager**       | Solo operator (Chris / Mangu Publishers)                                                  |
| **Engineering authority** | This document + `origin/main` after repair merge                                          |
| **Evidence sink**         | `docs/OPERATOR_QA_LOG.md` (append-only)                                                   |
| **Companion strategy**    | `.cursor/plans/mangu_publishers_master_ricef.md` (RICEF program; sync status fields here) |
| **Platform ADR target**   | `docs/CANONICAL_PRODUCTION.md` (Cloud Run; **must be reconciled with live traffic**)      |

**Rule:** No P1 item displaces an open P0. No marketing or README may claim “production-ready” until §12.2 hard gates pass with evidence.

### 1.2 Evidence standard

Every factual claim in this document uses one of four labels:

| Label                 | Meaning                                                                                                     | Example                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **VERIFIED**          | Reproduced in this repo or against a named external system with command output, file path, or deployment ID | `playwright.config.ts` hardcodes `:3000`     |
| **REPORTED**          | Observed by an agent or operator log but not re-run in this session                                         | Vercel prod deploy ERROR at commit `843d7e8` |
| **PROPOSED**          | Recommended action not yet executed                                                                         | Merge PR #183 after rebase                   |
| **LOCAL-UNCOMMITTED** | Present on operator machine / working tree; not on `origin/main`                                            | `lib/auth/register-errors.ts` extraction     |

### 1.3 How to use / reading order by role

| Role                                | Read first                                                  | Then                                                                      |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Solo operator / release manager** | §2 → §6 → §13 Tier R/P → §12.4 sign-off                     | §8 runbooks; append evidence to OPERATOR_QA_LOG                           |
| **Engineering / agent**             | §3 baseline → §4 corrections → §11 P0 backlog               | §7 workstream for your area; §9 expected results for acceptance           |
| **Platform / ops**                  | §7.2 CI/CD → §8.1 Sentry → §13 Tier P                       | `docs/LAUNCH_NOW.md`, `docs/PHASE4_OPERATOR_RUNBOOK.md` (click-path only) |
| **QA**                              | §13 full matrix → §9 expected results → Appendix B patterns | Fill OPERATOR_QA_LOG manual rows 1–10                                     |
| **Product**                         | §10 feature scope → §9.10 coming-soon surfaces              | Sign launch contract before GO                                            |

### 1.4 What this document supersedes

| Artifact                                                       | After v3 lands                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **`Downloads/next-go.pdf` (v2)**                               | Historical audit only — **do not execute from PDF**                    |
| **`docs/OPERATOR_QA_LOG.md`**                                  | Append-only evidence log — **not** the authority for _what to do next_ |
| **`docs/LAUNCH_NOW.md`**                                       | Operator click-path companion — link, do not fork                      |
| **`docs/MASTER_EXECUTION_CHECKLIST.md` Phase 7B**              | Superseded by §13 + §11 P0 items                                       |
| **`docs/phase2/11-handoff-master-checklist.md`**               | Formal Phase 2 cutover — defer Tier H until MVP GO unless required     |
| **`QUICK_START.md` “PRODUCTION READY”**                        | **False for launch** — demote banner to link here                      |
| **`docs/MANGU_PUBLISHERS_END_TO_END.md` May 2026 test counts** | Stale — trust §3 baseline                                              |

### 1.5 Change-control rules

1. Any architecture, platform, or launch-scope change lands in the **same PR** as an update to this document (or a immediate follow-up doc PR).
2. Baseline tables (§3) refresh after every merge to `main` and every production deploy.
3. Evidence register (§14) updates with commit SHA + deployment ID — never “TBD”.
4. Regenerate PDF export (`docs/archive/next-go-v3-YYYYMMDD.pdf`) from Markdown after material edits; Markdown in git is source of truth.

---

## 2. Executive decision summary

### 2.1 Current go/no-go decision

| Decision                 | **NO-GO**                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rationale (one line)** | `origin/main` does not build on Vercel; platform authority conflicts with live traffic; manual auth/checkout/RBAC evidence is empty; CI monitors aim at stale hosts. |
| **Earliest credible GO** | After P0-001 through P0-008 pass with packaged evidence (§12.2)                                                                                                      |

### 2.2 Top P0 decisions (ordered)

| #   | Decision                                                                          | Status                                                         |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | **Recover green build on `main`** — server-action sync export blocker             | LOCAL-UNCOMMITTED fix exists; **not on `origin/main`**         |
| 2   | **Autofix PR hygiene** — merge **one** repair vehicle; close #178–#182 duplicates | **PROPOSED** — PR #183 candidate                               |
| 3   | **Platform ADR lock** — Cloud Run vs Vercel; single prod traffic path             | **BLOCKED** — docs say Cloud Run; `www` observed on Vercel     |
| 4   | **Migration history reconciliation** — renames + hosted apply evidence            | **AMBER** — MCP apply REPORTED; rename drift LOCAL-UNCOMMITTED |
| 5   | **Preview E2E targeting** — `BASE_URL` + no localhost webServer on preview runs   | **RED** — `playwright.config.ts` ignores env BASE_URL          |
| 6   | **Launch-critical manual QA** — auth → purchase → library → read                  | **RED** — OPERATOR_QA_LOG rows 1–10 unchecked                  |
| 7   | **Public trust fixes** — contact/newsletter false-success; hardcoded stats        | **RED** — still present on tree                                |
| 8   | **CI governance** — bug-to-issue workflow name; health/lighthouse URLs            | **RED** — miswired                                             |

### 2.3 What is already true vs still blocked

**Already true (VERIFIED / LOCAL-UNCOMMITTED):**

- Unit tests **63/63** pass on working tree (`docs/OPERATOR_QA_LOG.md` 2026-07-17).
- `lib/auth/register-errors.ts` extracts `toFriendlyRegisterError` — fixes Next.js “sync export in use server file” build error **locally**.
- Auth uses Supabase email/password; `/callback` is **code-only PKCE** (`exchangeCodeForSession`), not `token_hash`.
- `resolveAuthOrigin()` prefers request host (`x-forwarded-host` / `host`) over `NEXT_PUBLIC_SITE_URL`; local fallback **port 3001**.
- Confirm-email ON → register returns `needsVerification`; no session cookies at signup.
- `orders.user_id` = `profiles.id` (FK); entitlement helpers document this.
- Upstash auth rate limits **fail-closed in production** (`lib/rate-limit.ts`, `lib/utils/auth-rate-limit.ts`).
- Stripe webhook at **`/api/webhook`** (not `/api/stripe/webhook`); **4 handled events**.
- Partner portal routes exist with RBAC; CSV export is **partner-only** (admin gets 403).
- Hosted Supabase migrations for RLS/role protection applied via MCP (REPORTED in OPERATOR_QA_LOG).

**Still blocked:**

- Vercel production deploy from `main` @ `843d7e8` **ERROR** (REPORTED — PDF E-04).
- Open autofix PRs #178–#183 (+ overlaps #173, #174) create merge noise.
- Manual browser QA for register/login/checkout **never signed off**.
- Playwright dev **3000** vs operator dev helper **3001** — port drift.
- `health-check.yml` + `lighthouse-ci.yml` target **`manguprojectz.vercel.app`** (stale).
- `bug-to-issue.yml` listens for **`CI/CD Pipeline`**; actual workflow name is **`CI`**.
- GCP Cloud Run deploy path blocked without `gcloud auth login` as `renee@mangu-publishers.com`.
- Contact form **not persisted**; newsletter **fake success**; homepage stats **hardcoded**.

### 2.4 Immediate “do this first” one-pager

```
DAY 0 (today)
  □ Rebase local branch onto origin/main; resolve register-errors vs PR #183 (pick ONE vehicle)
  □ Split PR: (a) build fix only, (b) hardening, (c) migration renames, (d) docs
  □ Close duplicate autofix PRs #178–#182 after cherry-pick or supersede
  □ Run L1–L4 (§13 Tier L) on clean solo install (Node ≥22, port 3001)

DAY 1
  □ Merge build-fix PR → confirm Vercel/preview READY (not ERROR)
  □ Fix bug-to-issue workflow name → `CI`
  □ Retarget health-check + lighthouse to canonical prod URL (after ADR)
  □ Fix preview-e2e: honor BASE_URL; disable webServer for remote target

DAY 2–3
  □ Execute Tier R manual QA (§13) — fill OPERATOR_QA_LOG rows 1–10
  □ Phase 7A auth evidence table (§9.2) BEFORE purchase QA
  □ Stripe test purchase → completed order → library → /reading entitlement
  □ Platform ADR signed → single DNS target

GO gate: §12.2 all TRUE + sign-off §12.4
```

---

## 3. Verified baseline (refreshable)

**Refresh commands:**

```bash
git -C c:/Users/chris/my_publishing fetch origin
git -C c:/Users/chris/my_publishing log -1 --oneline
git -C c:/Users/chris/my_publishing status -sb
gh pr list --state open --limit 15
```

### 3.1 Repository / branch / commit

| Field                            | Value                                                                      | Evidence                   |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------- |
| **Local branch**                 | `cursor/reorder-supabase-migrations`                                       | VERIFIED git               |
| **Local HEAD**                   | `273ec9d` — _Harden auth, admin, partner, and API routes…_                 | VERIFIED git               |
| **`main` vs `origin/main`**      | **behind 4** (snapshot 2026-07-17)                                         | VERIFIED git               |
| **`origin/main` tip (REPORTED)** | `843d7e8` — Vercel build **ERROR** (sync export in register actions)       | REPORTED PDF v2 E-04       |
| **Dirty tree**                   | Extensive modified + untracked (~57 files, +1799/−269 per OPERATOR_QA_LOG) | LOCAL-UNCOMMITTED          |
| **Build blocker fix**            | `lib/auth/register-errors.ts` + import in `app/(auth)/register/actions.ts` | LOCAL-UNCOMMITTED VERIFIED |

### 3.2 Open PR inventory

| PR         | Title                                                    | State  | Action                                                |
| ---------- | -------------------------------------------------------- | ------ | ----------------------------------------------------- |
| **#183**   | fix(ci): resolve build and format check failures on main | OPEN   | **Primary recovery candidate** — compare vs local fix |
| #182       | fix(ci): build, format, Supabase migration CI            | OPEN   | Close after #183 or local supersedes                  |
| #181       | fix(ci): build, format, Supabase Preview                 | OPEN   | Close duplicate                                       |
| #180       | fix(ci): build failure and format check                  | OPEN   | Close duplicate                                       |
| #179       | fix(ci): build, format, Supabase migration               | OPEN   | Close duplicate                                       |
| #178       | fix(ci): TypeScript and Prettier failures                | OPEN   | Close duplicate                                       |
| #173, #174 | autofix overlaps                                         | OPEN   | Triage / close                                        |
| #167+      | Dependabot majors (openai, etc.)                         | OPEN   | **Defer** until post-GO freeze lifts                  |
| #170       | fix(ci): all failing checks — **MERGED**                 | MERGED | Reference only                                        |

### 3.3 Deployment state

| Surface                             | State                                       | Evidence                                      |
| ----------------------------------- | ------------------------------------------- | --------------------------------------------- |
| **Vercel `manguprojectz`**          | Prod deploy **ERROR** from main @ `843d7e8` | REPORTED PDF                                  |
| **Vercel previews**                 | May be READY on feature branches            | REPORTED                                      |
| **Live `www.mangu-publishers.com`** | Served via **Vercel** (server header)       | REPORTED OPERATOR_QA_LOG                      |
| **Cloud Run `mangu-publishers`**    | Declared canonical; cutover **unproven**    | `docs/CANONICAL_PRODUCTION.md`                |
| **Health monitors**                 | Cron hits **`manguprojectz.vercel.app`**    | VERIFIED `.github/workflows/health-check.yml` |

### 3.4 Operating-mode conflict (docs vs live traffic)

| Doc claim                                           | Reality                                              | Verdict                    |
| --------------------------------------------------- | ---------------------------------------------------- | -------------------------- |
| `CANONICAL_PRODUCTION.md`: Vercel retired (PR #144) | Vercel still receives prod traffic; main build fails | **ADR required**           |
| `QUICK_START.md`: PRODUCTION READY                  | Manual QA empty; deploy blocked                      | **Demote**                 |
| `DEPLOYMENT.md`: mixed Vercel/Cloud Run steps       | Operator confusion                                   | Consolidate to ADR outcome |

### 3.5 Code/config facts that affect release

| Fact                                                       | Location                                                                                                     | Label                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Server-action sync export blocked remote main              | `app/(auth)/register/actions.ts` exported helper                                                             | REPORTED on main; **fixed LOCAL-UNCOMMITTED** |
| PKCE callback code-only                                    | `app/(auth)/callback/route.ts`                                                                               | VERIFIED                                      |
| `emailRedirectTo` uses `resolveAuthOrigin()`               | register, verify-email, reset-password actions                                                               | VERIFIED                                      |
| Local dev default port **3001**                            | register/verify actions fallback                                                                             | VERIFIED                                      |
| Playwright **3000** hardcoded                              | `playwright.config.ts`                                                                                       | VERIFIED                                      |
| Preview E2E sets `BASE_URL` but Playwright ignores it      | `preview-e2e.yml` + `playwright.config.ts`                                                                   | VERIFIED                                      |
| Preview E2E sets `USE_MOCKS=true` against real preview URL | `preview-e2e.yml`                                                                                            | VERIFIED — false confidence risk              |
| Webhook 4 events                                           | `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `payment_intent.payment_failed` | VERIFIED                                      |
| Stripe Connect **not** checkout-ready                      | `lib/stripe/server.ts` — standard Checkout only                                                              | VERIFIED                                      |
| Middleware RBAC: partner OR admin read partner routes      | `middleware.ts`                                                                                              | VERIFIED                                      |
| Partner CSV export: **partner role only**                  | `app/(portals)/partner/orders/export/route.ts`                                                               | VERIFIED — admin → 403                        |
| Entitlement enforced at **`/reading/[bookId]`** only       | `lib/reading/entitlement.ts`                                                                                 | VERIFIED                                      |
| **Start Reading** on book detail **not** purchase-gated    | `app/(consumer)/books/[slug]/page.tsx`                                                                       | VERIFIED — link always shown                  |
| Contact logs, does not persist                             | `app/(consumer)/contact/actions.ts`                                                                          | VERIFIED                                      |
| `.nvmrc` / CI Node vs `@supabase/auth-js` ≥22              | OPERATOR_QA notes                                                                                            | REPORTED conflict                             |

### 3.6 Local dirty-tree inventory (high-signal)

| Area           | Files / notes                                                                             |
| -------------- | ----------------------------------------------------------------------------------------- |
| **Auth**       | `register/actions.ts`, `verify-email/actions.ts`, **`lib/auth/register-errors.ts` (new)** |
| **Consumer**   | about, authors, blog, books, contact, discover, genres, library — SEO/a11y                |
| **Partner**    | dashboard, catalogs, arc-requests, orders, orders/[id]                                    |
| **API**        | health, webhook, resonance/recommend                                                      |
| **Infra**      | middleware, playwright.config, e2e.yml, bug-to-issue.yml                                  |
| **Migrations** | Renames under `supabase/migrations/` (timestamp reorder)                                  |
| **Tests**      | unit + e2e hardening suites → 63/63                                                       |

---

## 4. Corrections register

| ID  | Wrong claim                    | Correct claim                                                             | Evidence                                    |
| --- | ------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------- |
| C1  | Main builds                    | **`843d7e8` Vercel ERROR** — sync export in `use server` register/actions | PDF E-04; local fix in `register-errors.ts` |
| C2  | Local tree unverifiable        | **57-file wave documented**; LOCAL-UNCOMMITTED                            | OPERATOR_QA_LOG 2026-07-17                  |
| C3  | CI = only `ci.yml`             | **19 workflows** exist; governance/required-checks is the gap             | `.github/workflows/`                        |
| C4  | Homepage stats single source   | **`Stats.tsx` AND `StatsBar.tsx` disagree** (50k books vs 10k books)      | components                                  |
| C5  | Sentry not implemented         | **SDK wired**; gap is operator DSN/token/verify                           | `next.config.js`, `sentry.*.config.ts`      |
| C6  | Node 20 everywhere             | **`.nvmrc` 22**, engines `>=20`, auth-js wants **≥22**                    | package.json, OPERATOR_QA                   |
| C7  | Cloud Run only                 | **Vercel still prod traffic** + failing main deploy                       | CANONICAL vs OPERATOR_QA                    |
| C8  | Preview E2E only BASE_URL bug  | **Also `USE_MOCKS=true` on real preview**                                 | preview-e2e.yml                             |
| C9  | Autofix = #178–#183 only       | **Also #173, #174** overlaps                                              | gh pr list                                  |
| C10 | Merge #183 blindly             | **Diff vs local hardening** — rebase strategy required                    | git status                                  |
| C11 | Migration stubs OK             | **Renames + MCP apply** need reconciliation, not blind stubs              | supabase/migrations                         |
| C12 | Contact saves                  | **Logs only** — returns success UI anyway                                 | contact/actions.ts                          |
| C13 | Newsletter works               | **Sleep + fake success**                                                  | NewsletterCTA.tsx                           |
| C14 | Rate limit IP trusted          | **Raw x-forwarded-for** — spoofable                                       | middleware.ts                               |
| C15 | Anon key = secret leak         | **Public by design**; risk = fallbacks + RLS                              | PDF correction retained                     |
| C16 | Webhook at /api/stripe/webhook | **`/api/webhook`**                                                        | app/api/webhook/route.ts                    |
| C17 | Partner portal placeholder     | **Functional routes**; docs still say placeholder                         | partner pages vs old docs                   |
| C18 | E2E doc: 12 tests              | **63 unit tests**, multi-spec Playwright in CI                            | OPERATOR_QA_LOG                             |
| C19 | bug-to-issue works             | Listens **`CI/CD Pipeline`**; workflow named **`CI`**                     | bug-to-issue.yml, ci.yml                    |
| C20 | Health checks prod             | Targets **`manguprojectz.vercel.app`**                                    | health-check.yml                            |
| C21 | Dev port 3000                  | **Operator solo dev on 3001**                                             | .start-next-3001.cmd, register actions      |
| C22 | `/partner` index               | **No `/partner` landing** — deep links only                               | app routes                                  |
| C23 | ARC admin approval             | **Create + read only** — no admin approval workflow                       | partner arc-requests                        |
| C24 | Partner catalog scoped         | **All published public books** — not agreement-scoped                     | partner/catalogs                            |

---

## 5. Production readiness scorecard (RAG)

**Legend:** 🟢 Green · 🟡 Amber · 🔴 Red · ⚪ Not assessed

| #    | Dimension                             | RAG          | Assessment                                                                                                                                                                                                                                                                      | Shortest path to green                                                                              |
| ---- | ------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 5.1  | **Build & release**                   | 🔴           | Remote main fails Vercel compile; local fix uncommitted                                                                                                                                                                                                                         | Land `register-errors.ts` on main; verify deploy READY                                              |
| 5.2  | **CI & automation governance**        | 🔴           | bug-to-issue dead; stale monitor URLs; preview E2E broken                                                                                                                                                                                                                       | Fix workflow names/URLs; BASE_URL in Playwright                                                     |
| 5.3  | **Security & privacy**                | 🟡           | RLS migrations applied REPORTED; IP trust weak; false-success forms                                                                                                                                                                                                             | Trusted proxy; remove fake success; RLS negative tests                                              |
| 5.4  | **Database & migrations**             | 🟡           | Hosted `tkzvikozrcynhwsqtkqp`: **22 applied**, latest `20260717114221`; local **25** SQL files; **P0 pending** `20260717114300_order_items_select_own.sql`; RLS_NO_POLICY on `order_items` + social/content tables; SECURITY DEFINER advisor ERRORs; `docs/MIGRATIONS.md` stale | Apply pending order_items policy; export history; update MIGRATIONS.md; decide deny-all vs policies |
| 5.5  | **Automated testing**                 | 🟡           | 63/63 unit LOCAL-UNCOMMITTED; E2E mock-only in CI; purchase commented out                                                                                                                                                                                                       | Commit tests; enable purchase E2E with secrets                                                      |
| 5.6  | **Product completeness & trust**      | 🔴           | Placeholder blog/clubs; empty genres; hardcoded stats; Start Reading ungated                                                                                                                                                                                                    | Launch scope cut/flag; fix stats or remove                                                          |
| 5.7  | **Observability & incident response** | 🟡           | `/api/health?ready=1` exists; Sentry gated not configured; stale synthetics                                                                                                                                                                                                     | §8.1 Sentry; retarget health cron                                                                   |
| 5.8  | **Runtime & dependencies**            | 🟡           | Node **22** in `.nvmrc` / Cloud Build; `package.json` engines still `>=20` (footnote); Next 14 audit vulns deferred                                                                                                                                                             | Align engines to `>=22` or document mismatch; plan Next upgrade post-GO                             |
| 5.9  | **Documentation & operating model**   | 🟡           | This doc restores authority; Amplify/Vercel guides NON-authoritative; many stale siblings remain                                                                                                                                                                                | Demote contradictions per §1.4 + Appendix E                                                         |
| 5.10 | **Overall verdict**                   | 🔴 **NO-GO** | —                                                                                                                                                                                                                                                                               | §6 sequence → §12.2 gates                                                                           |

### 5.4 Database & migrations — expanded assessment

| Signal                        | Value                                                                                                                                        | Label                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Hosted project                | `mangu-publishers` / `tkzvikozrcynhwsqtkqp` (us-west-1, Postgres 17, ACTIVE_HEALTHY)                                                         | REPORTED (Supabase MCP)           |
| Hosted migrations             | **22** applied; tip `20260717114221_revoke_anon_update_reading_progress`                                                                     | REPORTED                          |
| Local migration files         | **25** `.sql` under `supabase/migrations/`                                                                                                   | LOCAL-UNCOMMITTED / VERIFIED      |
| Catalog seed                  | **3** published public books; **7** profiles (admin/author/partner/reader mix)                                                               | REPORTED                          |
| Orders                        | 2 orders / 2 order_items rows exist                                                                                                          | REPORTED                          |
| **P0 gap**                    | `20260717114300_order_items_select_own.sql` **not applied** — RLS on `order_items` with **no policy** → nested item reads via user JWT empty | REPORTED + LOCAL-UNCOMMITTED file |
| Deny-all (intentional or gap) | Social tables, `book_content`, `reading_sessions`, `resonance_vectors`, `engagement_events` = RLS_NO_POLICY                                  | REPORTED advisor                  |
| SECURITY DEFINER              | Views `book_overview`, `book_stats_summary`, `public_profiles` still advisor ERROR after harden migration                                    | REPORTED                          |
| Doc drift                     | `docs/MIGRATIONS.md` stops at retailer URLs (Jun); status docs still say “15 files”                                                          | VERIFIED stale                    |
| Seed command                  | `npm run db:seed -- --create-profiles --minimal`                                                                                             | VERIFIED script                   |
| RLS verify                    | `npm run verify-rls` (PostgREST probes; soft-pass limitation on `pg_policies`)                                                               | VERIFIED script                   |

**Operator apply next (only the pending policy — do not re-run full history on prod):**

```bash
# Paste supabase/migrations/20260717114300_order_items_select_own.sql in SQL Editor
# or MCP apply_migration for that file only
npm run verify-rls
```

Confirm:

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'order_items';
-- expect: "Users can view own order items" / SELECT
```

Full operator SQL audit queries: §7.4.

---

## 6. Immediate 24–72 hour action sequence

### 6.1 Freeze / triage rules

- **Freeze** new feature PRs until P0-001 (green main build) passes.
- **Allow** doc-only, CI wiring, and minimal build-fix PRs.
- **Close** duplicate autofix PRs (#178–#182) when one vehicle merges.
- **Do not** batch build fix + migration renames + hardening into one mega-PR.

### 6.2 Minimal repair path (PR vs local commit)

| Option                                                    | When to use                                      | Exit evidence                                  |
| --------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| **A: Merge PR #183**                                      | If diff ⊆ local fix + no conflict with hardening | Main deploy READY on Vercel or chosen platform |
| **B: Local PR from `cursor/reorder-supabase-migrations`** | If local already contains #183 fix + more        | Same + CI green on branch                      |
| **C: Cherry-pick register-errors only**                   | Fastest unblock                                  | Single-file PR green CI                        |

**Mandatory:** Diff `register-errors` pattern vs #183 before choosing.

### 6.3 Production redeploy verification

**Canonical production constants (VERIFIED `docs/CANONICAL_PRODUCTION.md` + `cloudbuild.yaml`):**

| Constant                       | Value                                      |
| ------------------------------ | ------------------------------------------ |
| GCP project                    | `delta-wonder-488420-i3`                   |
| Region                         | `us-central1`                              |
| Service                        | `mangu-publishers`                         |
| Domain                         | `https://mangu-publishers.com`             |
| Stripe webhook                 | `https://mangu-publishers.com/api/webhook` |
| Operator GCP account           | `renee@mangu-publishers.com`               |
| Node in Cloud Build / `.nvmrc` | **22** (not 20)                            |

**Deploy ONLY this path** (after merge to `main`):

```bash
gcloud auth login                    # renee@mangu-publishers.com
gcloud config set project delta-wonder-488420-i3
./scripts/sync-gcp-secrets-from-env.sh
# Grant Cloud Run SA secret access (script MISSING — use inline fallback below)
./scripts/gcloud-build-submit.sh     # NOT raw `gcloud builds submit` — needs _NEXT_PUBLIC_* substitutions
```

**Do not** treat Amplify (`docs/AWS_AMPLIFY_DEPLOYMENT.md`) or Vercel as production release authorities. `www` still observed on Vercel (REPORTED QA) — **DNS cutover only after Cloud Run verify**.

**Missing scripts (VERIFIED absent under `scripts/`):**

| Expected script                   | Status      | Inline fallback                                         |
| --------------------------------- | ----------- | ------------------------------------------------------- |
| `verify-gcp-production.sh`        | **Missing** | Curl probes below + `gcloud run services describe`      |
| `grant-cloudrun-secret-access.sh` | **Missing** | IAM bind Cloud Run runtime SA to Secret Manager secrets |

```bash
# Inline verify (replaces missing verify-gcp-production.sh)
PROJECT=delta-wonder-488420-i3
REGION=us-central1
SERVICE=mangu-publishers
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url,status.latestReadyRevisionName)'
curl -sfS "https://mangu-publishers.com/api/live"                    # liveness — always 200
curl -sfS "https://mangu-publishers.com/api/health?ready=1"          # readiness — NOT plain /api/health
# Expect ready:true; status healthy|degraded. Prefer healthy for payment launch.
# Plain /api/health is startup probe only (always 200, no deps) — do NOT use for GO gates.

# Inline secret IAM (replaces missing grant-cloudrun-secret-access.sh)
# PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
# SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
# for SECRET in supabase-service-role-key stripe-secret-key stripe-webhook-secret \
#   upstash-redis-rest-url upstash-redis-rest-token resend-api-key openai-api-key; do
#   gcloud secrets add-iam-policy-binding "$SECRET" --project "$PROJECT" \
#     --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor" || true
# done
```

**Health semantics (VERIFIED code):**

| Endpoint              | Role                                           | Gate use                 |
| --------------------- | ---------------------------------------------- | ------------------------ |
| `/api/live`           | Liveness                                       | LB / Cloud Run probe     |
| `/api/health`         | Startup only                                   | **Not** a readiness gate |
| `/api/health?ready=1` | Full readiness (env/DB/auth/migrations/Stripe) | **Required** for GO      |

### 6.4 Migration reconciliation path

1. Export Supabase migration history (hosted `schema_migrations`).
2. Compare to local `supabase/migrations/*.sql` (**25** files after renames).
3. Document each rename (`create_books` stub → `…000001`, storage → `…000007`, Jul-17 timestamp reshuffle).
4. **No blind no-op stubs** — only applied SQL with evidence.
5. **P0:** apply pending `20260717114300_order_items_select_own.sql` only (do not re-run full set).
6. Update `app/api/health/route.ts` migration comment block (currently stale) + `docs/MIGRATIONS.md`.
7. Full procedure: Appendix B.

### 6.5 Preview E2E targeting fix

**Required changes (PROPOSED):**

1. `playwright.config.ts`: `baseURL: process.env.BASE_URL || 'http://localhost:3000'`
2. `webServer`: disable when `BASE_URL` set and not localhost
3. `preview-e2e.yml`: remove `USE_MOCKS=true` for real preview URL **or** document as smoke-only

### 6.6 Platform ADR lock

Record decision in `docs/adr/ADR-001-canonical-production.md` (create):

- **Option A:** Cloud Run prod + Vercel preview-only
- **Option B:** Vercel prod until Cloud Run parity proven
- **Must include:** DNS owner, webhook URL, secret store, rollback command

### 6.7 Public trust fixes

| Item          | Fix                                   | Priority |
| ------------- | ------------------------------------- | -------- |
| Contact form  | Persist to DB or show “not available” | P0-012   |
| Newsletter    | Wire API or disable success state     | P0-013   |
| Stats         | Query real counts or remove claims    | P0-014   |
| Start Reading | Gate link or show purchase CTA        | P1-006   |

### 6.8 Launch-critical manual QA kickoff

Execute §13 Tier R before any public marketing push. **Phase 7A auth evidence table (§9.2) must be complete before purchase QA (R5).**

### 6.9 Status ledger publication

After each tranche: update §3 baseline, §14 evidence register, append OPERATOR_QA_LOG.

---

## 7. Workstream plans

### 7.1 Release governance & PR hygiene

- One open autofix per failure signature.
- Branch protection: require CI + E2E (mock) on `main`.
- Release/rollback owner: solo operator (document revision IDs).

### 7.2 CI/CD & deployment architecture

**Authority:** Cloud Run via `cloudbuild.yaml` + `./scripts/gcloud-build-submit.sh` is **canonical**. Amplify and Vercel are **NON-authoritative legacy** for production release (see §6.3). ADR must still resolve live `www` on Vercel (REPORTED) vs docs.

| Path                        | Role                            | Notes                                                                                                |
| --------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Cloud Run / Cloud Build** | Canonical prod                  | lint → type-check → build → secret audit → Docker → Trivy → deploy; probes `/api/live`               |
| **Vercel**                  | Secondary / observed live `www` | `manguprojectz` prod **ERROR** from main; preview READY; do not treat as release authority until ADR |
| **AWS Amplify**             | Legacy                          | `AWS_AMPLIFY_DEPLOYMENT.md` contradicts canonical — demote                                           |
| **GitHub `deploy.yml`**     | Alternate Cloud Run             | SA key env injection — different from Secret Manager Cloud Build path                                |

**Env matrix (from `lib/utils/env-validation.ts` + `cloudbuild.yaml` + submit script):**

| Variable                             | validate-env                                         | Cloud Build bake                | Cloud Run runtime                       |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------- | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | required                                             | substitution                    | env                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | required                                             | substitution                    | env                                     |
| `SUPABASE_SERVICE_ROLE_KEY`          | required                                             | —                               | Secret `supabase-service-role-key`      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | requiredUnlessMocks                                  | substitution                    | env                                     |
| `STRIPE_SECRET_KEY`                  | requiredUnlessMocks                                  | —                               | Secret `stripe-secret-key`              |
| `STRIPE_WEBHOOK_SECRET`              | optional in validator; **P0 for payments**           | —                               | Secret `stripe-webhook-secret`          |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`  | requiredUnlessMocks                                  | —                               | Secrets if present (**P0 fail-closed**) |
| `NEXT_PUBLIC_SITE_URL`               | optional in validator; **required by submit script** | substitution                    | env                                     |
| `OPENAI_API_KEY` / `RESEND_API_KEY`  | optional                                             | —                               | optional secrets                        |
| `NEXT_PUBLIC_SENTRY_DSN`             | optional                                             | build-arg                       | baked if set                            |
| `USE_MOCKS` / `SKIP_EMAILS`          | local/CI only                                        | **must not** ship in prod image | —                                       |

**CI governance gaps (VERIFIED):**

- **19 workflows** exist — not only `ci.yml`. Required checks must match reality.
- `bug-to-issue.yml` listens for workflow name **`CI/CD Pipeline`**; actual name is **`CI`** → dead automation.
- `health-check.yml` + `lighthouse-ci.yml` target **`https://manguprojectz.vercel.app`** and often hit `/api/health` without `?ready=1` — **must retarget** to `mangu-publishers.com` + readiness URL after ADR.
- Preview E2E: honor `BASE_URL`; stop `USE_MOCKS=true` against real previews (§6.5).
- Node: CI/workflows should read **`.nvmrc` = 22**; stop claiming Node 20.

**Acceptance:** One canonical prod path; noncanonical cannot auto-prod; D1–D8 (§13.9) green on release SHA.

### 7.3 Security, privacy, abuse controls

#### API inventory (14 routes under `app/api/**` — VERIFIED)

| Path                                            | Auth                       | Rate limit  | Notes                                            |
| ----------------------------------------------- | -------------------------- | ----------- | ------------------------------------------------ |
| `/api/live`                                     | Public                     | None        | Liveness                                         |
| `/api/health`                                   | Public                     | None        | `?ready=1` leaks diagnostic detail (P1)          |
| `/api/session`                                  | Cookie                     | None        | User + profile                                   |
| `/api/checkout`                                 | Session = body `user_id`   | None        | Stripe session                                   |
| `/api/webhook` (+ `/api/webhooks/stripe` alias) | Stripe sig                 | `webhook`   | Service role; idempotent                         |
| `/api/upload`                                   | Session                    | `upload`    | Admin storage; 50MB                              |
| `/api/resonance/recommend`                      | Optional; client `user_id` | `api`       | Do not trust unmatched `user_id`                 |
| `/api/resonance/similar`                        | Public                     | None        | Catalog                                          |
| `/api/resonance/track`                          | Optional match             | `api`       | Service role insert                              |
| `/api/resonance/embed`                          | Admin                      | None        | OpenAI                                           |
| `/api/analytics/track`                          | Optional                   | `analytics` | Stores IP/UA                                     |
| `/api/analytics/stream`                         | Author/admin               | None        | SSE                                              |
| `/api/mcp/[transport]`                          | **None**                   | None        | **Public MCP** — decide disable or restrict (P1) |

Also: partner CSV `app/(portals)/partner/orders/export/route.ts`; auth `app/(auth)/callback/route.ts`.

#### P0 security gates before traffic

1. **Upstash** (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) — production **fail-closed** → 503 on auth/upload/API/webhook limits if missing.
2. **`STRIPE_WEBHOOK_SECRET`** as `whsec_…` — webhook returns **503** if missing; orders never complete.
3. Live Stripe keys + webhook pointed at **`/api/webhook`**.
4. `SUPABASE_SERVICE_ROLE_KEY` server-only; never `NEXT_PUBLIC_*`.
5. `NEXT_PUBLIC_SITE_URL` = real production origin.
6. `USE_MOCKS` must not be `true` in prod.
7. `npm run validate-env` + `/api/health?ready=1` → `ready: true`.
8. `npm run verify-rls` against prod.

#### P1 security / privacy

| Item                                                            | Why                                                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Unauthenticated `/api/mcp/*`                                    | Public catalog tools; abuse/DoS; no rate limit — **disable, auth, or network-restrict**                                                    |
| `exportAnalyticsData` / `exportReaderData`                      | Compare `books.author_id` to **auth uid** — wrong ID space (`author_id` = `authors.id`); revenue export correctly resolves profile→authors |
| `/api/health?ready=1` public diagnostics                        | Leaks missing env names, DB/Stripe error detail                                                                                            |
| Upload `getPublicUrl`                                           | Manuscript exposure if `manuscripts` bucket public                                                                                         |
| Remove prod Supabase URL/anon **fallbacks** in `next.config.js` | Wrong-project pin risk                                                                                                                     |
| Trusted proxy for `x-forwarded-for`                             | Appendix C                                                                                                                                 |

#### Sentry

Opt-in when DSN set: `next.config.js` wraps `withSentryConfig` only if DSN present (VERIFIED). Operator setup §8.1. Gap is DSN/token/verify — not SDK absence.

#### Middleware notes

- Fail-closed rate limits for auth POSTs + upload; portal RBAC.
- Most `/api/*` self-enforce; on middleware exception, `/api` proceeds as public — defense-in-depth gap (P3).
- CSP allows Sentry ingest; still `'unsafe-inline'` / `'unsafe-eval'` (Next constraint).

### 7.4 Database, migrations, RLS, backups

#### Hosted vs local

| Location                   | Count / tip                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Hosted `schema_migrations` | **22** applied; tip `20260717114221_revoke_anon_update_reading_progress`                    |
| Local files                | **25** `.sql`                                                                               |
| Pending P0                 | `20260717114300_order_items_select_own.sql`                                                 |
| Local stubs not in hosted  | `20260116000001_create_books_table.sql`, `20260117000007_storage_policies.sql` (`SELECT 1`) |

**July harden wave already on hosted (REPORTED OPERATOR_QA_LOG):** `protect_profiles_role`, `tighten_analytics_sessions_rls`, `public_read_authors`, `fix_review_stats_trigger`, `revoke_anon_update_reading_progress`, plus earlier `enable_rls_on_exposed_tables` / `harden_definer_views_and_rpcs`.

#### RLS risks

| Priority | Item                                                                                      |
| -------- | ----------------------------------------------------------------------------------------- |
| P0       | Apply `order_items_select_own` — library/order nested reads empty without it              |
| P1       | Decide policies vs service-role-only for social / `book_content` / engagement / resonance |
| P1       | Triage SECURITY DEFINER view ERRORs + anon EXECUTE WARNs                                  |
| P1       | Seed comics/papers or accept book-only demo                                               |
| P2       | Update `docs/MIGRATIONS.md` (25 local / 22 applied); regenerate `types/database.ts`       |
| P2       | Enable Auth leaked-password protection                                                    |

#### Operator SQL / verify steps

```sql
-- A. Catalog / roles smoke
SELECT title, slug, status, visibility, content_type FROM books;
SELECT role, count(*) FROM profiles GROUP BY 1;

-- B. RLS inventory
SELECT c.relname AS table_name,
  CASE
    WHEN NOT c.relrowsecurity THEN 'RLS_OFF'
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.tablename = c.relname AND p.schemaname = 'public'
    ) THEN 'RLS_NO_POLICY'
    ELSE 'OK'
  END AS rls_state
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY 2 DESC, 1;
```

```bash
npm run verify-rls
npm run db:seed -- --create-profiles --minimal --skip-embeddings   # staging preferred
curl -sfS "https://mangu-publishers.com/api/health?ready=1"
```

**Backups:** document Supabase plan RPO/RTO + one restore drill (P1). Prefer `bundle-migrations.sh` / SQL Editor over `npm run db:migrate` (needs `exec_sql` RPC usually absent on hosted).

### 7.5 Testing & quality engineering

- Pyramid: 63 unit → mock E2E → real-backend E2E (secrets) → manual Tier R.
- Fix port 3000/3001 split: align Playwright with `.start-next-3001.cmd` or document env `PORT=3001`.
- Purchase flow E2E: uncomment when Stripe test creds in CI secrets.

### 7.6 Product completeness & customer trust

- Honest empty states (genres, catalog seed).
- Portal error UI (admin/partner) — LOCAL-UNCOMMITTED improvements.
- Feature flags for coming-soon surfaces (§10).

### 7.7 Observability

- Liveness: `/api/live`
- Readiness: `/api/health?ready=1` (env, db, auth, migrations, stripe)
- Sentry: §8.1
- Synthetics: fix health-check.yml target

### 7.8 Runtime, Node contract, containers, supply chain

- **Canonical runtime: Node 22** — root `.nvmrc`, `blockers/.nvmrc`, Cloud Build `node:22`, CI should read `.nvmrc`.
- **Footnote (mismatch):** `package.json` `engines` still `>=20.0.0` — either bump to `>=22` or keep explicit footnote in ops docs until fixed (LOCAL-UNCOMMITTED docs already say 22).
- `@supabase/auth-js` wants Node ≥22 locally (REPORTED OPERATOR_QA_LOG).
- npm audit: vulns in Next 14 chain — defer Next 16 until post-GO plan.
- Container scan: `container-scan.yml` on Dockerfile changes.

### 7.9 Documentation consolidation

- Point README/QUICK_START to this doc.
- Mark LAUNCH_NOW, Phase 7B, fragmented QA as superseded (§1.4).

### 7.10 Integrations readiness

| Integration  | Endpoint / notes              | Launch requirement             |
| ------------ | ----------------------------- | ------------------------------ |
| **Supabase** | Auth, DB, storage             | P0 — real project              |
| **Stripe**   | Checkout + **`/api/webhook`** | P0 — test mode minimum for QA  |
| **Upstash**  | Rate limits                   | P0 for prod (fail-closed)      |
| **Resend**   | Email (optional)              | P1 — Supabase email OK for MVP |
| **OpenAI**   | Resonance/recommend           | P2 — flag off if no key        |
| **Sentry**   | Error tracking                | P1 — operator setup §8.1       |

**Stripe handled events (VERIFIED):**

1. `checkout.session.completed` → resolve `profiles` by metadata `user_id` (**auth.uid**) → `orders` + `order_items` with `orders.user_id` = **profiles.id** → library entitlement
2. `checkout.session.expired` → log only
3. `charge.refunded` → set order `status=refunded` by **`payment_intent_id`** (no `orders.refund_reason` column)
4. `payment_intent.payment_failed` → log only

**Connect:** NOT checkout-ready — do not market publisher payouts until P2. Webhook does **not** populate `book_sales` → payout path disconnected from DTC fulfillment.

**Purchase happy path:** test card `4242…` → Stripe Checkout → webhook → `orders.status=completed` → `/library` shows title → `/reading/[bookId]` passes entitlement.

---

## 8. Operator setup runbooks

### 8.1 Sentry setup (step-by-step)

**Prerequisite:** Code already wraps `next.config.js` with `@sentry/nextjs` when DSN present (VERIFIED).

1. **Create project:** [sentry.io](https://sentry.io) → Create project → **Next.js**.
2. **Copy DSN** from Project Settings → Client Keys.
3. **Create auth token:** Settings → Auth Tokens → scope `project:releases`, `org:read`, source map upload.
4. **Local `.env.local`:**
   ```env
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=mangu-publishers
   SENTRY_AUTH_TOKEN=sntrys_xxx
   ```
5. **GCP Secret Manager** (Cloud Run path): sync same keys via `./scripts/sync-gcp-secrets-from-env.sh`.
6. **Build with maps:** ensure `SENTRY_AUTH_TOKEN` present at build time for source maps.
7. **Verify:** deploy preview → trigger test error (e.g. temporary `throw new Error('Sentry verify')` in dev-only route) → confirm event in Sentry with `environment` + release.
8. **PII rule:** no user emails in manual breadcrumbs; use user id hash only.

**Pass criteria:** One test event visible within 5 minutes; release artifact tagged with git SHA.

### 8.2 Notion MCP + Cursor setup

1. **Notion integration:** notion.so → Settings → Integrations → New → copy **Internal Integration Token**.
2. **Share databases** with integration: Go-Live Checklist, PRD, Decision Log, QA Evidence.
3. **Cursor MCP:** Settings → MCP → Add server:
   ```json
   {
     "notion": {
       "command": "npx",
       "args": ["-y", "@notionhq/notion-mcp-server"],
       "env": { "NOTION_TOKEN": "ntn_xxx" }
     }
   }
   ```
4. **GitHub MCP:** already available as `user-github` — use for PR/issue automation.
5. **Templates to create in Notion:**
   - Go-Live task (fields: P0/P1, evidence link, status)
   - QA run (Tier L/R/C/P checklist)
   - ADR record (decision, date, owner)
6. **Workflow:** Notion task → Cursor agent implements → GitHub PR → link PR in Notion → append OPERATOR_QA_LOG.

### 8.3 Notion workspace templates

| Database              | Properties                                |
| --------------------- | ----------------------------------------- |
| **Go-Live Checklist** | ID, Priority, Owner, Evidence URL, Status |
| **PRD / Feature**     | Scope, Ship/Flag/Cut, Route, Acceptance   |
| **QA Evidence**       | Tier, Date, Pass/Fail, Screenshot, SHA    |
| **Decision Log**      | ADR id, Question, Outcome, Date           |

### 8.4 Secret / env inventory one-time collection

**Required MVP (production):**

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL` (canonical prod URL)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (prod fail-closed)

**Optional growth:** `OPENAI_API_KEY`, `RESEND_API_KEY`, Sentry vars (§8.1).

**Validate:** `npm run validate-env` must pass before deploy.

### 8.5 Solo-operator operating model

| Ritual                | Cadence                        | Max time                     |
| --------------------- | ------------------------------ | ---------------------------- |
| **Freeze check**      | Daily                          | 10 min — any new P0?         |
| **CI/main health**    | Daily                          | 10 min — `gh run list`       |
| **OPERATOR_QA_LOG**   | Per QA tranche                 | 15 min — append evidence     |
| **Dependabot triage** | Weekly                         | 30 min — defer majors pre-GO |
| **Go/no-go review**   | Before any public launch comms | 60 min                       |

**Automation allowed:** CI, mock E2E, unit tests, bug-to-issue (after fix), Dependabot minor.

**Human-only:** DNS cutover, Stripe live mode, legal sign-off, manual auth/checkout, GCP auth, production webhook registration.

**Fatigue rule:** If >3 P0s open >72h, stop feature work — only recovery PRs.

---

## 9. Expected-results catalog (UX / functional truth)

### 9.1 Homepage & global chrome

| Actor     | Action            | Expected UI                                                                | DB / side effects |
| --------- | ----------------- | -------------------------------------------------------------------------- | ----------------- |
| Anonymous | Visit `/`         | Brand hero, nav, footer; stats show **hardcoded** numbers (known issue C4) | None              |
| Any       | Click primary CTA | Routes to `/books` or `/register` per design                               | —                 |

### 9.2 Auth journeys

| Step | Actor    | Precondition       | Action                  | Expected result                                                                                          | Failure UX                                           |
| ---- | -------- | ------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A1   | New user | —                  | Submit `/register`      | If confirm email ON: **`needsVerification`**, redirect/message to `/verify-email`; **no session cookie** | Friendly errors via `register-errors.ts`             |
| A2   | New user | Email link clicked | Lands `/callback?code=` | `exchangeCodeForSession` → redirect `/` with session                                                     | Missing code → `/login?error=`                       |
| A3   | User     | Verified           | Login `/login`          | Session cookie; redirect home or `next`                                                                  | Rate limit → wait message                            |
| A4   | User     | Logged in          | Logout                  | Session cleared; protected routes redirect                                                               | —                                                    |
| A5   | User     | Forgot password    | Reset flow              | Email with link to `resolveAuthOrigin()` host                                                            | Recovery confirm **without** recovery session denied |
| A6   | System   | Prod rate limit    | 6th register attempt    | **503/429** if Upstash down in prod (fail-closed)                                                        | Not silent allow                                     |

**Phase 7A evidence table (required before purchase QA):**

| #    | Check                                                | Pass | Date | Evidence                  |
| ---- | ---------------------------------------------------- | ---- | ---- | ------------------------- |
| 7A-1 | Register new email                                   | ☐    |      | Screenshot + profiles row |
| 7A-2 | Verify email link uses correct host (not wrong port) | ☐    |      | Email link URL            |
| 7A-3 | `/callback` code exchange                            | ☐    |      | Network log               |
| 7A-4 | Login / logout                                       | ☐    |      |                           |
| 7A-5 | Password reset E2E                                   | ☐    |      |                           |
| 7A-6 | Duplicate register error                             | ☐    |      |                           |
| 7A-7 | Rate limit triggers (optional staging)               | ☐    |      |                           |

### 9.3 Consumer catalog / discover / library / read

| Route                                 | Ship                | Expected                                | Gap                                |
| ------------------------------------- | ------------------- | --------------------------------------- | ---------------------------------- |
| `/books`, `/books/[slug]`             | **Ship**            | Published public titles or honest empty | Seed may be empty                  |
| `/genres`, `/genres/[genre]`          | **Ship**            | Empty state if no genres                | Empty state VERIFIED               |
| `/discover`                           | **Ship**            | Discovery hub links                     | —                                  |
| `/library`                            | **Ship**            | **Completed orders only**               | entitlement.ts                     |
| `/reading/[bookId]`                   | **Ship**            | **Entitlement enforced**                | —                                  |
| `/books/[slug]` Start Reading         | **Flag**            | Link always visible today               | **Not purchase-gated** — P1-006    |
| `/blog`                               | **Cut/Flag**        | “First post coming soon” placeholder    | Do not market blog                 |
| `/book-clubs`, `/discover/book-clubs` | **Cut/Flag**        | Coming soon copy                        | —                                  |
| `/contact`                            | **Ship w/ honesty** | Form validates; **does not persist**    | Shows success incorrectly — P0-012 |
| `/recommendations`                    | **Flag**            | Needs OpenAI key                        | Degrade gracefully                 |

### 9.4 Checkout / webhook / entitlement / refund

| Step        | Expected                                                                    |
| ----------- | --------------------------------------------------------------------------- |
| Checkout    | Authenticated user → Stripe Checkout session with book metadata             |
| Success URL | Return to site; order pending until webhook                                 |
| Webhook     | POST **`/api/webhook`** with valid signature → `checkout.session.completed` |
| Order row   | `status=completed`, `user_id=profiles.id`                                   |
| Library     | Book appears                                                                |
| Reading     | `/reading/[id]` allowed                                                     |
| Refund      | `charge.refunded` → entitlement revoked per handler                         |

### 9.5 Author portal

| Route                                | RBAC          | Expected                        |
| ------------------------------------ | ------------- | ------------------------------- |
| `/author/dashboard`                  | author, admin | Dashboard loads                 |
| `/author/projects`, `/author/submit` | author, admin | Ownership enforced on mutations |
| `/author/analytics`                  | author, admin | Book-scoped analytics           |

### 9.6 Partner portal

| Route                    | RBAC read          | RBAC mutate / export      | Expected                                              |
| ------------------------ | ------------------ | ------------------------- | ----------------------------------------------------- |
| `/partner/dashboard`     | partner, **admin** | —                         | Summary or honest unavailable                         |
| `/partner/catalogs`      | partner, admin     | partner only (ARC create) | **All published public books** — not agreement-scoped |
| `/partner/arc-requests`  | partner, admin     | partner only              | Create + read; **no admin approval workflow**         |
| `/partner/orders`        | partner, admin     | —                         | Scoped to partner profile orders                      |
| `/partner/orders/[id]`   | partner, admin     | partner only (reorder)    | Detail view                                           |
| `/partner/orders/export` | —                  | **partner only**          | CSV download; **admin → 403**                         |
| `/partner` (index)       | —                  | —                         | **Missing** — use deep links                          |

**Provisioning (no UI):**

1. Set `profiles.role = 'partner'` (admin SQL or dashboard).
2. **Manual insert** into `partners` row linked to profile.
3. Without partners row → “complete partner profile setup” message.

**Gaps:**

- Reorder creates **unpaid `pending` order** — not Stripe checkout (document for partners).
- Docs still say “placeholder” — **incorrect** (C17).
- No admin ARC approval workflow — status stays `pending` until manual DB update.

### 9.7 Admin portal

| Route                                           | RBAC    | Expected                         |
| ----------------------------------------------- | ------- | -------------------------------- |
| `/admin/dashboard`                              | admin   | Loads                            |
| `/admin/books`, `/admin/users`, `/admin/orders` | admin   | CRUD with honest errors          |
| `/admin/health`                                 | admin   | System health view               |
| Non-admin                                       | blocked | Middleware → redirect login/home |

### 9.8 Public forms

| Form       | Current behavior                  | Required for GO           |
| ---------- | --------------------------------- | ------------------------- |
| Contact    | Validates; logs; **fake success** | Persist or honest failure |
| Newsletter | Sleep + success                   | API or disabled           |

### 9.9 APIs & health probes

| Endpoint                     | Expected                                      |
| ---------------------------- | --------------------------------------------- |
| `GET /api/live`              | 200 liveness                                  |
| `GET /api/health`            | 200 ok/degraded                               |
| `GET /api/health?ready=1`    | Component breakdown; stripe may warn if unset |
| `POST /api/webhook` (no sig) | **400** Missing signature                     |

### 9.10 Coming-soon / feature-flagged surfaces

| Surface                  | User message                            | Launch stance                  |
| ------------------------ | --------------------------------------- | ------------------------------ |
| Blog                     | First post coming soon                  | Do not link from marketing     |
| Book clubs               | Coming soon                             | Cut                            |
| Reading UI               | “Reading interface coming soon” partial | Ship with ebook MVP scope only |
| Reviews on comics/papers | Coming soon                             | Cut                            |

---

## 10. Feature & enhancement backlog

### 10.1 Launch-in MVP (must)

- Email/password auth + verify + reset
- Public catalog (books) + book detail
- Stripe Checkout + webhook + library + reading entitlement
- Admin: books, users, health
- Author: submit/list own projects
- Partner: catalogs, ARC request, orders view, CSV export
- Legal pages: terms, privacy
- Health/live probes

### 10.2 Launch-with-flag (may)

- Recommendations (OpenAI)
- Audio/comics/papers sections (if seeded)
- Partner reorder (pending order — document limits)
- Sentry (recommended P1)

### 10.3 Post-launch growth

- Blog CMS
- Book clubs
- Stripe Connect payouts
- Admin ARC approval workflow
- Contact persistence + support ticketing
- Real homepage statistics
- Next.js 16 / dependency majors

### 10.4 Explicitly out of scope for launch

- Full reading renderer parity with Kindle
- AI manuscript editing
- Multi-tenant white-label
- Native mobile apps

### 10.5 Route × scope matrix (from `app/` routes)

| Route                                                                                      | Scope   | Notes                   |
| ------------------------------------------------------------------------------------------ | ------- | ----------------------- |
| `/`                                                                                        | Ship    |                         |
| `/login`, `/register`, `/verify-email`, `/reset-password/*`                                | Ship    | Phase 7A evidence       |
| `/books`, `/books/[slug]`                                                                  | Ship    | Gate Start Reading — P1 |
| `/library`, `/reading/[bookId]`                                                            | Ship    | Entitlement             |
| `/checkout`                                                                                | Ship    |                         |
| `/admin/*`                                                                                 | Ship    |                         |
| `/author/*`                                                                                | Ship    |                         |
| `/partner/dashboard`, `catalogs`, `arc-requests`, `orders`, `orders/[id]`, `orders/export` | Ship    | No `/partner` index     |
| `/blog`, `/book-clubs`                                                                     | **Cut** | Placeholder             |
| `/contact`                                                                                 | Ship    | Fix persistence honesty |
| `/audio`, `/comics`, `/papers`                                                             | Flag    | Content-dependent       |
| `/discover/*`                                                                              | Ship    |                         |
| `/genres/*`                                                                                | Ship    | Empty OK                |
| `/press`, `/careers`, `/help`, `/faqs`                                                     | Ship    | Static/marketing        |

---

## 11. Master backlog (P0 / P1 / P2)

### 11.1 P0 recovery (blocks GO)

| ID     | Item                                                    | Deps       | Owner   | Acceptance evidence                                          |
| ------ | ------------------------------------------------------- | ---------- | ------- | ------------------------------------------------------------ |
| P0-001 | Land `register-errors.ts` build fix on `main`           | —          | Eng     | Vercel/preview deploy **READY**                              |
| P0-002 | Close duplicate autofix PRs #178–#182                   | P0-001     | Eng     | Only one repair PR open                                      |
| P0-003 | Platform ADR + DNS single authority                     | —          | Ops     | Signed ADR + DNS screenshot                                  |
| P0-004 | Migration history reconciliation                        | —          | Eng/Ops | Hosted vs repo diff logged                                   |
| P0-005 | Fix preview E2E BASE_URL + webServer                    | —          | Eng     | Playwright report shows preview URL                          |
| P0-006 | Fix bug-to-issue workflow name → `CI`                   | —          | Eng     | Test workflow_run fires                                      |
| P0-007 | Retarget health-check + lighthouse URLs                 | P0-003     | Ops     | Cron hits prod domain                                        |
| P0-008 | Tier R manual QA rows 1–10                              | P0-001, 7A | Ops     | OPERATOR_QA_LOG checked                                      |
| P0-009 | Phase 7A auth evidence table complete                   | —          | Ops     | §9.2 table filled                                            |
| P0-010 | Stripe test purchase → library → read                   | P0-009     | Ops     | Order row + screenshots                                      |
| P0-011 | Upstash configured in prod (fail-closed)                | P0-003     | Ops     | health + rate limit probe                                    |
| P0-012 | Contact form honesty or persistence                     | —          | Eng     | No false success                                             |
| P0-013 | Newsletter honesty or API                               | —          | Eng     | No fake success                                              |
| P0-014 | Homepage stats factual or removed                       | —          | Product | Query or static removed                                      |
| P0-015 | Apply `20260717114300_order_items_select_own` on hosted | —          | Ops     | `pg_policies` shows SELECT-own; nested library items visible |
| P0-016 | Upstash + `STRIPE_WEBHOOK_SECRET` in prod               | P0-003     | Ops     | Fail-closed limits work; webhook not 503                     |
| P0-017 | Decide `/api/mcp` disable or restrict                   | —          | Eng/Sec | Prod surface not anonymous open                              |
| P0-018 | Deploy via `gcloud-build-submit.sh` only + D1–D8        | P0-001     | Ops     | Revision READY; readiness probe green                        |

**Phase 2 P0 protocol IDs (formal handoff — Tier H, defer unless required):**

| ID   | Requirement                     | Status                    |
| ---- | ------------------------------- | ------------------------- |
| P0-1 | No secret leakage               | PENDING                   |
| P0-2 | Build before Docker             | PENDING                   |
| P0-3 | Next.js route serving           | PENDING                   |
| P0-4 | Security headers                | PENDING                   |
| P0-5 | Health and liveness             | PARTIAL — endpoints exist |
| P0-6 | Cloud Run deployment config     | PENDING                   |
| P0-7 | CI security gates               | PARTIAL                   |
| P0-8 | Content update automation       | PENDING                   |
| P0-9 | Observability and cost controls | PENDING                   |

### 11.2 P1 launch confidence

| ID     | Item                                              |
| ------ | ------------------------------------------------- |
| P1-001 | Sentry operator setup (§8.1)                      |
| P1-002 | Commit hardening wave (57 files) in logical PRs   |
| P1-003 | Align Node 22 across nvmrc, CI, engines           |
| P1-004 | Purchase E2E uncommented with CI secrets          |
| P1-005 | Partner reorder → checkout or document            |
| P1-006 | Gate Start Reading on entitlement                 |
| P1-007 | Admin ARC approval workflow                       |
| P1-008 | `/partner` index redirect                         |
| P1-009 | Trusted proxy IP model                            |
| P1-010 | Remove Supabase fallbacks in next.config for prod |

### 11.3 P2 hardening / growth

| ID     | Item                                      |
| ------ | ----------------------------------------- |
| P2-001 | Next.js 16 upgrade + audit fix            |
| P2-002 | Stripe Connect                            |
| P2-003 | Blog + book clubs productization          |
| P2-004 | Notion MCP automation (§8.2)              |
| P2-005 | k6 load test in CI cadence                |
| P2-006 | Coverage ratchet (measure baseline first) |

---

## 12. Roadmap, milestones, release gates

### 12.1 Sequenced windows

| Window         | Focus                                       | Exit                         |
| -------------- | ------------------------------------------- | ---------------------------- |
| **0–2 days**   | Build fix, PR hygiene, CI wiring            | Main deploy READY            |
| **3–5 days**   | Manual Tier R QA, Stripe proof              | OPERATOR_QA_LOG 1–10         |
| **6–10 days**  | Platform ADR, DNS, Cloud Run or Vercel lock | Single prod URL green        |
| **2–4 weeks**  | P1 trust fixes, Sentry, E2E real-backend    | Scorecard mostly amber/green |
| **8–12 weeks** | P2 growth features                          | Post-launch                  |

### 12.2 Hard release gates (all must be TRUE)

| #   | Gate                                                            |
| --- | --------------------------------------------------------------- |
| G1  | `origin/main` deploy status **READY** on chosen platform        |
| G2  | CI green on release SHA (validate-env, test, build, e2e mock)   |
| G3  | Phase 7A auth evidence complete                                 |
| G4  | Stripe test purchase → completed order → library → reading      |
| G5  | RBAC smokes: non-admin `/admin` blocked; non-partner export 403 |
| G6  | No false-success public forms                                   |
| G7  | `/api/health?ready=1` pass on prod (stripe documented if warn)  |
| G8  | Webhook prod endpoint registered and test event received        |
| G9  | ADR signed; monitors hit prod domain                            |
| G10 | OPERATOR_QA_LOG manual rows 1–10 checked with dates             |
| G11 | Known-good revision recorded for rollback                       |
| G12 | This document baseline refreshed with release SHA               |

### 12.3 Ownership / RACI (solo-operator adapted)

| Role            | Person                      | Responsibility                    |
| --------------- | --------------------------- | --------------------------------- |
| Release manager | Operator                    | GO/NO-GO, scope, evidence package |
| Engineering     | Operator + agents           | P0 fixes, PRs                     |
| Platform        | Operator (`renee@` for GCP) | Deploy, DNS, secrets              |
| QA              | Operator                    | Tier R/P execution                |
| Product         | Operator                    | Launch scope sign-off §10         |
| Security        | Operator                    | RLS review, secret hygiene        |

### 12.4 Go/no-go sign-off form

| Role            | Name | Decision   | Date | Notes |
| --------------- | ---- | ---------- | ---- | ----- |
| Release manager |      | GO / NO-GO |      |       |
| Engineering     |      | GO / NO-GO |      |       |
| Platform        |      | GO / NO-GO |      |       |
| QA              |      | GO / NO-GO |      |       |
| Product         |      | GO / NO-GO |      |       |

**Blocking items if NO-GO:** (list P0 IDs)

---

## 13. Verification matrix

This matrix **supersedes** fragmented checklists in OPERATOR_QA_LOG (as authority), LAUNCH_NOW, MASTER 7B, and Phase 2 automatic NO-GO templates. Record results in OPERATOR_QA_LOG.

### 13.1 Tier L — Local (agent or operator, ~30–60 min)

| ID  | Check        | Command / action                                                             | Pass criteria                           |
| --- | ------------ | ---------------------------------------------------------------------------- | --------------------------------------- |
| L0  | Solo install | Node ≥22; one agent `npm install`                                            | `node_modules/.bin/next` exists         |
| L1  | Pre-launch   | `bash scripts/pre-launch-verify.sh` (`SKIP_NPM_CI=1` if needed)              | All gates PASS                          |
| L2  | Unit         | `npm test`                                                                   | **63/63** (current)                     |
| L3  | E2E mock     | `USE_MOCKS=true` + CI placeholders; `npm run test:e2e -- --project=chromium` | Smoke green; real-backend tests skipped |
| L4  | Dev health   | Solo server port **3001**; `curl /api/health` + `?ready=1`                   | 200; degraded OK if Stripe unset        |

### 13.2 Tier R — Real backend (operator, blocking)

| ID  | Check       | Action                                                     | Pass criteria                         |
| --- | ----------- | ---------------------------------------------------------- | ------------------------------------- |
| R1  | Auth        | QA log #1–4 + §9.2 Phase 7A                                | Profile created; login/logout/reset   |
| R2  | RBAC        | #5–6 + role-gating E2E with TEST accounts                  | Non-admin blocked; admin health loads |
| R3  | Catalog     | #7 + seed if needed                                        | `/books` shows titles or honest empty |
| R4  | Entitlement | Completed order → `/library` + `/reading/[id]`             | Gated correctly                       |
| R5  | Stripe      | WEBHOOK_TESTING + #8–9                                     | Checkout 4242 + webhook → completed   |
| R6  | Portals     | Author submit; partner ARC `?status=rejected`; admin books | Honest errors; partner CSV works      |

### 13.3 Tier C — CI (on PR / main)

| ID  | Workflow                    | Expect                                |
| --- | --------------------------- | ------------------------------------- |
| C1  | CI (`ci.yml`)               | Green: validate-env → test → build    |
| C2  | Playwright E2E (`e2e.yml`)  | Green on mocks; artifact if fail      |
| C3  | Format + CodeQL + npm-audit | Green / advisory                      |
| C4  | RLS (`rls-check.yml`)       | Green or waiver logged                |
| C5  | bug-to-issue                | Fires on **`CI`** workflow completion |

### 13.4 Tier P — Production (operator, launch path)

| ID  | Check               | Action                                              | Pass criteria      |
| --- | ------------------- | --------------------------------------------------- | ------------------ |
| P1  | Secrets sync        | `sync-gcp-secrets-from-env.sh` + Upstash            | Secrets list OK    |
| P2  | Deploy              | `gcloud-build-submit.sh` or Vercel prod             | Revision READY     |
| P3  | Ready probe         | `/api/live` + `/api/health?ready=1`                 | Components pass    |
| P4  | Surface smokes      | `/`, `/books`, `/login`; `curl -I /admin/dashboard` | 200 / 307          |
| P5  | Security smokes     | POST `/api/webhook` no sig; anon RLS                | 400; no leaks      |
| P6  | Stripe prod webhook | Dashboard → `/api/webhook`                          | Events delivered   |
| P7  | DNS cutover         | Point to chosen platform                            | Cert valid         |
| P8  | Monitors            | health-check + lighthouse URLs                      | Hit prod domain    |
| P9  | Record              | KNOWN_GOOD_REVISION + QA dates                      | Rollback traceable |

### 13.5 Tier H — Handoff (optional / Phase 2 formal)

| ID  | Gate                  | Doc                                              |
| --- | --------------------- | ------------------------------------------------ |
| H1  | P0-1…P0-9 evidence    | `docs/phase2/06-acceptance-and-test-protocol.md` |
| H2  | RACI names            | `docs/phase2/12-ownership-raci.md`               |
| H3  | Cutover T-24/T-2/T-30 | `docs/phase2/13-cutover-day-runbook.md`          |
| H4  | Formal GO             | `docs/phase2/11-handoff-master-checklist.md`     |

### 13.6 Smoke (≤90s, public)

| #   | Check                 | Pass                                |
| --- | --------------------- | ----------------------------------- |
| S1  | Homepage 200          | Brand renders                       |
| S2  | `/books` 200          | List or empty                       |
| S3  | `/api/live`           | JSON ok                             |
| S4  | `/api/health?ready=1` | Documented status                   |
| S5  | `/login`, `/register` | Forms visible                       |
| S6  | Contact/newsletter    | No false success (after P0-012/013) |
| S7  | Preview E2E artifact  | URL = deployment URL                |

### 13.7 Happy path (authenticated)

| #   | Journey                            | Pass                  |
| --- | ---------------------------------- | --------------------- |
| H1  | Register → verify → login → logout | §9.2                  |
| H2  | Password reset                     | Recovery-only confirm |
| H3  | Browse → book detail               | Public published only |
| H4  | Stripe checkout                    | Metadata present      |
| H5  | Webhook completed                  | Idempotent order      |
| H6  | Library → read                     | Entitlement           |
| H7  | Author path                        | Ownership             |
| H8  | Partner ARC/orders/export          | RBAC + CSV            |
| H9  | Admin                              | Non-admin denied      |
| H10 | Refund                             | Entitlement revoked   |

### 13.8 Failure path

| #      | Case                     | Pass                        |
| ------ | ------------------------ | --------------------------- |
| F1     | Duplicate register       | Friendly error              |
| F2     | Invalid login            | Generic failure             |
| F3     | Reset without recovery   | Denied                      |
| F4     | Checkout unauthenticated | Redirect/deny               |
| F5     | Webhook bad signature    | 400                         |
| F6     | Webhook replay           | Idempotent                  |
| F7     | Read without purchase    | Denied at `/reading`        |
| F8     | Cross-user RLS           | Isolated                    |
| F9–F10 | Non-admin/partner routes | Blocked                     |
| F11    | Missing env              | Fail closed                 |
| F12    | Contact/newsletter       | Honest UX                   |
| F13    | Bad upload MIME          | Rejected                    |
| F14    | Spoofed X-Forwarded-For  | Trusted proxy (post P1-009) |

### 13.9 Deploy verify (D1–D8)

| #      | Platform path                                 | Checks                                                                                                                                    | Pass criteria                                | Evidence                           |
| ------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------- |
| **D1** | Post-merge Vercel (if still receiving `main`) | Deployment READY; compile success; smoke S1–S6 on deployment URL                                                                          | No ERROR; homepage 200                       | Vercel deployment ID + screenshots |
| **D2** | Cloud Run (canonical)                         | `sync-gcp-secrets-from-env.sh` → `gcloud-build-submit.sh` → inline verify (§6.3)                                                          | `/api/live` 200; `/api/health?ready=1` ready | Revision name + curl JSON          |
| **D3** | Domain authority                              | DNS + TLS for `mangu-publishers.com` / `www` maps to **chosen** platform only                                                             | Single authority; cert valid                 | DNS dump; ADR link                 |
| **D4** | Stripe webhook                                | Dashboard URL = `{prod}/api/webhook`; events: `checkout.session.completed`, `expired`, `charge.refunded`, `payment_intent.payment_failed` | Test event processed; order row              | Stripe event ID                    |
| **D5** | Secrets                                       | GCP Secret Manager (or Vercel env) complete; no placeholders; Upstash present for fail-closed                                             | `validate-env` + ready probe                 | Masked inventory                   |
| **D6** | Rollback                                      | Documented revision rollback rehearsed once                                                                                               | Prior revision serves `/api/live`            | Rollback command log               |
| **D7** | CI on main                                    | type-check, lint, test, build green on **exact release SHA**                                                                              | All required checks green                    | Actions run URL                    |
| **D8** | Migration state                               | Hosted history matches repo manifest post-reconcile; `order_items` SELECT policy present                                                  | 22+ applied; pending P0 applied              | SQL query output                   |

**Notes:** Do **not** use plain `/api/health` for D2. Do **not** cut over DNS (D3) before D2. Retarget `health-check.yml` / lighthouse after D3.

### 13.10 Evidence packaging rules

Each verification tranche produces: **commit SHA**, **deployment ID/revision**, **test report URL or log excerpt**, **OPERATOR_QA_LOG row**, **screenshot/link** for manual steps.

---

## 14. Evidence register

### 14.1 Source links

| ID   | Source              | Location                                                        |
| ---- | ------------------- | --------------------------------------------------------------- |
| E-01 | Build failure main  | `843d7e8` Vercel ERROR — sync export (REPORTED PDF)             |
| E-02 | Build fix local     | `lib/auth/register-errors.ts`, `app/(auth)/register/actions.ts` |
| E-03 | Recovery PR         | GitHub PR #183                                                  |
| E-04 | Duplicate PRs       | #178, #179, #180, #181, #182                                    |
| E-05 | Unit tests          | 63/63 — OPERATOR_QA_LOG 2026-07-17                              |
| E-06 | Webhook route       | `app/api/webhook/route.ts`                                      |
| E-07 | Entitlement         | `lib/reading/entitlement.ts`                                    |
| E-08 | Partner export RBAC | `app/(portals)/partner/orders/export/route.ts`                  |
| E-09 | CI name mismatch    | `bug-to-issue.yml` vs `ci.yml`                                  |
| E-10 | Stale monitors      | `health-check.yml`, `lighthouse-ci.yml`                         |
| E-11 | Playwright port     | `playwright.config.ts` :3000                                    |
| E-12 | Dev port helper     | `.start-next-3001.cmd`                                          |
| E-13 | Migrations applied  | OPERATOR_QA_LOG MCP apply note                                  |
| E-14 | Manual QA empty     | OPERATOR_QA_LOG rows 1–10 ☐                                     |

### 14.2 Refresh after each merge

```bash
# Update §3.1 commit row
git log -1 --oneline origin/main

# Update deploy evidence
# Vercel: deployment URL + status
# Cloud Run: gcloud run services describe mangu-publishers --region us-central1

# Re-run L2 + C1 on release SHA
npm test && npm run build

# Append OPERATOR_QA_LOG
```

---

## 15. Known unknowns & human decisions required

| ID  | Question                              | Owner    | Required artifact                    |
| --- | ------------------------------------- | -------- | ------------------------------------ |
| U1  | Canonical prod: Cloud Run vs Vercel?  | Operator | ADR-001 signed                       |
| U2  | Which hostname is prod today?         | Operator | DNS dump                             |
| U3  | Merge #183 vs local branch?           | Eng      | PR plan                              |
| U4  | Hosted migration versions vs renames? | Eng/Ops  | Supabase history export              |
| U5  | GitHub Actions billing/permissions?   | Operator | Green run log                        |
| U6  | Sentry now (P1) or defer?             | Operator | Decision + DSN if yes                |
| U7  | Notion workspace authoritative?       | Operator | Template acceptance                  |
| U8  | Launch MVP feature contract           | Product  | §10 signed                           |
| U9  | Homepage metrics factual?             | Product  | Query or remove                      |
| U10 | Stripe test vs live at launch         | Operator | Dashboard + policy                   |
| U11 | Email provider quota                  | Operator | Supabase auth logs                   |
| U12 | Legal review terms/privacy            | Operator | Counsel or deferral note             |
| U13 | On-call if solo                       | Operator | Escalation note                      |
| U14 | GCP login identity                    | Operator | `renee@mangu-publishers.com`         |
| U15 | Upstash required at launch?           | Operator | Prod config + fail-closed acceptance |
| U16 | Public repo residual risk             | Operator | RLS acceptance note                  |

---

## 16. Post-push refresh (LOCAL-UNCOMMITTED → committed)

**Snapshot (2026-07-17, LOCAL-UNCOMMITTED / VERIFIED git):**

| Item                            | Finding                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Local tip                       | `273ec9d` — _Harden auth, admin, partner, and API routes…_                                      |
| vs `origin/main`                | **0 ahead / 4 behind** (remote: Playwright + actions bumps)                                     |
| Pending work                    | **Uncommitted working tree only** — nothing pushable until commit                               |
| Meaningful modified paths       | ~**40** app/lib/docs/workflows/tests/migrations (ignore trash)                                  |
| Untracked ship candidates       | `lib/auth/register-errors.ts`, new Jul-17 migrations, `tests/e2e/role-gating.spec.ts`           |
| **Exclude from ship inventory** | `node_modules.trash*`, `.SERVER_RESTORE_LOCK`, `SERVER_PID.txt`, `20.0.0`, other local ops junk |

**Mandatory before claiming green main:** `git fetch origin` then **rebase or merge the 4 remote commits** onto local tip — do not describe a conflicted tip as release SHA.

### 16.1 Themes that flip scorecard / docs after a real push

| Theme                    | After push expect                                                                                                                                | Refresh in this doc                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **Node 22 canonical**    | `.nvmrc` / Cloud Build / blockers nvmrc = **22**; docs say 22                                                                                    | §5.8, §7.8 — **footnote:** `package.json` `engines` still `>=20.0.0` until bumped |
| **`register-errors.ts`** | Vercel compile blocker on remote main clears                                                                                                     | §3.1, §5.1 → toward 🟢                                                            |
| **Identity model**       | `orders.user_id` = **`profiles.id`**; checkout metadata `user_id` = **auth.uid**; entitlement/library/resonance/revenue export resolve correctly | §9.4, §7.3 export notes                                                           |
| **Webhook refunds**      | Lookup by **`payment_intent_id`**; no `orders.refund_reason`                                                                                     | §7.10, WEBHOOK_TESTING                                                            |
| **Migrations**           | Renames + Jul-17 RLS wave on git; still apply pending `order_items_select_own` on hosted if not yet                                              | §5.4, §7.4, Appendix B                                                            |
| **Auth abuse**           | Middleware rate-limits **POST `/verify-email`**; resend = sessionless + IP + email limits                                                        | §9.2                                                                              |
| **SEO / portals**        | Consumer pages canonical/OG metadata; portal/library **rethrow `NEXT_REDIRECT`** so auth redirects not swallowed                                 | §9.3 / §9.6                                                                       |
| **CI/E2E**               | Node from `.nvmrc`; expanded auth/purchase/role-gating e2e + hardening unit tests                                                                | §13 Tier L/C                                                                      |
| **Ops narrative**        | OPERATOR_QA_LOG + deployment_status Jul-17 wave become committed history                                                                         | §14                                                                               |

### 16.2 Likely to improve (flip toward GREEN)

| Area                            | Expectation                                                              |
| ------------------------------- | ------------------------------------------------------------------------ |
| Server-action build             | `register-errors.ts` on main → Vercel compile clears                     |
| Auth hardening                  | Verify resend, quota errors, recovery-only reset, verify-email IP limits |
| Entitlements                    | `lib/reading/entitlement.ts` + completed-order scoping on main           |
| Admin/partner UX                | Honest error states; `NEXT_REDIRECT` rethrow                             |
| Unit tests                      | 63/63 on CI if workflow green                                            |
| Migrations                      | Renamed/applied RLS/role migrations in git history                       |
| OPERATOR_QA_LOG                 | Wave becomes committed history                                           |
| Webhook/stripe/health/resonance | Local patches become new baseline                                        |

### 16.3 Still RED/AMBER after push (do not over-claim)

| Area                                | Remains until explicitly fixed                                |
| ----------------------------------- | ------------------------------------------------------------- |
| Platform ADR                        | Cloud Run vs Vercel traffic; DNS cutover                      |
| Preview E2E                         | BASE_URL + USE_MOCKS unless playwright/e2e yml actually fixed |
| Public trust                        | Contact/newsletter/stats unless included in commit            |
| Middleware IP trust                 | Spoofable without trusted-proxy model                         |
| `next.config.js` Supabase fallbacks | Still present unless removed                                  |
| Duplicate autofix PRs               | Still need closing on GitHub                                  |
| Manual E2E proof                    | Auth/checkout/RBAC still need operator evidence               |
| Hosted `order_items` policy         | Apply pending migration even after git push                   |
| Sentry/Notion                       | Operator setup still required                                 |
| engines vs nvmrc                    | Footnote until `engines` ≥22                                  |

### 16.4 Rebase / commit / push checklist

1. `git fetch origin && git rebase origin/main` (or merge) — absorb **4** remote commits first.
2. Resolve migration rename conflicts before push.
3. Diff local `register-errors` vs PR **#183** — pick **one** vehicle; close the other.
4. Split commits: (a) build helper only, (b) hardening/RLS, (c) migration renames, (d) docs — do not mega-batch.
5. **Exclude** trash/PID/lock/`20.0.0` from `git add`.
6. Refresh §3, §5, §14 with new SHA + deployment IDs after merge.
7. Run full Tier L on release branch before merge; then D1–D8.

---

## Appendices A–G

### Appendix A — Minimal repair PR / build review checklist

- [ ] `lib/auth/register-errors.ts` exists; **no sync exports** from `use server` action files except async actions
- [ ] `register/actions.ts` imports `toFriendlyRegisterError` only
- [ ] `npm run type-check` pass
- [ ] `npm run lint` pass
- [ ] `npm test` pass (63/63)
- [ ] `npm run build` pass with CI mock env
- [ ] No secrets in diff
- [ ] PR description links P0-001
- [ ] Close #178–#182 when merged
- [ ] Vercel/preview deploy **READY** post-merge
- [ ] Rebased onto `origin/main` (was behind 4 at 273ec9d snapshot)

### Appendix B — Migration reconciliation procedure (no blind stubs)

1. **Inventory local:** `ls supabase/migrations/*.sql | wc -l` (expect ~25).
2. **Export hosted:**  
   `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;`
3. **Diff:** for each local file, mark Applied / Pending / Local-stub-only / Renamed.
4. **Never** insert empty `SELECT 1` stubs into hosted history to “catch up.”
5. **Apply pending only:** currently `20260717114300_order_items_select_own.sql` (P0).
6. **Record checksums** (optional): `sha256sum` of applied SQL; store in OPERATOR_QA_LOG.
7. **Update docs:** `docs/MIGRATIONS.md`, health route comment block, this §5.4 / §7.4.
8. **Verify:** `npm run verify-rls` + nested order→items read as authenticated user.
9. **Types:** regenerate `types/database.ts` from hosted schema (P2 engineering).

### Appendix B2 — Launch test matrix (manual — canonical 10 + extensions)

**Canonical (OPERATOR_QA_LOG — all must be checked for GO):**

| #   | Test                               | Pass | Date | Notes          |
| --- | ---------------------------------- | ---- | ---- | -------------- |
| 1   | Register at `/register`            | ☐    |      | Phase 7A       |
| 2   | Profile row in Supabase `profiles` | ☐    |      |                |
| 3   | Login / logout                     | ☐    |      |                |
| 4   | Password reset                     | ☐    |      |                |
| 5   | Non-admin blocked from `/admin`    | ☐    |      |                |
| 6   | Admin `/admin/health`              | ☐    |      |                |
| 7   | Browse `/books`                    | ☐    |      | seed if empty  |
| 8   | Stripe test checkout `4242…`       | ☐    |      | after 7A       |
| 9   | Stripe webhook event received      | ☐    |      | `/api/webhook` |
| 10  | Homepage loads at `/`              | ☐    |      |                |

**Extensions (partner — Tier R6):**

| #   | Test                                     | Pass |
| --- | ---------------------------------------- | ---- |
| 11  | Partner catalogs + ARC create            | ☐    |
| 12  | Partner orders + CSV export              | ☐    |
| 13  | Admin on partner export → 403            | ☐    |
| 14  | Reorder creates pending order (document) | ☐    |

### Appendix C — Trusted-proxy / client-IP model

**Current (VERIFIED):** `middleware.ts` and register actions read `x-forwarded-for` directly — spoofable behind non-trusted proxies.

**Target (P1-009):**

1. Configure platform trusted proxy list (Vercel/Cloud Run).
2. Use platform-provided client IP header or leftmost trusted hop only.
3. Document in `middleware.ts` + deployment platform settings.
4. Add unit test for IP extraction.

### Appendix D — Preview E2E config pattern (BASE_URL + no local webServer)

```typescript
// playwright.config.ts pattern (PROPOSED)
const baseURL = process.env.BASE_URL || 'http://localhost:3000';
const isRemote = baseURL && !baseURL.includes('localhost');

export default defineConfig({
  use: { baseURL },
  webServer: isRemote
    ? undefined
    : { command: 'npm run dev', url: baseURL, timeout: 120_000 },
});
```

**preview-e2e.yml:** pass `BASE_URL: ${{ github.event.deployment_status.environment_url }}`; **do not** set `USE_MOCKS=true` when testing real preview unless explicitly smoke-only.

### Appendix E — Obsolete file / doc retirement list

| File                                                                    | Action                                 |
| ----------------------------------------------------------------------- | -------------------------------------- |
| `Downloads/next-go.pdf`                                                 | Archive as v2 snapshot; do not execute |
| `QUICK_START.md` PRODUCTION READY banner                                | Demote → link `docs/NEXT_GO.md`        |
| `docs/MANGU_PUBLISHERS_END_TO_END.md` test counts                       | Add superseded banner                  |
| `docs/reports/deployment/deployment_status.md` “Sentry not implemented” | Correct — SDK wired                    |
| `docs/reports/deployment/deployment_status.md` “nvmrc pins 20”          | Correct → 22                           |
| Partner “placeholder” claims in old docs                                | Remove — portal functional             |
| `vercel-deploy.yml`                                                     | Already retired (C10)                  |

### Appendix F — Glossary

| Term               | Definition                                                    |
| ------------------ | ------------------------------------------------------------- |
| **GO / NO-GO**     | Release authorization decision                                |
| **Phase 7A**       | Auth evidence table before purchase QA                        |
| **Tier L/R/C/P/H** | Local / Real backend / CI / Production / Handoff verification |
| **Fail-closed**    | Deny request when dependency (Upstash) unavailable in prod    |
| **ADR**            | Architecture Decision Record                                  |
| **Entitlement**    | Right to read book — completed order required                 |
| **ARC**            | Advance reader copy partner request                           |
| **PKCE**           | OAuth code exchange via `/callback?code=`                     |

### Appendix G — PDF archive pointer + changelog v2 → v3

| Version | Location                               | Notes                                   |
| ------- | -------------------------------------- | --------------------------------------- |
| v2      | `~/Downloads/next-go.pdf`              | 27-page audit; main @ `843d7e8` failure |
| **v3**  | **`docs/NEXT_GO.md`**                  | This document — Markdown authority      |
| Export  | `docs/archive/next-go-v3-YYYYMMDD.pdf` | Generate after stabilization (Pandoc)   |

**v2 → v3 changelog:**

- Elevated Sentry, Notion MCP, solo ops from PDF Tab 2 to §8 (first-class)
- Added partner portal §9.6 with RBAC, CSV, provisioning gaps
- Added consumer route ship/flag/cut matrix §9.3 / §10.5
- Documented `register-errors.ts` LOCAL-UNCOMMITTED fix vs remote main failure
- Unified verification matrix Tier L/R/C/P/H in §13 — supersedes fragmented QA docs
- Corrected webhook path, 4 events, Connect not ready; refunds via `payment_intent_id`
- Documented CI bugs: bug-to-issue name, stale health/lighthouse URLs, preview E2E
- Documented port 3001 vs 3000 drift
- Expanded §5.4 / §7.4 hosted Supabase (22 applied, order_items P0, RLS_NO_POLICY)
- Expanded §7.2 Cloud Run deploy-only path + missing-script fallbacks + env matrix
- Expanded §7.3 API inventory (14 routes), Upstash/webhook P0, public MCP, export ID mismatch
- Expanded §13.9 D1–D8 deploy verify with pass criteria
- Expanded §16 post-push refresh: rebase 4 commits, ~40 paths, exclude trash/PID/lock, engines footnote
- Appendix B = migration reconciliation (launch test matrix → B2)
- Scorecard + P0 backlog IDs preserved and extended

**Five deltas vs PDF v2 (operator summary):**

1. **Local build fix is real** — `register-errors.ts` LOCAL-UNCOMMITTED; remote main still blocked at `843d7e8`.
2. **Tab 2 is core** — Sentry / Notion / solo ops / expected-results are §8–§10, not PDF appendix.
3. **CI surface larger than claimed** — many workflows; bugs are governance (bug-to-issue name, stale Vercel monitors, preview BASE_URL + USE_MOCKS).
4. **StatsBar inconsistency + preview mocks** — two hardcoded metric sets; preview E2E can false-pass.
5. **Cloud Run deploy contract clarified** — `gcloud-build-submit.sh` only; readiness = `?ready=1`; Amplify/Vercel non-authoritative; missing verify/grant scripts have inline fallbacks.

---

_End of Next-Go v3.0 — NOT RELEASE-READY until §12.2 gates pass._
