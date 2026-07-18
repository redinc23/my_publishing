#!/usr/bin/env bash
# Verify the deployed Cloud Run production service against the launch gates.
#
# P0-020 reference implementation. Covers the Phase 14 deploy dossier (D1–D8):
#   D1 Cloud Run service is READY, serving 100% traffic to the latest revision
#   D2 Deployed revision identity + image tag/digest (release-SHA correlation)
#   D3 Startup probe   GET /api/health          → 200
#   D4 Readiness probe GET /api/health?ready=1   → 200 and ready:true (G7)
#   D5 Public route truth (no 5xx): /, /books, /comics, /papers, /login, /register
#   D6 Env bake: served JS contains no localhost/127.0.0.1 origin (CCR-018)
#   D7 Secret hygiene: served assets leak no secret material (CCR-009)
#   D8 Webhook guard: POST /api/webhook without a signature → 400 (fail closed)
#
# Read-only. No secret values are printed. Non-zero exit = not GO.
#   exit 0  all checks pass (candidate is GO-eligible for G1/G2/G7 dossier)
#   exit 1  a hard check failed (service not ready, route 5xx, secret leak, ...)
#   exit 2  degraded/warn only (operator review; e.g. Stripe warn, TLS note)
#
# Usage:
#   ./scripts/verify-gcp-production.sh
#   BASE_URL=https://www.mangu-publishers.com ./scripts/verify-gcp-production.sh
#   EXPECT_SHA=16dc1d7 ./scripts/verify-gcp-production.sh   # assert revision SHA
#
# Overrides (see scripts/gcp-config.sh): PROJECT_ID, REGION, SERVICE_NAME.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gcp-config.sh
source "${ROOT}/scripts/gcp-config.sh"

FAIL=0
WARN=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
warn() {
  printf '  \033[33mWARN\033[0m  %s\n' "$1"
  WARN=$((WARN + 1))
}
fail() {
  printf '  \033[31mFAIL\033[0m  %s\n' "$1"
  FAIL=$((FAIL + 1))
}

command -v curl >/dev/null 2>&1 || {
  echo "ERROR: curl is required." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Resolve target URL: BASE_URL → NEXT_PUBLIC_SITE_URL (.env.local) → Cloud Run
# ---------------------------------------------------------------------------
BASE_URL="${BASE_URL:-}"
if [[ -z "${BASE_URL}" && -f "${ROOT}/.env.local" ]]; then
  BASE_URL="$(grep -E '^NEXT_PUBLIC_SITE_URL=' "${ROOT}/.env.local" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"'' )"
fi

SERVICE_READY_CHECKED=0
if command -v gcloud >/dev/null 2>&1 && [[ -n "${PROJECT_ID}" ]]; then
  echo "== D1/D2  Cloud Run service state =="
  if READY_JSON="$(gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --format='value(status.conditions.filter("type:Ready").firstof("status"))' 2>/dev/null)"; then
    SERVICE_READY_CHECKED=1
    if [[ "${READY_JSON}" == "True" ]]; then
      pass "service ${SERVICE_NAME} Ready=True"
    else
      fail "service ${SERVICE_NAME} Ready=${READY_JSON:-unknown}"
    fi

    LATEST_READY="$(gcloud run services describe "${SERVICE_NAME}" \
      --region="${REGION}" --project="${PROJECT_ID}" \
      --format='value(status.latestReadyRevisionName)' 2>/dev/null || true)"
    SERVING_REV="$(gcloud run services describe "${SERVICE_NAME}" \
      --region="${REGION}" --project="${PROJECT_ID}" \
      --format='value(status.traffic.filter("percent:100").firstof("revisionName"))' 2>/dev/null || true)"
    IMAGE="$(gcloud run services describe "${SERVICE_NAME}" \
      --region="${REGION}" --project="${PROJECT_ID}" \
      --format='value(spec.template.spec.containers[0].image)' 2>/dev/null || true)"
    echo "        latestReadyRevision: ${LATEST_READY:-?}"
    echo "        serving(100%):       ${SERVING_REV:-?}"
    echo "        image:               ${IMAGE:-?}"
    if [[ -n "${SERVING_REV}" && -n "${LATEST_READY}" && "${SERVING_REV}" == "${LATEST_READY}" ]]; then
      pass "100% traffic on latest ready revision"
    elif [[ -n "${SERVING_REV}" ]]; then
      warn "serving revision != latest ready (traffic split or pinned) — confirm intentional"
    fi
    if [[ -n "${EXPECT_SHA:-}" ]]; then
      if [[ "${IMAGE}" == *"${EXPECT_SHA}"* ]]; then
        pass "image tag matches EXPECT_SHA=${EXPECT_SHA} (release-SHA correlation)"
      else
        fail "image tag does not contain EXPECT_SHA=${EXPECT_SHA} (deployed SHA mismatch — G2)"
      fi
    fi

    if [[ -z "${BASE_URL}" ]]; then
      BASE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
        --region="${REGION}" --project="${PROJECT_ID}" \
        --format='value(status.url)' 2>/dev/null || true)"
    fi
  else
    warn "gcloud could not describe ${SERVICE_NAME} (auth/project?) — skipping D1/D2"
  fi
else
  warn "gcloud unavailable or PROJECT_ID unset — skipping D1/D2 (service-state checks)"
fi

