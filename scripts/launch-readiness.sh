#!/usr/bin/env bash
# Comprehensive local launch readiness gate (no GCP auth required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  MANGU Publishers — Launch Readiness Verification        ║"
echo "╚══════════════════════════════════════════════════════════╝"

# --- Node version ---
if [[ -f .nvmrc ]] && [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "${HOME}/.nvm/nvm.sh"
  nvm use "$(cat .nvmrc)" 2>/dev/null || true
fi
echo "→ Node: $(node -v)"

# --- CI placeholder env (no real secrets) ---
export USE_MOCKS="${USE_MOCKS:-true}"
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://test.supabase.co}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-test-anon-key-for-ci}"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_placeholder}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"

run_step() {
  echo ""
  echo "━━━ $1 ━━━"
  shift
  "$@"
}

run_step "npm ci" npm ci
run_step "type-check" npm run type-check
run_step "lint" npm run lint
run_step "unit tests" npm test
run_step "migration files" ./scripts/verify-migrations.sh
run_step "production build" npm run build

echo ""
echo "━━━ lockfile @upstash check ━━━"
node -e "
const d=require('./package-lock.json').packages[''].dependencies;
if(!d['@upstash/ratelimit']||!d['@upstash/redis']) {
  console.error('FAIL: @upstash/* missing from package-lock.json');
  process.exit(1);
}
console.log('PASS: @upstash/ratelimit + @upstash/redis in lockfile');
"

echo ""
echo "━━━ secret audit reminder (post-build) ━━━"
PATTERN='sk_test_[A-Za-z0-9]+|sk_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+'
found=0
for target in .next/static .next/server public; do
  if [[ -d "$target" ]] && grep -R -nE "$PATTERN" "$target" 2>/dev/null | head -5; then
    found=1
  fi
done
if [[ "$found" -eq 1 ]]; then
  echo "FAIL: potential secret values in build output"
  exit 1
fi
echo "PASS: no secret value patterns in .next/static, .next/server, public"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ LOCAL LAUNCH GATES PASS                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Operator-only next steps (require real credentials):"
echo "  1. cp .env.local.example .env.local  # fill from dashboards"
echo "  2. gcloud auth login && ./scripts/sync-gcp-secrets-from-env.sh"
echo "  3. ./scripts/bundle-migrations.sh → Supabase SQL Editor"
echo "  4. Stripe webhook → STRIPE_WEBHOOK_SECRET → re-sync secrets"
echo "  5. ./scripts/verify-gcp-production.sh"
echo "  6. Browser QA per docs/OPERATOR_QA_LOG.md"
