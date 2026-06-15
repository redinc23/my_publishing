#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🚀 Blocker fix-all verification..."

if [[ -f .nvmrc ]] && command -v nvm >/dev/null 2>&1; then
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh" 2>/dev/null || true
  nvm use "$(cat .nvmrc)" 2>/dev/null || true
fi

export USE_MOCKS=true
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://test.supabase.co}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-test-anon-key-for-ci}"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_placeholder}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"

echo "→ npm ci"
npm ci

echo "→ type-check"
npm run type-check

echo "→ lint"
npm run lint

echo "→ test"
npm test

echo "→ build"
npm run build

echo "→ lockfile @upstash check"
node -e "
const d=require('./package-lock.json').packages[''].dependencies;
if(!d['@upstash/ratelimit']||!d['@upstash/redis']) { console.error('FAIL: @upstash missing from lockfile'); process.exit(1); }
console.log('PASS: @upstash in lockfile');
"

echo "✅ All automated blocker verifications passed"