if [[ -z "${BASE_URL}" ]]; then
  echo "ERROR: could not resolve a target URL. Set BASE_URL or NEXT_PUBLIC_SITE_URL." >&2
  exit 1
fi
BASE_URL="${BASE_URL%/}"
echo
echo "Target: ${BASE_URL}"
[[ "${SERVICE_READY_CHECKED}" == "0" ]] && echo "(service-state checks skipped; probing HTTP surface only)"
echo

# curl helpers ---------------------------------------------------------------
http_code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1" 2>/dev/null || echo "000"; }

echo "== D3  Startup probe =="
code="$(http_code "${BASE_URL}/api/health")"
[[ "${code}" == "200" ]] && pass "/api/health → 200" || fail "/api/health → ${code} (expected 200)"

echo "== D4  Readiness probe (G7) =="
READY_BODY="$(curl -s --max-time 25 "${BASE_URL}/api/health?ready=1" 2>/dev/null || true)"
READY_CODE="$(http_code "${BASE_URL}/api/health?ready=1")"
if [[ "${READY_CODE}" == "200" ]] && printf '%s' "${READY_BODY}" | grep -q '"ready":[[:space:]]*true'; then
  pass "/api/health?ready=1 → 200, ready:true"
else
  fail "/api/health?ready=1 → ${READY_CODE}, ready!=true (G7 FALSE)"
fi
# Per-component truth (extract each check's status without a JSON parser dep).
for comp in environment database auth migrations stripe; do
  st="$(printf '%s' "${READY_BODY}" | grep -oE "\"${comp}\"[^}]*\"status\":[[:space:]]*\"[a-z]+\"" | grep -oE '"status":[[:space:]]*"[a-z]+"' | grep -oE '[a-z]+"$' | tr -d '"' | head -1)"
  case "${st}" in
    pass) pass "check ${comp}: pass" ;;
    warn) warn "check ${comp}: warn" ;;
    fail) fail "check ${comp}: fail" ;;
    "") warn "check ${comp}: not reported" ;;
    *) warn "check ${comp}: ${st}" ;;
  esac
done

echo "== D5  Public route truth (no 5xx) =="
ROUTES="${ROUTES:-/ /books /comics /papers /login /register}"
for r in ${ROUTES}; do
  code="$(http_code "${BASE_URL}${r}")"
  if [[ "${code}" =~ ^(200|301|302|307|308)$ ]]; then
    pass "${r} → ${code}"
  else
    fail "${r} → ${code} (5xx/404 is a route-truth defect, G6)"
  fi
done

echo "== D6/D7  Served-asset env bake + secret hygiene =="
HOME_HTML="$(curl -s --max-time 25 "${BASE_URL}/" 2>/dev/null || true)"
# Collect a few served JS bundles referenced by the homepage.
JS_URLS="$(printf '%s' "${HOME_HTML}" | grep -oE '/_next/static/[^"'"'"']+\.js' | sort -u | head -12)"
ASSETS="${HOME_HTML}"
for j in ${JS_URLS}; do
  ASSETS+="$(curl -s --max-time 20 "${BASE_URL}${j}" 2>/dev/null || true)"
done

if printf '%s' "${ASSETS}" | grep -qiE 'localhost:3000|127\.0\.0\.1'; then
  fail "served assets reference a localhost origin (NEXT_PUBLIC_SITE_URL not baked — CCR-018)"
else
  pass "no localhost/127.0.0.1 origin in served assets"
fi

# Secret material must never reach the client bundle (CCR-009).
SECRET_PATTERN='sk_live_|sk_test_|whsec_|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|re_[A-Za-z0-9]{16,}|"role":"service_role"'
if printf '%s' "${ASSETS}" | grep -qE "${SECRET_PATTERN}"; then
  fail "secret-like material found in served assets (STOP — rotate + investigate, CCR-009)"
else
  pass "no secret material in served assets"
fi

echo "== D8  Webhook guard (fail closed) =="
WH_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
  -X POST -H 'Content-Type: application/json' --data '{}' \
  "${BASE_URL}/api/webhook" 2>/dev/null || echo "000")"
if [[ "${WH_CODE}" == "400" ]]; then
  pass "POST /api/webhook (unsigned) → 400"
else
  fail "POST /api/webhook (unsigned) → ${WH_CODE} (expected 400 — signature must be enforced, G8)"
fi

# TLS note (informational; DNS/TLS cutover is Phase 15) --------------------
if [[ "${BASE_URL}" == https://* ]]; then
  host="${BASE_URL#https://}"
  host="${host%%/*}"
  if command -v openssl >/dev/null 2>&1; then
    if echo | timeout 15 openssl s_client -servername "${host}" -connect "${host}:443" >/dev/null 2>&1; then
      pass "TLS handshake to ${host} ok"
    else
      warn "TLS handshake to ${host} failed/incomplete — confirm cert SAN covers apex+www (Phase 15)"
    fi
  fi
fi

echo
echo "──────────────────────────────────────────────"
if [[ "${FAIL}" -gt 0 ]]; then
  echo "RESULT: NOT GO — ${FAIL} failed, ${WARN} warning(s)."
  exit 1
elif [[ "${WARN}" -gt 0 ]]; then
  echo "RESULT: DEGRADED — 0 failed, ${WARN} warning(s). Operator review before GO."
  exit 2
fi
echo "RESULT: PASS — all checks green. Record this run + SHA in docs/OPERATOR_QA_LOG.md."
exit 0
