# Environment Setup Walkthrough (Phase 2 Intake)

This guide explains exactly how to fill your local environment file, where each value comes from, and how to avoid committing sensitive data.

Use this with:
- `docs/phase2/_intake/environment.example.sh`
- `docs/phase2/_intake/FIELDS_TO_GATHER.md`

## 1) What you are creating

You will create a local file named:

- `docs/phase2/_intake/environment.local.sh`

This is your working file for project-specific values. It is gitignored and should stay local.

## 2) Before you start

Have access to:
- Your Google Cloud project (for project, billing, Cloud Run, and Artifact Registry values)
- Your app content/source system (for sample route slugs)
- Any internal notes that list approved public environment values

Do not collect or paste secrets into this file. Secret values belong in Google Secret Manager and are injected at deploy time.

## 3) Copy the template

From the repo root:

```bash
cp docs/phase2/_intake/environment.example.sh docs/phase2/_intake/environment.local.sh
```

Then open `docs/phase2/_intake/environment.local.sh` and replace each `REPLACE_ME_*` value.

## 4) Fill values by section

### A. GCP / Infrastructure

Fill:
- `PROJECT_ID`: GCP Console project picker, or run `gcloud config get-value project`
- `REGION`: default is usually `us-central1` unless your workloads run elsewhere
- `SERVICE_NAME`: use `mangu-publishers` unless your Cloud Run service name differs
- `AR_REPO`: Artifact Registry Docker repo (default `web-images`)
- `CUSTOM_DOMAIN`: hostname only, no `https://` (example: `publishers.example.com`)
- `BILLING_ACCOUNT_ID`: GCP Billing account ID

If you do not know one yet:
- Keep the placeholder in place and note it in `FIELDS_TO_GATHER.md` so someone with access can fill it.

### B. Runtime / Build

Fill:
- `PORT`: keep `3000` for Next.js standalone
- `RELEASE_SHA`: can stay as `$(git rev-parse --short HEAD)` so it auto-resolves
- `KNOWN_GOOD_REVISION`: Cloud Run revision ID you trust for rollback drills

If unknown:
- Leave `KNOWN_GOOD_REVISION` as placeholder until one stable revision is selected.

### C. Content sample slugs

Fill:
- `SAMPLE_BOOK_SLUG`
- `SAMPLE_AUTHOR_SLUG`
- `SAMPLE_CATEGORY_SLUG`

These are slug segments only, not full URLs.

Where to find:
- CMS/admin content records or existing live route paths.

If unknown:
- Use temporary known-published content and update later before cutover checks.

### D. Public environment variables (`NEXT_PUBLIC_*`)

Fill:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (usually `https://${CUSTOM_DOMAIN}`)

Important:
- `NEXT_PUBLIC_*` values are visible in browser code at runtime.
- Only put non-secret values here.

If unknown:
- Ask the platform/app owner for approved public values; do not guess.

### E. Server secrets (do not place real values here)

Examples in comments:
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`

These must be stored in Secret Manager and injected during deploy (`--set-secrets`).  
Do not place real secret strings in `environment.local.sh` if this repo can be shared.

### F. Optional observability and probes

Optional fields:
- `SENTRY_PROJECT_SLUG`
- `SENTRY_EVIDENCE_URL`
- `BUILD_ID`
- `SAMPLE_HASHED_JS_BASENAME`
- `P0_8_SAMPLE_ROUTE`

Use these when you run monitoring evidence and probe steps in Phase 2 docs.

## 5) Public vs secret rule (quick test)

Ask: "Would I be okay with this value being visible to every website visitor?"

- If yes, it can be `NEXT_PUBLIC_*` or another non-secret field.
- If no, it must be a server secret in Secret Manager.

Never rename a secret to `NEXT_PUBLIC_*`.

## 6) Validate locally

From repo root:

```bash
source docs/phase2/_intake/environment.local.sh
echo "$PROJECT_ID"
echo "$CUSTOM_DOMAIN"
echo "$KNOWN_GOOD_REVISION"
echo "$SAMPLE_BOOK_SLUG"
```

If an echo is empty or still shows `REPLACE_ME_*`, that field still needs work.

## 7) Verify git safety

Run:

```bash
git status
git check-ignore -v docs/phase2/_intake/environment.local.sh
```

Expected:
- `environment.local.sh` should not appear as a staged file.
- `git check-ignore` should show an ignore rule match.

If it appears in `git status`:
- Stop and check `.gitignore` files before committing anything.

## 8) Where placeholders come from

Use `docs/phase2/_intake/FIELDS_TO_GATHER.md` as the collection checklist:
- Sections 1-5 feed values into `environment.local.sh`.
- Section 6 feeds names/contacts into `docs/phase2/12-ownership-raci.md`.
- Section 7 tracks evidence links for handoff/checklists.

## 9) Common mistakes to avoid

- Putting secrets in `NEXT_PUBLIC_*`
- Including `https://` in `CUSTOM_DOMAIN`
- Using full URLs instead of slug segments for `SAMPLE_*_SLUG`
- Committing `environment.local.sh`
- Leaving placeholders unresolved before milestone execution

