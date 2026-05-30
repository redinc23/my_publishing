#!/usr/bin/env bash
# Submit Cloud Build with NEXT_PUBLIC_* values loaded from .env.local.
# Usage: ./scripts/gcloud-build-submit.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"
PROJECT_ID="${PROJECT_ID:-delta-wonder-488420-i3}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-mangu-publishers}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found"
  echo "Run: ./scripts/setup-env-interactive.sh"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

required=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  NEXT_PUBLIC_SITE_URL
)

for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "ERROR: ${key} is empty in .env.local"
    exit 1
  fi
done

SHORT_SHA="$(git -C "${ROOT}" rev-parse --short HEAD 2>/dev/null || echo "local")"

subs="_REGION=${REGION},_SERVICE_NAME=${SERVICE_NAME},SHORT_SHA=${SHORT_SHA}"
subs+=",_NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}"
subs+=",_NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
subs+=",_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}"
subs+=",_NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}"

echo "Submitting Cloud Build to project ${PROJECT_ID}..."
echo "Substitutions loaded from .env.local (values not shown)."

gcloud builds submit \
  --config "${ROOT}/cloudbuild.yaml" \
  --project "${PROJECT_ID}" \
  --substitutions "${subs}"
