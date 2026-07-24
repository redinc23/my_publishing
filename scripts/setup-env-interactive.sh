#!/usr/bin/env bash
# Interactive .env.local setup — prompts for each required value with clear labels.
# Usage: ./scripts/setup-env-interactive.sh [--show-input] [--help]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"
SHOW_INPUT="false"

SUPABASE_PROJECT_REF="tkzvikozrcynhwsqtkqp"
DEFAULT_SUPABASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co"
DEFAULT_SITE_URL="https://mangu-publishers.com"

usage() {
  cat <<'EOF'
Usage: ./scripts/setup-env-interactive.sh [--show-input] [--help]

Options:
  --show-input   Show secret values while typing/pasting (less secure).
  --help         Show this help text.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --show-input)
      SHOW_INPUT="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

read_existing() {
  local key="$1"
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo ""
    return
  fi
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" 2>/dev/null | tail -1 || true)"
  if [[ -z "${line}" ]]; then
    echo ""
    return
  fi
  echo "${line#*=}" | sed 's/^["'\''"]//; s/["'\''"]$//'
}

is_placeholder() {
  local v="$1"
  [[ -z "${v}" ]] && return 0
  [[ "${v}" == *"your-"* ]] && return 0
  [[ "${v}" == *"REPLACE"* ]] && return 0
  [[ "${v}" == "pk_test_..." ]] && return 0
  [[ "${v}" == "sk_test_..." ]] && return 0
  [[ "${v}" == "whsec_..." ]] && return 0
  [[ "${v}" == "https://your-project.supabase.co" ]] && return 0
  return 1
}

effective_default() {
  local key="$1"
  local fallback="$2"
  local current
  current="$(read_existing "${key}")"
  if is_placeholder "${current}"; then
    echo "${fallback}"
  else
    echo "${current}"
  fi
}

has_existing_real() {
  local key="$1"
  local current
  current="$(read_existing "${key}")"
  ! is_placeholder "${current}"
}

preview_value() {
  local value="$1"
  local len="${#value}"
  if (( len == 0 )); then
    echo "empty"
    return
  fi
  if (( len <= 8 )); then
    echo "len=${len}, preview=${value}"
    return
  fi
  local start="${value:0:4}"
  local end="${value:len-4:4}"
  echo "len=${len}, preview=${start}...${end}"
}

confirm_saved() {
  local key="$1"
  local value="$2"
  local secret="${3:-false}"
  echo "  ✓ ${key} saved"
  echo "    Confirm: $(preview_value "${value}")"
  if [[ "${secret}" == "true" ]]; then
    if [[ "${SHOW_INPUT}" == "true" ]]; then
      echo "    Full value (visible mode): ${value}"
    else
      echo "    Full value not shown (secret field)"
    fi
  else
    echo "    Value: ${value}"
  fi
}

set_env_var() {
  local key="$1"
  local val="$2"
  case "${key}" in
    NEXT_PUBLIC_SUPABASE_URL) NEXT_PUBLIC_SUPABASE_URL="${val}" ;;
    NEXT_PUBLIC_SUPABASE_ANON_KEY) NEXT_PUBLIC_SUPABASE_ANON_KEY="${val}" ;;
    SUPABASE_SERVICE_ROLE_KEY) SUPABASE_SERVICE_ROLE_KEY="${val}" ;;
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${val}" ;;
    STRIPE_SECRET_KEY) STRIPE_SECRET_KEY="${val}" ;;
    STRIPE_WEBHOOK_SECRET) STRIPE_WEBHOOK_SECRET="${val}" ;;
    NEXT_PUBLIC_SITE_URL) NEXT_PUBLIC_SITE_URL="${val}" ;;
    *)
      echo "Internal error: unknown key ${key}" >&2
      exit 1
      ;;
  esac
}

prompt_line() {
  local key="$1"
  local title="$2"
  local where="$3"
  local default="$4"
  local secret="${5:-false}"
  local validate_fn="${6:-}"
  local input=""

  echo
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "${title}"
  echo "  Variable: ${key}"
  echo "  Get it from: ${where}"
  if [[ "${secret}" == "true" ]] && has_existing_real "${key}"; then
    echo "  Press Enter to keep existing value (hidden)"
  elif [[ -n "${default}" ]]; then
    echo "  Press Enter to keep: ${default}"
  else
    echo "  (required — no default)"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  while true; do
    if [[ "${secret}" == "true" ]]; then
      if [[ "${SHOW_INPUT}" == "true" ]]; then
        echo "  Input visible because --show-input was explicitly enabled."
        read -r -p "> Paste value (visible): " input
      else
        echo "  Input hidden by design."
        read -r -s -p "> Paste value (hidden): " input
        echo
      fi
    else
      read -r -p "> Paste or type value: " input
    fi

    if [[ -z "${input}" ]]; then
      input="${default}"
    fi

    if [[ -z "${input}" ]] || is_placeholder "${input}"; then
      echo "  ! Value required. Paste the real key or URL."
      continue
    fi

    if [[ -n "${validate_fn}" ]] && ! "${validate_fn}" "${input}"; then
      continue
    fi

    set_env_var "${key}" "${input}"
    confirm_saved "${key}" "${input}" "${secret}"
    break
  done
}

