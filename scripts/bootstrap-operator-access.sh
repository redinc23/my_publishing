#!/usr/bin/env bash
# Bootstrap operator access: verify CLIs, auth, env, GCP, domain, and Stripe webhook.
# Usage: ./scripts/bootstrap-operator-access.sh [--sync-secrets]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

PROJECT_ID="delta-wonder-488420-i3"
REGION="us-central1"
SERVICE_NAME="mangu-publishers"
SUPABASE_PROJECT_REF="tkzvikozrcynhwsqtkqp"
PROD_DOMAIN="https://mangu-publishers.com"
WEBHOOK_PATH="/api/webhook"
WEBHOOK_URL="${PROD_DOMAIN}${WEBHOOK_PATH}"

SYNC_SECRETS=false
for arg in "$@"; do
  case "${arg}" in
    --sync-secrets) SYNC_SECRETS=true ;;
    -h|--help)
      echo "Usage: $0 [--sync-secrets]"
      echo "  --sync-secrets  Push .env.local secrets to GCP Secret Manager before verify"
      exit 0
      ;;
    *)
      echo "Unknown option: ${arg}"
      exit 1
      ;;
  esac
done

PASS=0
FAIL=0
WARN=0

pass() { echo "  PASS  $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN  $1"; WARN=$((WARN + 1)); }

echo "=== Bootstrap Operator Access ==="
echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo "Service:  ${SERVICE_NAME}"
echo "Domain:   ${PROD_DOMAIN}"
echo

# --- 1) Preflight tools ---
echo "--- Tools ---"
REQUIRED_TOOLS=(gcloud supabase stripe curl node npm)
for cmd in "${REQUIRED_TOOLS[@]}"; do
  if command -v "${cmd}" >/dev/null 2>&1; then
    pass "${cmd} installed"
  else
    fail "${cmd} missing (install before continuing)"
  fi
done
echo

# --- 2) Auth checks ---
echo "--- Auth ---"

if gcloud auth print-access-token >/dev/null 2>&1; then
  pass "gcloud authenticated"
else
  fail "gcloud not authenticated — run: gcloud auth login && gcloud auth application-default login"
fi

ACTIVE_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [[ "${ACTIVE_PROJECT}" == "${PROJECT_ID}" ]]; then
  pass "gcloud project is ${PROJECT_ID}"
else
  fail "gcloud project is '${ACTIVE_PROJECT:-unset}' — run: gcloud config set project ${PROJECT_ID}"
fi

ACTIVE_REGION="$(gcloud config get-value run/region 2>/dev/null || true)"
if [[ "${ACTIVE_REGION}" == "${REGION}" ]]; then
  pass "gcloud run/region is ${REGION}"
else
  warn "gcloud run/region is '${ACTIVE_REGION:-unset}' — run: gcloud config set run/region ${REGION}"
fi

if supabase projects list 2>/dev/null | grep -q "${SUPABASE_PROJECT_REF}"; then
  pass "supabase logged in and project ${SUPABASE_PROJECT_REF} visible"
else
  fail "supabase not linked — run: supabase login && supabase link --project-ref ${SUPABASE_PROJECT_REF}"
fi

if stripe config --list 2>/dev/null | grep -q "test_mode_api_key\|live_mode_api_key\|account_id"; then
  pass "stripe CLI logged in"
else
  fail "stripe CLI not logged in — run: stripe login"
fi
echo

# --- 3) Local env check ---
echo "--- Local env (.env.local) ---"
ENV_FILE="${ROOT}/.env.local"
REQUIRED_ENV_KEYS=(
  SUPABASE_SERVICE_ROLE_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  NEXT_PUBLIC_SITE_URL
)

