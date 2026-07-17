#!/usr/bin/env bash
# Update NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
# Usage: ./scripts/update-supabase-anon-key.sh [--show-input] [--help]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"
PROJECT_REF="tkzvikozrcynhwsqtkqp"
SHOW_INPUT="false"

usage() {
  cat <<'EOF'
Usage: ./scripts/update-supabase-anon-key.sh [--show-input] [--help]

Options:
  --show-input   Show pasted key while entering it (less secure).
  --help         Show this help text.
EOF
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

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found. Run ./scripts/setup-env-interactive.sh first."
  exit 1
fi

echo "=== Update Supabase anon key ==="
echo "Open: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
echo "Copy the **anon public** key (starts with eyJ...)."
echo

if [[ "${SHOW_INPUT}" == "true" ]]; then
  echo "Input visible because --show-input was explicitly enabled."
  read -r -p "Paste anon key (visible): " ANON
else
  echo "Input hidden by design."
  read -r -s -p "Paste anon key (hidden): " ANON
  echo
fi

if [[ -z "${ANON}" ]] || [[ ${#ANON} -lt 20 ]]; then
  echo "ERROR: Key looks empty or too short."
  exit 1
fi

if [[ "${ANON}" != eyJ* ]] || [[ "$(awk -F'.' '{print NF}' <<< "${ANON}")" -ne 3 ]]; then
  echo "ERROR: This does not look like the Supabase anon JWT expected by this app."
  echo "Copy the 'anon public' JWT from Supabase Settings > API, not a publishable key."
  exit 1
fi

echo "Entry received: $(preview_value "${ANON}")"
if [[ "${SHOW_INPUT}" == "true" ]]; then
  echo "Full value (visible mode): ${ANON}"
fi

cp "${ENV_FILE}" "${ENV_FILE}.bak"

if grep -q '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "${ENV_FILE}"; then
  sed -i '' "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}|" "${ENV_FILE}"
else
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}" >> "${ENV_FILE}"
fi

echo "OK — updated NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
echo "Backup: ${ENV_FILE}.bak"
echo
echo "Next (required): update NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel project env vars, then redeploy."
