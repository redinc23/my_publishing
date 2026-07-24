#!/usr/bin/env bash
# Update NEXT_PUBLIC_SUPABASE_ANON_KEY in THREE places at once:
#   1. .env.local          (local dev)
#   2. Vercel env vars     (both projects: my_publishing + manguprojectz)
#   3. GitHub Secret       (NEXT_PUBLIC_SUPABASE_ANON_KEY in this repo)
#
# Usage: ./scripts/update-supabase-anon-key.sh [--local-only] [--show-input] [--help]
#
# Prerequisites for Vercel + GitHub push:
#   VERCEL_TOKEN            – Vercel personal access token (Settings > Tokens)
#   GH_PAT_SECRETS          – GitHub PAT with secrets:write scope
#   VERCEL_TEAM_ID          – team slug/id (leave unset for personal accounts)
#   VERCEL_PROJECT_MY_PUBLISHING  – project ID (see Vercel > Project > Settings > General)
#   VERCEL_PROJECT_MANGUPROJECTZ  – project ID for manguprojectz
#
# Export these in your shell or add them to .env.local (they are never committed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"
PROJECT_REF="tkzvikozrcynhwsqtkqp"
SHOW_INPUT="false"
LOCAL_ONLY="false"

# ── helpers ────────────────────────────────────────────────────────────────────
usage() {
  cat <<'EOF'
Usage: ./scripts/update-supabase-anon-key.sh [--local-only] [--show-input] [--help]

Options:
  --local-only   Only update .env.local. Skip Vercel and GitHub Secret push.
  --show-input   Echo the key while you type it (less secure, useful for paste).
  --help         Show this help.

Environment variables required for remote push (export before running):
  VERCEL_TOKEN                    Vercel personal access token
  GH_PAT_SECRETS                  GitHub PAT with secrets:write scope
  VERCEL_PROJECT_MY_PUBLISHING    Vercel project ID for my_publishing
  VERCEL_PROJECT_MANGUPROJECTZ    Vercel project ID for manguprojectz
  VERCEL_TEAM_ID                  (optional) Vercel team ID
EOF
}

preview_value() {
  local value="$1" len="${#1}"
  (( len == 0 )) && { echo "empty"; return; }
  (( len <= 8 ))  && { echo "len=${len}, value=${value}"; return; }
  echo "len=${len}, preview=${value:0:6}...${value:len-4:4}"
}

require_cmd() { command -v "$1" &>/dev/null || { echo "ERROR: '$1' not found. Install it first."; exit 1; }; }

upsert_vercel_env() {
  local project_id="$1" env_key="$2" env_value="$3"
  local team_param=""
  [[ -n "${VERCEL_TEAM_ID:-}" ]] && team_param="?teamId=${VERCEL_TEAM_ID}"

  echo "  → Vercel project ${project_id}: updating ${env_key}"

  # For each target, remove existing entry, then recreate
  for target in production preview; do
    local existing_id
    existing_id=$(curl -sf \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      "https://api.vercel.com/v9/projects/${project_id}/env${team_param}" \
      | jq -r --arg k "${env_key}" --arg t "${target}" \
        '.envs[] | select(.key==$k and (.target | arrays | contains([$t]))) | .id' \
      | head -1 || true)

    if [[ -n "${existing_id}" ]]; then
      curl -sf -X DELETE \
        -H "Authorization: Bearer ${VERCEL_TOKEN}" \
        "https://api.vercel.com/v9/projects/${project_id}/env/${existing_id}${team_param}" \
        > /dev/null
    fi
  done

  # Create new encrypted entry covering production + preview
  curl -sf -X POST \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    "https://api.vercel.com/v10/projects/${project_id}/env${team_param}" \
    -d "{\"key\":\"${env_key}\",\"value\":\"${env_value}\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\"]}" \
    | jq -r '"    created: " + .key' || true
}

upsert_github_secret() {
  local secret_name="$1" secret_value="$2"
  echo "  → GitHub Secret: ${secret_name}"
  # Get the repo public key for encryption
  local repo
  repo=$(git -C "${ROOT}" remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')
  local pub_key_resp
  pub_key_resp=$(curl -sf \
    -H "Authorization: Bearer ${GH_PAT_SECRETS}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${repo}/actions/public-key")
  local key_id key_val
  key_id=$(echo "${pub_key_resp}" | jq -r '.key_id')
  key_val=$(echo "${pub_key_resp}" | jq -r '.key')

  # Encrypt using libsodium via Python (available on most CI runners & macOS/Linux)
  local encrypted
  encrypted=$(python3 - <<PYEOF
import base64, sys
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PublicKey
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
# GitHub uses NaCl secretbox / Box — use PyNaCl if available, else fall back
try:
    from nacl.public import PublicKey, SealedBox
    pk = PublicKey(base64.b64decode("${key_val}"))
    box = SealedBox(pk)
    enc = box.encrypt(b"${secret_value}")
    print(base64.b64encode(enc).decode())
except ImportError:
    # Minimal fallback: instruct user to use the workflow instead
    print("PYNACL_MISSING")
PYEOF
  )

  if [[ "${encrypted}" == "PYNACL_MISSING" ]]; then
    echo "    SKIP: PyNaCl not installed. GitHub Secret update requires the workflow or:"
    echo "    pip3 install pynacl  # then re-run"
    echo "    Or: gh secret set ${secret_name} --body '<new_key>'"
    return
  fi

  curl -sf -X PUT \
    -H "Authorization: Bearer ${GH_PAT_SECRETS}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${repo}/actions/secrets/${secret_name}" \
    -d "{\"encrypted_value\":\"${encrypted}\",\"key_id\":\"${key_id}\"}" \
    && echo "    updated" || echo "    WARN: GitHub Secret update failed — check GH_PAT_SECRETS scope"
}

# ── arg parsing ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --local-only) LOCAL_ONLY="true"; shift ;;
    --show-input) SHOW_INPUT="true"; shift ;;
    --help|-h)    usage; exit 0 ;;
    *) echo "ERROR: Unknown option: $1"; usage; exit 1 ;;
  esac