validate_url() {
  [[ "$1" =~ ^https:// ]] || { echo "  ! Must start with https://"; return 1; }
  return 0
}

validate_anon_key() {
  [[ ${#1} -ge 20 ]] || { echo "  ! Key looks too short"; return 1; }
  [[ "$1" == eyJ* ]] || { echo "  ! Must be the anon public JWT from Supabase Settings > API (starts with eyJ)"; return 1; }
  [[ "$(awk -F'.' '{print NF}' <<< "$1")" -eq 3 ]] || { echo "  ! JWT should contain 3 dot-separated parts"; return 1; }
  return 0
}

validate_service_role() {
  [[ ${#1} -ge 20 ]] || { echo "  ! Key looks too short"; return 1; }
  return 0
}

validate_pk() {
  [[ "$1" =~ ^pk_(test|live)_ ]] || { echo "  ! Must start with pk_test_ or pk_live_"; return 1; }
  return 0
}

validate_sk() {
  [[ "$1" =~ ^sk_(test|live)_ ]] || { echo "  ! Must start with sk_test_ or sk_live_"; return 1; }
  return 0
}

validate_whsec() {
  [[ "$1" =~ ^whsec_ ]] || { echo "  ! Must start with whsec_"; return 1; }
  return 0
}

echo "=== Mangu Publishers — .env.local setup ==="
echo
echo "This script asks for each value one at a time and writes ${ENV_FILE}."
if [[ "${SHOW_INPUT}" == "true" ]]; then
  echo "Secret input visibility: ON (--show-input)."
else
  echo "Secret input visibility: OFF (default). Input hidden by design."
fi
echo
echo "Open these tabs before you start:"
echo "  Supabase API: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/settings/api"
echo "  Stripe keys:  https://dashboard.stripe.com/apikeys"
echo "  Stripe hooks: https://dashboard.stripe.com/webhooks"
echo
read -r -p "Press Enter when ready..."

NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_SITE_URL=""

prompt_line NEXT_PUBLIC_SUPABASE_URL \
  "1/7 — Supabase project URL" \
  "Supabase → Settings → API → Project URL" \
  "$(effective_default NEXT_PUBLIC_SUPABASE_URL "${DEFAULT_SUPABASE_URL}")" \
  false validate_url

prompt_line NEXT_PUBLIC_SUPABASE_ANON_KEY \
  "2/7 — Supabase anon (public) key" \
  "Supabase → Settings → API → anon public" \
  "$(effective_default NEXT_PUBLIC_SUPABASE_ANON_KEY "")" \
  true validate_anon_key

prompt_line SUPABASE_SERVICE_ROLE_KEY \
  "3/7 — Supabase service_role key (secret — never commit)" \
  "Supabase → Settings → API → service_role" \
  "$(effective_default SUPABASE_SERVICE_ROLE_KEY "")" \
  true validate_service_role

prompt_line NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
  "4/7 — Stripe publishable key" \
  "Stripe → Developers → API keys → Publishable key" \
  "$(effective_default NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY "")" \
  false validate_pk

prompt_line STRIPE_SECRET_KEY \
  "5/7 — Stripe secret key (secret — never commit)" \
  "Stripe → Developers → API keys → Secret key" \
  "$(effective_default STRIPE_SECRET_KEY "")" \
  true validate_sk

prompt_line STRIPE_WEBHOOK_SECRET \
  "6/7 — Stripe webhook signing secret" \
  "Stripe → Developers → Webhooks → endpoint → Signing secret" \
  "$(effective_default STRIPE_WEBHOOK_SECRET "")" \
  true validate_whsec

prompt_line NEXT_PUBLIC_SITE_URL \
  "7/7 — Public site URL" \
  "Production domain for this app" \
  "$(effective_default NEXT_PUBLIC_SITE_URL "${DEFAULT_SITE_URL}")" \
  false validate_url

OPENAI_API_KEY="$(read_existing OPENAI_API_KEY)"
RESEND_API_KEY="$(read_existing RESEND_API_KEY)"
NODE_ENV="$(read_existing NODE_ENV)"
NODE_ENV="${NODE_ENV:-development}"

if [[ -f "${ENV_FILE}" ]]; then
  cp "${ENV_FILE}" "${ENV_FILE}.bak"
fi

{
  echo "# Generated by scripts/setup-env-interactive.sh — do not commit"
  echo "# Supabase project: ${SUPABASE_PROJECT_REF}"
  echo
  printf 'NEXT_PUBLIC_SUPABASE_URL=%s\n' "${NEXT_PUBLIC_SUPABASE_URL}"
  printf 'NEXT_PUBLIC_SUPABASE_ANON_KEY=%s\n' "${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
  printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "${SUPABASE_SERVICE_ROLE_KEY}"
  echo
  printf 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=%s\n' "${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}"
  printf 'STRIPE_SECRET_KEY=%s\n' "${STRIPE_SECRET_KEY}"
  printf 'STRIPE_WEBHOOK_SECRET=%s\n' "${STRIPE_WEBHOOK_SECRET}"
  echo
  printf 'NEXT_PUBLIC_SITE_URL=%s\n' "${NEXT_PUBLIC_SITE_URL}"
  printf 'NODE_ENV=%s\n' "${NODE_ENV}"
} > "${ENV_FILE}"

if [[ -n "${OPENAI_API_KEY}" ]]; then
  printf 'OPENAI_API_KEY=%s\n' "${OPENAI_API_KEY}" >> "${ENV_FILE}"
fi
if [[ -n "${RESEND_API_KEY}" ]]; then
  printf 'RESEND_API_KEY=%s\n' "${RESEND_API_KEY}" >> "${ENV_FILE}"
fi

echo
echo "=== Done ==="
echo "Wrote: ${ENV_FILE}"
[[ -f "${ENV_FILE}.bak" ]] && echo "Backup: ${ENV_FILE}.bak"
echo
echo "Next steps:"
echo "  1. Set these variables in Vercel project environment settings"
echo "  2. Redeploy your Vercel project"
