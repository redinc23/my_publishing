#!/usr/bin/env bash
# Unified pre-launch verification — all local gates in one command.
# Windows Git Bash: bash scripts/pre-launch-verify.sh
# No gcloud auth or real secrets required (uses CI mock env when .env.local is absent).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"
export PATH="${ROOT}/node_modules/.bin:${PATH}"

PASS=0
FAIL=0
RESULTS=()

record() {
  local status="$1"
  local name="$2"
  if [[ "${status}" -eq 0 ]]; then
    RESULTS+=("[PASS] ${name}")
    PASS=$((PASS + 1))
  else
    RESULTS+=("[FAIL] ${name}")
    FAIL=$((FAIL + 1))
  fi
}

run_gate() {
  local name="$1"
  shift
  echo ""
  echo "━━━ ${name} ━━━"
  if "$@"; then
    record 0 "${name}"
    return 0
  else
    record 1 "${name}"
    return 1
  fi
}

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  MANGU Publishers — Pre-Launch Verification                ║"
echo "╚══════════════════════════════════════════════════════════╝"

# --- Node version (.nvmrc) ---
run_gate "Node version (.nvmrc)" bash -c '
  set -euo pipefail
  if [[ -f .nvmrc ]] && [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "${HOME}/.nvm/nvm.sh"
    nvm use "$(cat .nvmrc)" 2>/dev/null || true
  fi
  required="$(tr -d "[:space:]" < .nvmrc)"
  current="$(node -v | sed "s/^v//")"
  echo "Required: v${required}  Current: v${current}"
  major="${current%%.*}"
  req_major="${required%%.*}"
  if [[ "${major}" -lt "${req_major}" ]]; then
    echo "FAIL: Node ${current} < .nvmrc ${required}"
    exit 1
  fi
  echo "PASS: Node satisfies .nvmrc"
'

# --- CI mock env (used when .env.local is missing or for build gates) ---
export_ci_mock_env() {
  export USE_MOCKS="${USE_MOCKS:-true}"
  export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://test.supabase.co}"
  export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key-for-ci}"
  export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-for-ci}"
  export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_ci_mock_only}"
  export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_ci_mock_only}"
  export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"
  export UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-https://mock.upstash.io}"
  export UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN:-mock-upstash-token}"
}

run_gate "npm ci" bash -c '
  set -euo pipefail
  if [[ "${SKIP_NPM_CI:-}" == "1" ]] || [[ -f node_modules/.bin/next ]] || [[ -f node_modules/.bin/next.cmd ]]; then
    echo "SKIP: node_modules already installed (set SKIP_NPM_CI=1 to force this path)"
    exit 0
  fi
  if npm ci; then
    exit 0
  fi
  echo "WARN: npm ci failed; falling back to npm install (common on Windows EPERM/ENOTEMPTY)"
  npm install --no-audit --no-fund
'

run_gate "validate-env" bash -c '
  set -euo pipefail
  if [[ ! -f .env.local ]]; then
    echo "No .env.local — using CI mock env"
    export USE_MOCKS=true
    export NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
    export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key-for-ci
    export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-for-ci
    export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_ci_mock_only
    export STRIPE_SECRET_KEY=sk_ci_mock_only
    export NEXT_PUBLIC_SITE_URL=http://localhost:3000
    export UPSTASH_REDIS_REST_URL=https://mock.upstash.io
    export UPSTASH_REDIS_REST_TOKEN=mock-upstash-token
  fi
  npm run validate-env
'

run_gate "type-check" npm run type-check
run_gate "lint" npm run lint

if npm run | grep -qE 'format:check'; then
  run_gate "format:check" npm run format:check
else
  run_gate "prettier --check" npx prettier --check .
fi

run_gate "unit tests" bash -c 'set -euo pipefail; rm -rf .next; npm test'
run_gate "migration files" bash scripts/verify-migrations.sh

run_gate "production build (CI mock env)" bash -c '
  set -euo pipefail
  export USE_MOCKS=true
  export NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
  export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key-for-ci
  export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-for-ci
  export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_ci_mock_only
  export STRIPE_SECRET_KEY=sk_ci_mock_only
  export NEXT_PUBLIC_SITE_URL=http://localhost:3000
  export UPSTASH_REDIS_REST_URL=https://mock.upstash.io
  export UPSTASH_REDIS_REST_TOKEN=mock-upstash-token
  npm run build
'

run_gate "secret pattern scan (.next output)" bash -c '
  set -euo pipefail
  PATTERN="sk_test_[A-Za-z0-9]+|sk_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+"
  for target in .next/static .next/server public; do
    if [[ -d "${target}" ]]; then
      if grep -R -nE "${PATTERN}" "${target}" 2>/dev/null | head -5; then
        echo "FAIL: potential secrets in ${target}"
        exit 1
      fi
    fi
  done
  echo "PASS: no secret patterns in build output"
'

run_gate "HTML doctype + fence check (public/**/*.html)" bash -c '
  set -euo pipefail
  shopt -s nullglob
  html_files=(public/**/*.html public/*.html)
  if [[ ${#html_files[@]} -eq 0 ]]; then
    echo "WARN: no HTML files under public/"
    exit 0
  fi
  bad=0
  for f in "${html_files[@]}"; do
    [[ -f "${f}" ]] || continue
    fence=$(printf "\x60\x60\x60")
    if grep -qF "$fence" "${f}"; then
      echo "FAIL: markdown fence in ${f}"
      bad=1
    fi
    if ! head -n 5 "${f}" | grep -qi "<!DOCTYPE"; then
      echo "FAIL: missing <!DOCTYPE in ${f}"
      bad=1
    fi
  done
  if [[ "${bad}" -eq 1 ]]; then
    exit 1
  fi
  echo "PASS: ${#html_files[@]} HTML file(s) have doctype and no markdown fences"
'

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PRE-LAUNCH SUMMARY                                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
for line in "${RESULTS[@]}"; do
  echo "  ${line}"
done
echo ""
echo "  Total: ${PASS} passed, ${FAIL} failed"
echo ""

if [[ "${FAIL}" -gt 0 ]]; then
  echo "❌ PRE-LAUNCH VERIFICATION FAILED"
  echo "Fix failing gates above, then re-run: bash scripts/pre-launch-verify.sh"
  exit 1
fi

echo "✅ ALL LOCAL PRE-LAUNCH GATES PASSED"
echo ""
echo "Operator next steps (require real credentials — not run by this script):"
echo "  1. cp .env.local.example .env.local  # fill from dashboards"
echo "  2. gcloud auth login && ./scripts/sync-gcp-secrets-from-env.sh"
echo "  3. ./scripts/grant-cloudrun-secret-access.sh"
echo "  4. ./scripts/gcloud-build-submit.sh"
echo "  5. ./scripts/verify-gcp-production.sh"
echo ""
echo "See also:"
echo "  - docs/reports/deployment/deployment_status.md  (live deploy status)"
echo "  - docs/PHASE4_OPERATOR_RUNBOOK.md             (Phase 4 operator steps)"
echo "  - docs/OPERATOR_QA_LOG.md                     (record results in pre-launch table)"
exit 0

