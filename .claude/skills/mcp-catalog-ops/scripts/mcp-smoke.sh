#!/usr/bin/env bash
# Smoke-check MCP gate + health HTTP surface.
# Full JSON-RPC tool calls vary by mcp-handler version; this script verifies
# the operational gates agents can rely on without a full MCP client.
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"

echo "== health (app) =="
curl -fsS --max-time 20 "${BASE_URL}/api/health" | head -c 500 || true
echo

echo "== MCP endpoint (expect 404 if MCP_ENABLED unset) =="
CODE="$(curl -sS -o /tmp/mcp-smoke-body.txt -w '%{http_code}' --max-time 20 \
  -X POST "${BASE_URL}/api/mcp/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mangu-smoke","version":"0.0.1"}}}')"
echo "HTTP ${CODE}"
head -c 400 /tmp/mcp-smoke-body.txt; echo

case "${CODE}" in
  404)
    echo "OK: MCP disabled (404). Set MCP_ENABLED=true to exercise tools."
    ;;
  200|202|406)
    echo "OK: MCP endpoint reachable (HTTP ${CODE}). Use an MCP client for tool round-trips."
    ;;
  429)
    echo "WARN: rate limited. Check Upstash / reduce burst."
    exit 1
    ;;
  *)
    echo "FAIL: unexpected status ${CODE}" >&2
    exit 1
    ;;
esac
