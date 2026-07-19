#!/usr/bin/env bash
# Fire a short burst at the MCP endpoint. Expect some 429s when enabled + limited.
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
N="${2:-30}"

ok=0
limited=0
other=0
for i in $(seq 1 "${N}"); do
  CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
    -X POST "${BASE_URL}/api/mcp/mcp" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' || echo 000)"
  case "${CODE}" in
    200|202|404|406) ok=$((ok+1)) ;;
    429) limited=$((limited+1)) ;;
    *) other=$((other+1)) ;;
  esac
done

echo "burst=${N} okish=${ok} limited_429=${limited} other=${other}"
if [[ "${limited}" -lt 1 ]]; then
  echo "NOTE: no 429 observed (MCP may be disabled, limits high, or Upstash bypassed in dev)."
fi
