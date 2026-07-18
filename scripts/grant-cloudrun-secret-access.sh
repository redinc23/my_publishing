#!/usr/bin/env bash
# Grant the Cloud Run runtime service account read access to the production
# secrets it mounts at deploy time (--set-secrets in cloudbuild.yaml).
#
# P0-020 reference implementation (least privilege — CCR-008). Idempotent:
# re-running only adds missing IAM bindings. No secret VALUES are ever read,
# printed, or logged — this grants access to names only.
#
# Usage:
#   ./scripts/grant-cloudrun-secret-access.sh              # apply bindings
#   DRY_RUN=1 ./scripts/grant-cloudrun-secret-access.sh    # print, change nothing
#   SERVICE_ACCOUNT=svc@proj.iam.gserviceaccount.com \
#     ./scripts/grant-cloudrun-secret-access.sh            # override runtime SA
#
# Overrides (see scripts/gcp-config.sh): PROJECT_ID, REGION, SERVICE_NAME.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gcp-config.sh
source "${ROOT}/scripts/gcp-config.sh"

DRY_RUN="${DRY_RUN:-0}"
ROLE="roles/secretmanager.secretAccessor"

command -v gcloud >/dev/null 2>&1 || {
  echo "ERROR: gcloud CLI not found. Install the Google Cloud SDK first." >&2
  exit 1
}

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: Set PROJECT_ID or run: gcloud config set project YOUR_ID" >&2
  exit 1
fi

# Resolve the Cloud Run runtime service account:
#   1. explicit SERVICE_ACCOUNT override, else
#   2. the SA the deployed service actually runs as, else
#   3. the project's default compute SA (what cloudbuild.yaml deploys with today).
resolve_service_account() {
  if [[ -n "${SERVICE_ACCOUNT:-}" ]]; then
    echo "${SERVICE_ACCOUNT}"
    return
  fi

  local sa
  sa="$(gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
  if [[ -n "${sa}" ]]; then
    echo "${sa}"
    return
  fi

  local num
  num="$(gcloud projects describe "${PROJECT_ID}" \
    --format='value(projectNumber)' 2>/dev/null || true)"
  if [[ -z "${num}" ]]; then
    echo "ERROR: could not resolve a service account (service not deployed and" >&2
    echo "       project number lookup failed). Pass SERVICE_ACCOUNT=... explicitly." >&2
    exit 1
  fi
  echo "${num}-compute@developer.gserviceaccount.com"
}

SA="$(resolve_service_account)"
MEMBER="serviceAccount:${SA}"

echo "Project:          ${PROJECT_ID}"
echo "Service:          ${SERVICE_NAME} (${REGION})"
echo "Runtime SA:       ${SA}"
echo "Role:             ${ROLE}"
[[ "${DRY_RUN}" == "1" ]] && echo "Mode:             DRY_RUN (no changes will be made)"
echo

grant=0
skip=0
missing=0

grant_access() {
  local secret="$1"
  local optional="$2"

  if ! gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    if [[ "${optional}" == "optional" ]]; then
      echo "SKIP    ${secret} (optional secret not present)"
      skip=$((skip + 1))
    else
      echo "MISSING ${secret} (REQUIRED secret does not exist — create it via" \
        "scripts/sync-gcp-secrets-from-env.sh before deploy)"
      missing=$((missing + 1))
    fi
    return
  fi

  # Already bound? Keep it idempotent and quiet.
  if gcloud secrets get-iam-policy "${secret}" --project="${PROJECT_ID}" \
    --flatten="bindings[].members" \
    --filter="bindings.role=${ROLE} AND bindings.members=${MEMBER}" \
    --format="value(bindings.members)" 2>/dev/null | grep -q "${MEMBER}"; then
    echo "OK      ${secret} (already granted)"
    skip=$((skip + 1))
    return
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "WOULD   grant ${ROLE} on ${secret} to ${MEMBER}"
    grant=$((grant + 1))
    return
  fi

  gcloud secrets add-iam-policy-binding "${secret}" \
    --project="${PROJECT_ID}" \
    --member="${MEMBER}" \
    --role="${ROLE}" \
    --condition=None \
    >/dev/null
  echo "GRANTED ${secret}"
  grant=$((grant + 1))
}

# secret entries are "secret-name:ENV_VAR" — we only need the name here.
for entry in "${GCP_REQUIRED_SECRETS[@]}"; do
  grant_access "${entry%%:*}" required
done
for entry in "${GCP_OPTIONAL_SECRETS[@]}"; do
  grant_access "${entry%%:*}" optional
done

echo
echo "Summary: ${grant} granted/pending, ${skip} already-ok/skipped, ${missing} required-missing."

if [[ "${missing}" -gt 0 ]]; then
  echo "FAIL: required secrets are missing — deploy will fail closed (CCR-007)." >&2
  exit 1
fi
echo "Done. Verify end-to-end with ./scripts/verify-gcp-production.sh after deploy."
