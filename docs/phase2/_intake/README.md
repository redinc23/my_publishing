# Phase 2 intake — environment and worksheet fields

Use this folder to capture **non-secret** identifiers from your Drive worksheet or ops spreadsheet so command blocks in [`05-milestone-implementation-plan.md`](../05-milestone-implementation-plan.md) stay consistent.

> Warning: files in this directory may contain real infrastructure identifiers.
> Never commit `environment.local.sh` or editor recovery files like `*.save`.
> `.gitignore` rules enforce this safety and should not be changed without review.

**Start here:** **[`ENV_SETUP_WALKTHROUGH.md`](ENV_SETUP_WALKTHROUGH.md)** — step-by-step instructions for copying, filling, validating, and safely handling local environment values.

Then use **[`FIELDS_TO_GATHER.md`](FIELDS_TO_GATHER.md)** as the field checklist for where each value comes from.

## Steps

1. Copy [`environment.example.sh`](environment.example.sh) → **`environment.local.sh`** (same directory).
2. Fill every value marked `REPLACE_ME`. **`environment.local.sh` is gitignored** — do not commit real project IDs or billing IDs unless your repo policy allows it.
3. Optionally export your Google worksheet as `.md` / `.csv` and drop it here as **`worksheet-export.md`** (also gitignored) for your own reference — not required for builds.

## Do not commit

- API tokens, Sanity read tokens, `SENTRY_AUTH_TOKEN`, webhook secrets
- Personal phone numbers (use paging aliases / Slack if allowed)

## Authoritative vs optional mirrors

- **People and RACI:** authoritative table is [`12-ownership-raci.md`](../12-ownership-raci.md). Keep names there in sync with any mirror variables you add to `environment.local.sh`.
- **GCP routes / domains:** sourcing `environment.local.sh` from [`05`](../05-milestone-implementation-plan.md) sets `PROJECT_ID`, `CUSTOM_DOMAIN`, sample slugs, etc., for copy/paste command blocks elsewhere (`06`, `07`, …).

## Minimum fields (from worksheet)

| Variable | Purpose |
|---|---|
| `PROJECT_ID` | GCP project |
| `REGION` | e.g. `us-central1` |
| `CUSTOM_DOMAIN` | hostname only (no `https://`) |
| `BILLING_ACCOUNT_ID` | budgets / billing commands |
| `KNOWN_GOOD_REVISION` | rollback drill revision name |
| `SAMPLE_*_SLUG` | smoke URLs |
| `BUILD_ID` | optional example build for log tail command |
| `SAMPLE_HASHED_JS_BASENAME` | optional `curl -I` on hashed asset |
