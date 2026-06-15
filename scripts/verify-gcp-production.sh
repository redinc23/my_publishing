#!/usr/bin/env bash
# Verify GCP Secret Manager secrets and Cloud Run health for mangu-publishers.
# Requires: gcloud authenticated (gcloud auth login)
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-mangu-publishers}"
PROD_DOMAIN="${PROD_DOMAIN:-https://mangu-publishers.com}"

REQUIRED_SECRETS=(
  supabase-service-role-key
  stripe-secret-key
  stripe-webhook-secret
)

OPTIONAL_SECRETS=(
  resend-api-key
  openai-api-key
  upstash-redis-rest-url
  upstash-redis-rest-token
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

if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "ERROR: gcloud credentials are not valid for non-interactive use."
  echo "Run: gcloud auth login && gcloud config set project ${PROJECT_ID}"
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

echo
echo "--- Secret Manager (optional runtime features) ---"
for secret in "${OPTIONAL_SECRETS[@]}"; do
  if gcloud secrets describe "${secret}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "  OK       ${secret}"
  else
    echo "  OPTIONAL ${secret} (missing)"
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
if gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(metadata.name)' &>/dev/null; then
  url="$(gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --format='value(status.url)' 2>/dev/null || true)"
  if [[ -z "${url}" ]]; then
    echo "  Cloud Run default URL: (disabled — --no-default-url)"
    echo "  Using custom domain for health checks: ${PROD_DOMAIN}"
    url="${PROD_DOMAIN}"
  else
    echo "  URL: ${url}"
  fi
  echo
  echo "--- Liveness check GET ${url}/api/live ---"
  if curl -sfS "${url}/api/live" | head -c 500; then
    echo
    echo
    echo "Liveness endpoint responded."
  else
    echo "WARNING: /api/live failed or returned non-2xx"
    exit 1
  fi

  echo
  echo "--- Readiness check GET ${url}/api/health?ready=1 ---"
  if curl -sfS "${url}/api/health?ready=1" | head -c 500; then
    echo
    echo
    echo "Readiness endpoint responded."
  else
    echo "WARNING: /api/health?ready=1 failed or returned non-2xx"
    exit 1
  fi
else
  echo "  Service not found or gcloud not authenticated."
  echo "  Run: gcloud auth login"
  exit 1
fi

echo
echo "=== Verification complete ==="
