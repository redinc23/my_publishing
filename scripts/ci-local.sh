#!/usr/bin/env bash
# Mirror GitHub Actions CI locally (npm, Node 22).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .nvmrc ]] && [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "${HOME}/.nvm/nvm.sh"
  nvm use "$(cat .nvmrc)" 2>/dev/null || true
fi

export USE_MOCKS="${USE_MOCKS:-true}"
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://test.supabase.co}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-test-anon-key-for-ci}"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_placeholder}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"

echo "==> npm ci"
npm ci

echo "==> type-check"
npm run type-check

echo "==> lint"
npm run lint

echo "==> test"
npm test

echo "==> build"
npm run build

echo "==> CI local mirror PASS"
