#!/usr/bin/env bash
# Print all migrations in order for Supabase SQL Editor (npm run db:migrate needs exec_sql RPC).
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"
for f in $(ls -1 "${DIR}"/*.sql | sort); do
  echo "-- ========== $(basename "$f") =========="
  cat "$f"
  echo
  echo
done
