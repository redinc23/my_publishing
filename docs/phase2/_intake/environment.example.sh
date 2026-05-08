#!/usr/bin/env bash
# docs/phase2/_intake/environment.example.sh
# Copy to environment.local.sh (gitignored) and fill in real values.
# DO NOT commit secrets to git.

# === GCP / Infrastructure ===
export PROJECT_ID="REPLACE_ME_PROJECT_ID"
export REGION="us-central1"
# Service name is mangu-publishers (consistent across all docs)
export SERVICE_NAME="mangu-publishers"
export AR_REPO="web-images"
export CUSTOM_DOMAIN="REPLACE_ME_CUSTOM_DOMAIN"
export BILLING_ACCOUNT_ID="REPLACE_ME_BILLING_ACCOUNT_ID"

# === Runtime / Build ===
# Next.js 14 standalone runs on port 3000 (default for Next.js standalone output)
export PORT="3000"
export RELEASE_SHA="$(git rev-parse --short HEAD)"
export KNOWN_GOOD_REVISION="REPLACE_ME_KNOWN_GOOD_REVISION"

# === Content Samples ===
export SAMPLE_BOOK_SLUG="REPLACE_ME_BOOK_SLUG"
export SAMPLE_AUTHOR_SLUG="REPLACE_ME_AUTHOR_SLUG"
export SAMPLE_CATEGORY_SLUG="REPLACE_ME_CATEGORY_SLUG"

# === Public Environment Variables (built into client at build time) ===
# These are NOT secrets and can be set via --set-env-vars or build env.
# They are prefixed with NEXT_PUBLIC_* so Next.js knows to inline them
# into the client bundle. Safe for the browser to see.
export NEXT_PUBLIC_SUPABASE_URL="REPLACE_ME_SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="REPLACE_ME_SUPABASE_ANON_KEY"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="REPLACE_ME_STRIPE_PUBLISHABLE_KEY"
export NEXT_PUBLIC_SITE_URL="https://${CUSTOM_DOMAIN}"

# === Server Secrets (NEVER commit real values; use Secret Manager at runtime) ===
# These are mapped via --set-secrets during Cloud Run deploy.
# They must NOT have a NEXT_PUBLIC_ prefix, because that would bake them
# into the client bundle where any visitor can read them.
# Store real values in Google Secret Manager and reference them by name.
#
# Example deploy mapping:
#   --set-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest \
#   --set-secrets STRIPE_SECRET_KEY=stripe-secret-key:latest \
#   --set-secrets RESEND_API_KEY=resend-api-key:latest
#
# export SUPABASE_SERVICE_ROLE_KEY=""   # Secret Manager: supabase-service-role-key
# export STRIPE_SECRET_KEY=""           # Secret Manager: stripe-secret-key
# export RESEND_API_KEY=""              # Secret Manager: resend-api-key

# === Optional / Observability ===
export SENTRY_PROJECT_SLUG=""
export SENTRY_EVIDENCE_URL=""

# === P0 Probe Options ===
export BUILD_ID=""
export SAMPLE_HASHED_JS_BASENAME=""
export P0_8_SAMPLE_ROUTE=""
