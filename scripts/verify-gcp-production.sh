#!/usr/bin/env bash
# Verify GCP Secret Manager secrets and Cloud Run health for mangu-publishers.
# Requires: gcloud authenticated (gcloud auth login)
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-mangu-publishers}"

REQUIRED_SECRETS=(
  supabase-service-role-key
  stripe-secret-key
  stripe-webhook-secret
  resend-api-key
  openai-api-key
)

echo "=== GCP production verification ==="
echo "Project: ${PROJECT_ID}"
echo "Region:  ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: PROJECT_ID not set and gcloud has no default project."
  exit 1
fi

echo "--- Secret Manager (required by cloudbuild.yaml --set-secrets) ---"
missing=0
for secret in "${REQUIRED_SECRETS[@]}"; do
  if gcloud secrets describe "${secret}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "  OK  ${secret}"
  else
    echo "  MISSING  ${secret}"
    missing=$((missing + 1))
  fi
done

if [[ "${missing}" -gt 0 ]]; then
  echo
  echo "Create missing secrets, e.g.:"
  echo "  echo -n 'YOUR_VALUE' | gcloud secrets create stripe-webhook-secret --data-file=- --project=${PROJECT_ID}"
  echo "Or run: ./scripts/sync-gcp-secrets-from-env.sh (after gcloud auth login)"
fi

echo
echo "--- Cloud Run service ---"
if url=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(status.url)' 2>/dev/null); then
  echo "  URL: ${url}"
  echo
  echo "--- Health check GET ${url}/api/health ---"
  if curl -sfS "${url}/api/health" | head -c 500; then
    echo
    echo
    echo "Health endpoint responded."
  else
    echo "WARNING: /api/health failed or returned non-2xx"
    exit 1
  fi
else
  echo "  Service not found or gcloud not authenticated."
  echo "  Run: gcloud auth login"
  exit 1
fi

echo
echo "=== Verification complete ==="
