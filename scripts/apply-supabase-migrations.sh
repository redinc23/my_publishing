#!/usr/bin/env bash
# Apply Supabase migrations to the linked production project.
# Usage: ./scripts/apply-supabase-migrations.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

PROJECT_REF="${SUPABASE_PROJECT_REF:-tkzvikozrcynhwsqtkqp}"

echo "=== Apply Supabase migrations ==="
echo "Project ref: ${PROJECT_REF}"
echo

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI not installed (brew install supabase/tap/supabase)"
  exit 1
fi

if ! supabase projects list 2>/dev/null | grep -q "${PROJECT_REF}"; then
  echo "ERROR: Not logged in or project not visible."
  echo "Run: supabase login && supabase link --project-ref ${PROJECT_REF}"
  exit 1
fi

echo "Pushing migrations from supabase/migrations ..."
supabase db push

echo
echo "Done. Verify with:"
echo "  curl -sS 'https://mangu-publishers.com/api/health?ready=1' | head -c 500"