done

# ── sanity checks ──────────────────────────────────────────────────────────────
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found. Run ./scripts/setup-env-interactive.sh first."
  exit 1
fi

if [[ "${LOCAL_ONLY}" != "true" ]]; then
  require_cmd curl
  require_cmd jq
  require_cmd python3

  if [[ -z "${VERCEL_TOKEN:-}" ]]; then
    echo "ERROR: VERCEL_TOKEN is not set. Export it or run with --local-only."
    exit 1
  fi
  if [[ -z "${GH_PAT_SECRETS:-}" ]]; then
    echo "WARN: GH_PAT_SECRETS not set — GitHub Secret update will be skipped."
    echo "      Use 'gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY' manually, or set GH_PAT_SECRETS."
  fi
  if [[ -z "${VERCEL_PROJECT_MY_PUBLISHING:-}" ]] || [[ -z "${VERCEL_PROJECT_MANGUPROJECTZ:-}" ]]; then
    echo "ERROR: VERCEL_PROJECT_MY_PUBLISHING and VERCEL_PROJECT_MANGUPROJECTZ must be set."
    exit 1
  fi
fi

# ── read key ───────────────────────────────────────────────────────────────────
echo "=== Supabase anon key rotation ==="
echo "Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
echo "Copy the anon/publishable key and paste it below."
echo

if [[ "${SHOW_INPUT}" == "true" ]]; then
  read -r -p "Paste new key (visible): " ANON
else
  read -r -s -p "Paste new key (hidden): " ANON; echo
fi

# Validate
if [[ -z "${ANON}" ]] || [[ ${#ANON} -lt 40 ]]; then
  echo "ERROR: Key is empty or too short."
  exit 1
fi

echo "Received: $(preview_value "${ANON}")"

# ── 1. .env.local ──────────────────────────────────────────────────────────────
echo
echo "[1/3] Updating .env.local"
cp "${ENV_FILE}" "${ENV_FILE}.bak"
if grep -q '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "${ENV_FILE}"; then
  sed -i.tmp "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}|" "${ENV_FILE}"
  rm -f "${ENV_FILE}.tmp"
else
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}" >> "${ENV_FILE}"
fi
echo "  → .env.local updated (backup: .env.local.bak)"

if [[ "${LOCAL_ONLY}" == "true" ]]; then
  echo
  echo "Done (--local-only). Vercel and GitHub Secret NOT updated."
  echo "Trigger the 'Rotate Supabase Anon Key' workflow manually to push remotely."
  exit 0
fi

# ── 2. Vercel ──────────────────────────────────────────────────────────────────
echo
echo "[2/3] Updating Vercel env vars"
upsert_vercel_env "${VERCEL_PROJECT_MY_PUBLISHING}" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${ANON}"
upsert_vercel_env "${VERCEL_PROJECT_MANGUPROJECTZ}"  "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${ANON}"
echo "  Vercel will auto-redeploy both projects."

# ── 3. GitHub Secret ───────────────────────────────────────────────────────────
echo
echo "[3/3] Updating GitHub Secret"
if [[ -n "${GH_PAT_SECRETS:-}" ]]; then
  upsert_github_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${ANON}"
else
  echo "  SKIP: GH_PAT_SECRETS not set."
  echo "  Run manually: gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY"
fi

# ── done ───────────────────────────────────────────────────────────────────────
echo
echo "=== Rotation complete ==="
echo
echo "Remaining manual step (REQUIRED):"
echo "  1. Open https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
echo "  2. Under 'API Keys' → locate the OLD legacy anon JWT → click Disable"
echo "  3. Verify old key is dead:"
echo "     curl -I https://${PROJECT_REF}.supabase.co/rest/v1/ \\"
echo "       -H 'apikey: <OLD_KEY>' -H 'Authorization: Bearer <OLD_KEY>'"
echo "     Expected: 401 or 403"
