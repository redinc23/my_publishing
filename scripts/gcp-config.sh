#!/usr/bin/env bash
# Canonical GCP defaults for deploy/verify scripts.
# Source from other scripts: source "$(dirname "$0")/gcp-config.sh"
#
# NOTE (ADR-001): the Cloud Run surface configured here is LEGACY /
# non-canonical for GO — Vercel is the sole canonical production platform.
# These defaults remain for the compatibility/emergency path (apex may still
# resolve to Cloud Run until the Phase 15 DNS cutover).
#
# Override via environment (P0-020 canonical names):
#   GCP_PROJECT_ID, GCP_REGION, CLOUD_RUN_SERVICE
# Legacy aliases PROJECT_ID, REGION, SERVICE_NAME are still honored;
# the canonical GCP_* names win when both are set.
# Resolution order for PROJECT_ID: env var → gcloud config → canonical default

# P0-020 canonical env names → internal names.
if [[ -n "${GCP_PROJECT_ID:-}" ]]; then
  PROJECT_ID="${GCP_PROJECT_ID}"
fi
if [[ -n "${GCP_REGION:-}" ]]; then
  REGION="${GCP_REGION}"
fi
if [[ -n "${CLOUD_RUN_SERVICE:-}" ]]; then
  SERVICE_NAME="${CLOUD_RUN_SERVICE}"
fi

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
