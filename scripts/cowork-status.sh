#!/usr/bin/env bash
# Cowork control-plane status for agents and humans.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

ORIGIN="${CANONICAL_ORIGIN:-https://www.mangu-publishers.com}"

echo "=== COWORK STATUS ==="
echo "repo: $(git rev-parse --show-toplevel 2>/dev/null || pwd)"
echo "branch: $(git branch --show-current 2>/dev/null || echo '?')"
echo "head: $(git rev-parse --short HEAD 2>/dev/null || echo '?')"
echo

echo "=== Prod probes (${ORIGIN}) ==="
for path in /api/live /api/health '/api/health?ready=1'; do
  url="${ORIGIN}${path}"
  set +e
  code=$(curl -sS -o /tmp/cowork-probe.json -w '%{http_code}' --max-time 20 "${url}" 2>/tmp/cowork-curl.err)
  rc=$?
  set -e
  echo "-- ${path}"
  echo "HTTP ${code:-000} curl_rc=${rc}"
  if [[ -s /tmp/cowork-probe.json ]]; then head -c 400 /tmp/cowork-probe.json; echo; fi
done
echo

echo "=== Open PRs (top 15) ==="
if command -v gh >/dev/null 2>&1; then
  gh pr list --state open --limit 15 || true
else
  echo "gh not available"
fi
echo

echo "=== Storm automations (human must disable) ==="
echo "Fix CI failures: https://cursor.com/automations/094ce0ad-7ba5-11f1-ba66-0e7d0216e441"
echo "Health sweep (pr): https://cursor.com/automations/ab582f50-7ba7-11f1-ba66-0e7d0216e441"
echo "(Agent API can only read enabled flags; cannot toggle.)"
echo

echo "=== Next docs ==="
echo "docs/COWORK_OPERATOR.md"
echo ".cursor/automations/phoenix-next-slice.prompt.md"
echo "HUMAN_TASKS.md"
