# Operator Walkthrough Supplement

**Canonical program doc:** [MANGU Publishers Master RICEF](mangu_publishers_master_ricef.md) — Requirements, Inputs, Controls, Execution, Forms.

**This supplement implements:** RICEF **§ E (Execution)** Waves 0–3 and **§ I (Inputs)** — click-by-click: where to go, what to copy, where to paste.

Work through the parts in order unless a section says “skip for now.”

**Estimated time:** Part 1–2 (~30 min) unblocks local dev + CI. Parts 3–6 are for production deploy.

---

## Before you start

| You need | Used in |
|----------|---------|
| GitHub login with admin on `redinc23/my_publishing` | Parts 2, 7 |
| Supabase project (create one if missing) | Parts 1, 2, 5 |
| Stripe account (test mode OK for dev) | Parts 1, 4, 6 |
| GCP project with billing (for Cloud Run only) | Part 4 |
| Vercel account (only if you keep Vercel deploys) | Part 3 |

**Never commit:** `.env.local`, `environment.local.sh`, or any file containing real keys.

---

## Part 1 — Local development (`.env.local`)

**Goal:** Run `npm run dev` and open `http://localhost:3000/api/health`.

### Step 1.1 — Create the file on your machine

1. Open the repo folder: `/Users/city/my_publishing` (or your clone path).
2. In Terminal:

```bash
cd /Users/city/my_publishing
cp .env.local.example .env.local
```

3. Open **`.env.local`** in your editor (Cursor, VS Code, etc.).  
   **Enter values here** — this file stays on your computer only (gitignored).

---

### Step 1.2 — Supabase (required — 3 values)

**Where to go:**

