#!/usr/bin/env bash
# Probe Mangu /api/health?ready=1 and print JSON + exit non-zero if not ready.
set -euo pipefail

BASE_URL="${1:-https://www.mangu-publishers.com}"
URL="${BASE_URL%/}/api/health?ready=1"

echo "GET ${URL}"
BODY="$(curl -fsS --max-time 20 "${URL}")"
echo "${BODY}" | jq . 2>/dev/null || echo "${BODY}"

READY="$(echo "${BODY}" | jq -r '.ready // empty' 2>/dev/null || true)"
if [[ "${READY}" != "true" ]]; then
  echo "FAIL: ready != true" >&2
  exit 1
fi
echo "OK: ready=true"
