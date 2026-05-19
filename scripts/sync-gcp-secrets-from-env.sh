#!/usr/bin/env bash
# Sync server secrets from .env.local into GCP Secret Manager (names match cloudbuild.yaml).
# Usage: ./scripts/sync-gcp-secrets-from-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found"
  exit 1
fi

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: Set PROJECT_ID or run gcloud config set project YOUR_ID"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

upsert_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "${value}" ]]; then
    echo "SKIP ${name} (empty in .env.local)"
    return
  fi
  if gcloud secrets describe "${name}" --project="${PROJECT_ID}" &>/dev/null; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=- --project="${PROJECT_ID}"
    echo "UPDATED ${name}"
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" --data-file=- --project="${PROJECT_ID}"
    echo "CREATED ${name}"
  fi
}

echo "Syncing secrets to project ${PROJECT_ID}..."

upsert_secret supabase-service-role-key "${SUPABASE_SERVICE_ROLE_KEY:-}"
upsert_secret stripe-secret-key "${STRIPE_SECRET_KEY:-}"
upsert_secret stripe-webhook-secret "${STRIPE_WEBHOOK_SECRET:-}"

# Optional — only if set locally
if [[ -n "${RESEND_API_KEY:-}" ]]; then
  upsert_secret resend-api-key "${RESEND_API_KEY}"
fi
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  upsert_secret openai-api-key "${OPENAI_API_KEY}"
fi

echo "Done. Run ./scripts/verify-gcp-production.sh to confirm."
