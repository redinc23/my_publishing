#!/usr/bin/env bash
# Canonical GCP defaults for deploy/verify scripts.
# Source from other scripts: source "$(dirname "$0")/gcp-config.sh"
#
# Override via environment: PROJECT_ID, REGION, SERVICE_NAME
# Resolution order for PROJECT_ID: env var → gcloud config → canonical default

GCP_DEFAULT_PROJECT_ID="${GCP_DEFAULT_PROJECT_ID:-delta-wonder-488420-i3}"
GCP_DEFAULT_REGION="${GCP_DEFAULT_REGION:-us-central1}"
GCP_DEFAULT_SERVICE_NAME="${GCP_DEFAULT_SERVICE_NAME:-mangu-publishers}"

if [[ -z "${PROJECT_ID:-}" ]]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
  # gcloud may print "(unset)" when no project is configured
  if [[ "${PROJECT_ID}" == "(unset)" ]]; then
    PROJECT_ID=""
  fi
fi
PROJECT_ID="${PROJECT_ID:-${GCP_DEFAULT_PROJECT_ID}}"

REGION="${REGION:-${GCP_DEFAULT_REGION}}"
SERVICE_NAME="${SERVICE_NAME:-${GCP_DEFAULT_SERVICE_NAME}}"

# GCP Secret Manager name → Cloud Run env var (must match cloudbuild.yaml --set-secrets)
GCP_REQUIRED_SECRETS=(
  supabase-service-role-key:SUPABASE_SERVICE_ROLE_KEY
  stripe-secret-key:STRIPE_SECRET_KEY
  stripe-webhook-secret:STRIPE_WEBHOOK_SECRET
)

GCP_OPTIONAL_SECRETS=(
  resend-api-key:RESEND_API_KEY
  openai-api-key:OPENAI_API_KEY
  upstash-redis-rest-url:UPSTASH_REDIS_REST_URL
  upstash-redis-rest-token:UPSTASH_REDIS_REST_TOKEN
)
