#!/usr/bin/env bash
# Best-effort Vercel project status. Requires vercel CLI + linked project.
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI not installed. Human gate: install/link or use Vercel dashboard." >&2
  exit 2
fi

echo "== vercel whoami =="
vercel whoami || true
echo "== recent deployments (ls) =="
vercel ls --limit 5 2>/dev/null || vercel ls 2>/dev/null || {
  echo "Unable to list deployments. Ensure project is linked (vercel link)." >&2
  exit 2
}
