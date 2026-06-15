#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Local CI mirrors GitHub's mock build behavior. Production deploys still require
# real values through scripts/gcloud-build-submit.sh and cloudbuild.yaml.
export USE_MOCKS="${USE_MOCKS:-true}"
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://dummy.supabase.co}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-dummy-anon-key}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-dummy-service-role-key}"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_dummy}"
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_dummy}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_dummy}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"

echo "==> Running lint checks"
npm run lint -- --max-warnings=0

echo "==> Running type checks"
npm run type-check

echo "==> Running unit tests"
npm test -- --runInBand

echo "==> Running build"
npm run build