1. Browser → [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in → select your project (or **New project** → name it → wait until ready).
3. Left sidebar → **Project Settings** (gear icon at bottom) → **API**.

**What to copy:**

| Label in Supabase UI | Paste into `.env.local` as |
|----------------------|---------------------------|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL=` |
| **anon public** key (under Project API keys) | `NEXT_PUBLIC_SUPABASE_ANON_KEY=` |
| **service_role** key (click Reveal) | `SUPABASE_SERVICE_ROLE_KEY=` |

**Example shape** (use your real values):

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Warning:** `service_role` bypasses Row Level Security. Never put it in GitHub “public” fields, client code, or `NEXT_PUBLIC_*` variables.

---

### Step 1.3 — Site URL (recommended for local)

**Where:** Same `.env.local` file.

**Enter:**

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

### Step 1.4 — Stripe (optional until you test checkout)

**Where to go:**

1. [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys) (use **Test mode** toggle ON).

**What to copy → `.env.local`:**

| Stripe UI | `.env.local` variable |
|-----------|------------------------|
| **Publishable key** (`pk_test_...`) | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=` |
| **Secret key** (`sk_test_...`) | `STRIPE_SECRET_KEY=` |

Webhook secret comes in Part 6 (local) or Part 4 (production).

---

### Step 1.5 — Optional services (skip until needed)

| Service | Where to get key | `.env.local` line |
|---------|------------------|-------------------|
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `OPENAI_API_KEY=sk-proj-...` |
| Resend | [resend.com/api-keys](https://resend.com/api-keys) | `RESEND_API_KEY=re_...` |

---

### Step 1.6 — Verify locally

**Where:** Terminal in repo root.

```bash
cd /Users/city/my_publishing
npm ci
npm run type-check
npm run lint
npm test
npm run build
npm run dev
```

**Where to check in browser:**

| URL | Expected |
|-----|----------|
| `http://localhost:3000/api/health` | JSON with `"status":"healthy"` (or warnings if Stripe not set) |
| `http://localhost:3000` | App loads |

If `npm run dev` fails immediately with “Missing required environment variables”, re-check Step 1.2.

---

## Part 2 — GitHub Actions secrets (unblocks PR #73 CI)

**Goal:** CI `npm run build` stops failing with “Your project's URL and Key are required to create a Supabase client!”

**Where to go:**

1. [https://github.com/redinc23/my_publishing](https://github.com/redinc23/my_publishing)
2. Top tab **Settings** (repo settings, not your profile).
3. Left sidebar → **Secrets and variables** → **Actions**.
4. Click **New repository secret** for each row below.

**Important:** Secret **Name** must match exactly (case-sensitive). **Secret** is the value you paste.

| Click “New repository secret” → Name | Secret value (paste from) |
|--------------------------------------|---------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as in `.env.local` → `NEXT_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `.env.local` → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as `.env.local` → service role key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → publishable `pk_test_...` or `pk_live_...` |
| `NEXT_PUBLIC_SITE_URL` | Production URL, e.g. `https://your-domain.com` — or `http://localhost:3000` for testing only |

**Optional (only if you want Vercel deploy on every `main` push):**

| Name | Where to get value |
|------|-------------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token |
| `VERCEL_ORG_ID` | Vercel project → Settings → General → **Team ID** or personal ID |
| `VERCEL_PROJECT_ID` | Same page → **Project ID** |

---

### Step 2.1 — Re-run CI on PR #73

**Where to go:**

1. [https://github.com/redinc23/my_publishing/pull/73](https://github.com/redinc23/my_publishing/pull/73)
2. Tab **Checks** → failed **test** job → **Re-run jobs** → **Re-run all jobs**  
   Or: empty commit push to branch `chore/full-project-hardening`.

**Success looks like:** Green check on **test** (type-check, lint, test, build).

---

## Part 3 — Vercel project environment (if you use Vercel)

**Goal:** Preview/production deploys on Vercel have the same public env vars as CI.

**Where to go:**

1. [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Open project **my-publishing** (or linked name).
3. **Settings** → **Environment Variables**.

**Add each variable** (name must match; enable **Production**, **Preview**, **Development** as needed):

| Key | Value source |
|-----|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | From Stripe |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel URL or custom domain |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server only) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | From Stripe webhook (Part 6) |

**Server-only secrets** in Vercel: do **not** prefix with `NEXT_PUBLIC_`.

After saving → **Deployments** → **Redeploy** latest.

---

## Part 4 — GCP production (Cloud Run + Secret Manager)

**Skip this part** until PR #73 is merged and you have chosen Cloud Run as production ([#70](https://github.com/redinc23/my_publishing/issues/70)).

### Step 4.1 — GCP project & CLI

**Where to go:**

1. [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Top bar → select **project** (note the **Project ID**, e.g. `my-gcp-project-id`).
3. Optional Terminal check: `gcloud config get-value project`

**Where to enter (local intake file, not in git):**

```bash
cp docs/phase2/_intake/environment.example.sh docs/phase2/_intake/environment.local.sh
```

Edit `docs/phase2/_intake/environment.local.sh`:

| Variable in file | Where to find in GCP |
|------------------|----------------------|
| `PROJECT_ID` | Console project picker or `gcloud config get-value project` |
| `REGION` | Usually `us-central1` (must match [cloudbuild.yaml](cloudbuild.yaml)) |
| `SERVICE_NAME` | Keep `mangu-publishers` unless you renamed Cloud Run service |
| `AR_REPO` | Artifact Registry → Repositories → Docker repo name (default `web-images`) |
| `CUSTOM_DOMAIN` | Your live hostname only, e.g. `publish.example.com` (no `https://`) |
| `BILLING_ACCOUNT_ID` | Billing → Account management → Billing account ID |

---

### Step 4.2 — Secret Manager (server secrets)

**Where to go:**

1. GCP Console → **Security** → **Secret Manager**
2. **+ CREATE SECRET** for each row.

**Secret ID** (name in GCP) must match what [cloudbuild.yaml](cloudbuild.yaml) expects on the right side of `=`:

| Secret ID (create this name) | Secret value (paste) |
|------------------------------|----------------------|
| `supabase-service-role-key` | Supabase → Settings → API → **service_role** key |
| `stripe-secret-key` | Stripe → Secret key `sk_live_...` or `sk_test_...` |
| `stripe-webhook-secret` | Stripe webhook signing secret `whsec_...` (Part 6) |
| `resend-api-key` | Resend API key (if using email) |
| `openai-api-key` | OpenAI API key (if using resonance/AI) |

**Where Cloud Run reads them:** Deploy step maps:

`STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest` → env var inside container at runtime.

You do **not** put these in `environment.local.sh` committed to git.

---

### Step 4.3 — Cloud Build substitutions (public `NEXT_PUBLIC_*`)

**Where to go:**

1. GCP Console → **Cloud Build** → **Triggers**
2. Open the trigger that runs [cloudbuild.yaml](cloudbuild.yaml) (or create one on `main` push).
3. **Substitution variables** section.

**Set these substitution keys** (must match leading underscore in yaml):

| Substitution variable | Value |
|----------------------|--------|
| `_NEXT_PUBLIC_SUPABASE_URL` | Full Supabase Project URL |
| `_NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `_NEXT_PUBLIC_SITE_URL` | `https://YOUR_CUSTOM_DOMAIN` |

**Preferred (loads substitutions from `.env.local`):**

```bash
./scripts/gcloud-build-submit.sh
```

Do not run raw `gcloud builds submit` without `_NEXT_PUBLIC_*` substitutions — use the script above.

---

### Step 4.4 — Smoke test after deploy

**Where to go:**

1. GCP Console → **Cloud Run** → service **mangu-publishers** → copy **URL** (if you use default URL) or use your mapped custom domain.
2. Browser or Terminal:

```bash
curl -s "https://YOUR_CLOUD_RUN_OR_CUSTOM_DOMAIN/api/health" | head
```

Expect JSON with healthy or degraded status, not 503 from missing Supabase.

---

## Part 5 — Supabase database migrations

**Goal:** Production database has all tables RLS policies expect.

### Step 5.1 — Choose method

| Method | Best for |
|--------|----------|
| **SQL Editor** (recommended) | One-time setup, full control |
| `npm run db:migrate` | Machine with DB URL / service role and network access |

### Step 5.2 — SQL Editor (step by step)

**Where to go:**

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Left sidebar → **SQL Editor**
3. **New query**

**What to run:** Each file in repo folder `supabase/migrations/` **in filename order**:

1. `20260116000000_initial_schema.sql`
2. `20260117000000_analytics_events.sql`
3. `20260117000000_storage_policies.sql`
4. `20260117000001_analytics_sessions.sql`
5. `20260117000002_book_stats_materialized.sql`
6. `20260117000003_revenue_tracking.sql`
7. `20260117000004_author_payouts.sql`
8. `20260117000005_book_pricing.sql`
9. `20260118000000_critical_fixes.sql`
10. `20260120000006_performance_optimizations.sql`
11. `20260121000000_profile_trigger.sql`
12. `20260122000000_social_features.sql`

**How:** Open file in Cursor → copy all SQL → paste in SQL Editor → **Run** → wait for success → next file.

**Note:** `docs/MIGRATIONS.md` lists `20260116000000_create_books_table.sql` — that file does **not** exist; books are in `initial_schema.sql`.

### Step 5.3 — Optional seed data

**Where:** Terminal (with `.env.local` loaded):

```bash
npm run db:seed -- --create-profiles --minimal
```

---

## Part 6 — Stripe webhooks

### Local development (Stripe CLI)

**Where to install:** [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)

**Terminal 1** — app running (`npm run dev`).

**Terminal 2:**

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhook
```

**Where to enter:** Copy printed `whsec_...` → `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

Restart `npm run dev` after changing `.env.local`.

---

### Production (Stripe Dashboard → GCP)

**Where to go:**

1. [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. **Add endpoint**
3. **Endpoint URL:** `https://YOUR_PRODUCTION_DOMAIN/api/webhook`
4. Select events your app handles (checkout completed, etc. — see [docs/WEBHOOK_TESTING.md](docs/WEBHOOK_TESTING.md))
5. **Add endpoint** → reveal **Signing secret** (`whsec_...`)

**Where to enter the signing secret:**

| Deploy target | Where |
|---------------|--------|
| Cloud Run | GCP Secret Manager → secret `stripe-webhook-secret` (Part 4.2) |
| Vercel | Project → Settings → Environment Variables → `STRIPE_WEBHOOK_SECRET` |
| Local only | `.env.local` |

---

## Part 7 — Merge PR #73 and close the loop

### Step 7.1 — Merge

**Where:** [PR #73](https://github.com/redinc23/my_publishing/pull/73)

1. Confirm **test** job is green (Part 2).
2. **Merge pull request** → confirm merge to `main`.

### Step 7.2 — Post-merge checks

| Check | Where |
|-------|--------|
| GitHub Actions on `main` | Repo → **Actions** tab → latest workflow on `main` |
| Cloud Build (if trigger exists) | GCP → Cloud Build → History |
| Health | `https://<prod-domain>/api/health` |

### Step 7.3 — Stale PR cleanup (optional)

**Where:** [Pull requests](https://github.com/redinc23/my_publishing/pulls) → filter **Open**

For each old agent PR (#48, codex/*, etc.): open → if diff is obsolete vs `main` → **Close pull request** with note “superseded by main / PR #73”.

---

## Part 8 — Phase 2 intake & ownership (optional, for cutover)

Use when you are executing [docs/phase2/](docs/phase2/) handoff, not for basic local dev.

### Step 8.1 — Worksheet

**Where to fill:** Copy and edit in repo:

`docs/phase2/_intake/FIELDS_TO_GATHER.md`  
(or save filled copy as `docs/phase2/_intake/worksheet-export.md` — gitignored if you add it to local ignore)

**What to fill:** Sections 1–6 (GCP IDs, domain, slugs, people names). **No API keys in this file.**

### Step 8.2 — Shell intake

```bash
cp docs/phase2/_intake/environment.example.sh docs/phase2/_intake/environment.local.sh
```

**Where to enter:** `environment.local.sh` — replace every `REPLACE_ME_*` using values from your worksheet.

### Step 8.3 — RACI names

**Where to edit:** `docs/phase2/12-ownership-raci.md`  
Replace `_(worksheet: …)_` with real names and Slack/email contacts.

### Step 8.4 — Signoff evidence

**Where to edit when milestones complete:**

- `docs/phase2/11-handoff-master-checklist.md` — status + evidence URLs
- `docs/phase2/14-evidence-and-signoff-log.md` — formal GO/NO-GO

---

## Part 9 — Manual QA checklist

Do in browser after Parts 1 and 5 (and 6 if testing payments).

| # | Action | Where | Pass? |
|---|--------|-------|-------|
| 1 | Register new user | `/register` | ☐ |
| 2 | Confirm profile exists | Supabase → **Table Editor** → `profiles` | ☐ |
| 3 | Login / logout | `/login` | ☐ |
| 4 | Password reset email | `/reset-password` | ☐ |
| 5 | Non-admin blocked from `/admin` | Incognito → `/admin/dashboard` | ☐ |
| 6 | Admin health page | Admin login → `/admin/health` | ☐ |
| 7 | Browse books | `/books` | ☐ |
| 8 | Checkout (test card) | Book → checkout; Stripe test card `4242...` | ☐ |
| 9 | Webhook received | Stripe Dashboard → Webhooks → event log | ☐ |

Stripe test cards: [stripe.com/docs/testing](https://stripe.com/docs/testing)

---

## Quick map — “I have a value, where does it go?”

| Value | Local file | GitHub Actions | GCP Secret Manager | Cloud Build subs | Vercel env |
|-------|------------|----------------|--------------------|------------------|------------|
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` | `NEXT_PUBLIC_SUPABASE_URL` | — | `_NEXT_PUBLIC_SUPABASE_URL` | same name |
| Supabase anon | `.env.local` | secret | — | `_NEXT_PUBLIC_SUPABASE_ANON_KEY` | same |
| Supabase service role | `.env.local` | `SUPABASE_SERVICE_ROLE_KEY` | `supabase-service-role-key` | — (via deploy secrets) | `SUPABASE_SERVICE_ROLE_KEY` |
| Stripe publishable | `.env.local` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | — | `_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | same |
| Stripe secret | `.env.local` | — | `stripe-secret-key` | — | `STRIPE_SECRET_KEY` |
| Stripe webhook | `.env.local` | — | `stripe-webhook-secret` | — | `STRIPE_WEBHOOK_SECRET` |
| Site URL | `.env.local` | `NEXT_PUBLIC_SITE_URL` | — | `_NEXT_PUBLIC_SITE_URL` | same |
| OpenAI | `.env.local` | — | `openai-api-key` | — | optional |
| Resend | `.env.local` | — | `resend-api-key` | — | optional |
| GCP project ID | `environment.local.sh` | — | — | `$PROJECT_ID` in build | — |

---

## Decisions you still need to record (not a paste location)

Comment on GitHub issues when you decide:

| Decision | Issue |
|----------|-------|
| Production = Cloud Run **or** Vercel **or** Amplify | [#70](https://github.com/redinc23/my_publishing/issues/70) |
| Rename repo to `mangu-publishers`? | [#71](https://github.com/redinc23/my_publishing/issues/71) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| CI: “URL and Key are required” for Supabase | GitHub secrets empty | Part 2 |
| `npm run dev` exits on env validation | Missing 3 Supabase vars | Part 1.2 |
| Webhook 400/401 | Wrong `STRIPE_WEBHOOK_SECRET` | Part 6; restart app |
| Cloud Run healthy but no payments | Missing Stripe secrets in Secret Manager | Part 4.2 |
| Empty books page | Migrations not run or no seed | Part 5 |
| Vercel deploy failed on PR | Vercel project env not set | Part 3 |

---

*End of supplement. Return to [Master RICEF](mangu_publishers_master_ricef.md) for requirements, controls, backlog, and signoff gates.*
