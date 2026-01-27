#!/usr/bin/env bash

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install it with: npm install -g supabase" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install it with: npm install -g pnpm" >&2
  exit 1
fi

set -a
if [ -f .env.test ]; then
  # shellcheck disable=SC1091
  source .env.test
fi
set +a

: "${NODE_ENV:=test}"
: "${NEXT_PUBLIC_SUPABASE_URL:=http://localhost:54321}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}"
: "${SUPABASE_SERVICE_ROLE_KEY:=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"
: "${NEXT_PUBLIC_SITE_URL:=http://localhost:3000}"
: "${DATABASE_URL:=postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

export NODE_ENV
export NEXT_PUBLIC_SUPABASE_URL
export NEXT_PUBLIC_SUPABASE_ANON_KEY
export SUPABASE_SERVICE_ROLE_KEY
export NEXT_PUBLIC_SITE_URL
export DATABASE_URL

cleanup() {
  supabase stop
}
trap cleanup EXIT

if [ ! -f supabase/config.toml ]; then
  supabase init
fi

supabase start
supabase db push
pnpm db:seed
pnpm test:e2e
