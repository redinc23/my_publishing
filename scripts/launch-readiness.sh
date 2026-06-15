#!/usr/bin/env bash
# Local launch readiness check (no GCP auth required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .nvmrc ]] && [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "${HOME}/.nvm/nvm.sh"
  nvm use "$(cat .nvmrc)" 2>/dev/null || true
fi

export USE_MOCKS=true
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://test.supabase.co}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-test-anon-key-for-ci}"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_placeholder}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"

echo "=== Launch readiness (local) ==="
npm ci
npm run type-check
npm run lint
npm test
./scripts/verify-migrations.sh
npm run build

node -e "
const d=require('./package-lock.json').packages[''].dependencies;
if(!d['@upstash/ratelimit']||!d['@upstash/redis']) process.exit(1);
console.log('Lockfile: @upstash OK');
"

echo "=== Local gates PASS ==="
echo "Next: ./scripts/sync-gcp-secrets-from-env.sh && ./scripts/verify-gcp-production.sh"