if [[ -f "${ENV_FILE}" ]]; then
  pass ".env.local exists"
  # shellcheck disable=SC1090
  set -a
  source "${ENV_FILE}"
  set +a
  for key in "${REQUIRED_ENV_KEYS[@]}"; do
    val="${!key:-}"
    if [[ -n "${val}" && "${val}" != *"your-"* && "${val}" != *"REPLACE"* ]]; then
      pass "${key} set"
    else
      fail "${key} missing or placeholder in .env.local"
    fi
  done
else
  fail ".env.local missing — run: cp .env.local.example .env.local and fill values"
fi
echo

# --- Optional secret sync ---
if [[ "${SYNC_SECRETS}" == true ]]; then
  echo "--- Sync secrets to GCP ---"
  if [[ -f "${ENV_FILE}" ]] && gcloud auth print-access-token >/dev/null 2>&1; then
    if PROJECT_ID="${PROJECT_ID}" "${ROOT}/scripts/sync-gcp-secrets-from-env.sh"; then
      pass "secrets synced to GCP Secret Manager"
    else
      fail "sync-gcp-secrets-from-env.sh failed"
    fi
  else
    fail "--sync-secrets skipped: need .env.local and gcloud auth"
  fi
  echo
fi

# --- 4) GCP production verify ---
echo "--- GCP production verify ---"
if PROJECT_ID="${PROJECT_ID}" REGION="${REGION}" SERVICE_NAME="${SERVICE_NAME}" \
  "${ROOT}/scripts/verify-gcp-production.sh"; then
  pass "verify-gcp-production.sh passed"
else
  fail "verify-gcp-production.sh failed"
fi
echo

# --- 5) Domain smoke checks ---
echo "--- Domain smoke checks ---"

check_http() {
  local label="$1"
  local url="$2"
  local expect_code="$3"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null || echo "000")"
  if [[ "${code}" == "${expect_code}" ]]; then
    pass "${label} (${url}) -> HTTP ${code}"
  else
    fail "${label} (${url}) -> HTTP ${code} (expected ${expect_code})"
  fi
}

check_http "GET /api/live" "${PROD_DOMAIN}/api/live" "200"
check_http "GET /api/health (startup probe)" "${PROD_DOMAIN}/api/health" "200"
check_http "GET /api/webhook (method gate)" "${WEBHOOK_URL}" "405"

ready_code="$(curl -sS -o /dev/null -w '%{http_code}' "${PROD_DOMAIN}/api/health?ready=1" 2>/dev/null || echo "000")"
if [[ "${ready_code}" == "200" ]]; then
  pass "GET /api/health?ready=1 (full readiness) -> HTTP 200"
else
  warn "GET /api/health?ready=1 -> HTTP ${ready_code} — run ./scripts/apply-supabase-migrations.sh if profiles table missing"
fi
echo

# --- 6) Stripe webhook via CLI ---
echo "--- Stripe webhook (live) ---"
if [[ -n "${STRIPE_SECRET_KEY:-}" ]]; then
  if stripe webhook_endpoints list --api-key "${STRIPE_SECRET_KEY}" 2>/dev/null | grep -q "${WEBHOOK_URL}"; then
    pass "live webhook endpoint includes ${WEBHOOK_URL}"
  else
    fail "live webhook endpoint missing ${WEBHOOK_URL} — configure in Stripe dashboard"
  fi
else
  fail "STRIPE_SECRET_KEY missing in .env.local — cannot verify live webhook endpoint"
fi
echo

# --- 7) Summary ---
echo "=== Summary ==="
echo "  PASS: ${PASS}"
echo "  FAIL: ${FAIL}"
echo "  WARN: ${WARN}"
echo

if [[ "${FAIL}" -eq 0 ]]; then
  echo "ALL CHECKS PASSED"
  echo
  echo "Tell the agent: bootstrap passed — go verify production"
  exit 0
else
  echo "CHECKS FAILED (${FAIL} failure(s))"
  echo
  echo "Fix failures above, then rerun: ./scripts/bootstrap-operator-access.sh"
  exit 1
fi
