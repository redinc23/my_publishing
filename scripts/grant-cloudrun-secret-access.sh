#!/usr/bin/env bash
# Grant Cloud Run runtime service account access to Secret Manager secrets.
# Usage: ./scripts/grant-cloudrun-secret-access.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-delta-wonder-488420-i3}"
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
RUNTIME_SA="${RUNTIME_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"

REQUIRED_SECRETS=(
  supabase-service-role-key
  stripe-secret-key
  stripe-webhook-secret
)

OPTIONAL_SECRETS=(
  resend-api-key
  openai-api-key
)

echo "=== Grant Secret Manager access for Cloud Run ==="
echo "Project:  ${PROJECT_ID}"
echo "Runtime SA: ${RUNTIME_SA}"
echo

grant() {
  local secret="$1"
  if ! gcloud secrets describe "${secret}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "SKIP  ${secret} (not found)"
    return
  fi
  gcloud secrets add-iam-policy-binding "${secret}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
  echo "OK    ${secret} -> ${RUNTIME_SA}"
}

for secret in "${REQUIRED_SECRETS[@]}"; do
  grant "${secret}"
done

for secret in "${OPTIONAL_SECRETS[@]}"; do
  grant "${secret}"
done

echo
echo "Done. Redeploy with: ./scripts/gcloud-build-submit.sh"
