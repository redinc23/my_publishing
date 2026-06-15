#!/usr/bin/env bash
# Canonical MANGU production launch wrapper.
#
# This script intentionally delegates to the maintained Cloud Build + Cloud Run
# helpers so there is one production deployment path:
#   cloudbuild.yaml -> Artifact Registry -> Cloud Run service mangu-publishers
#
# Fill .env.local first, authenticate with gcloud, apply Supabase migrations via
# docs/launch/PRODUCTION_ACCOUNT_LINKS.md, then run this wrapper.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ID="${PROJECT_ID:-delta-wonder-488420-i3}"

cd "${ROOT}"

echo "==> MANGU canonical production launch"
echo "Project: ${PROJECT_ID}"
echo "Service: mangu-publishers"
echo "Region:  ${REGION:-us-central1}"
echo

for cmd in gcloud git curl npm; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "ERROR: Missing required command: ${cmd}"
    exit 1
  fi
done

if [[ ! -f ".env.local" ]]; then
  echo "ERROR: .env.local is required for build substitutions and secret sync."
  echo "Copy .env.local.example to .env.local, fill real values, then retry."
  exit 1
fi

if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "ERROR: gcloud is not authenticated for non-interactive use."
  echo "Run: gcloud auth login && gcloud config set project ${PROJECT_ID}"
  exit 1
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

echo "==> Syncing server secrets to GCP Secret Manager"
PROJECT_ID="${PROJECT_ID}" ./scripts/sync-gcp-secrets-from-env.sh

echo
echo "==> Submitting Cloud Build"
PROJECT_ID="${PROJECT_ID}" ./scripts/gcloud-build-submit.sh

echo
echo "==> Verifying Cloud Run deployment"
PROJECT_ID="${PROJECT_ID}" ./scripts/verify-gcp-production.sh

echo
echo "Launch wrapper complete. Finish Stripe webhook verification and manual QA from docs/LAUNCH_CHECKLIST.md."
