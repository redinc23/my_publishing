#!/usr/bin/env bash
# Verify Supabase migration files exist and are non-empty (pre-deploy gate).
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"

if [[ ! -d "${DIR}" ]]; then
  echo "FAIL: ${DIR} not found"
  exit 1
fi

count=0
empty=0
for f in "${DIR}"/*.sql; do
  [[ -f "$f" ]] || continue
  count=$((count + 1))
  if [[ ! -s "$f" ]]; then
    echo "FAIL: empty migration $(basename "$f")"
    empty=$((empty + 1))
  fi
done

if [[ "${count}" -lt 1 ]]; then
  echo "FAIL: no .sql migrations in ${DIR}"
  exit 1
fi

if [[ "${empty}" -gt 0 ]]; then
  exit 1
fi

echo "PASS: ${count} migration file(s) present in supabase/migrations/"
ls -1 "${DIR}"/*.sql | sort
