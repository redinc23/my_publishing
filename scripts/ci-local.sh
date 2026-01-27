#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Running lint checks"
pnpm lint --max-warnings=0

echo "==> Running type checks"
pnpm type-check

echo "==> Running formatting checks"
pnpm format:check

echo "==> Running unit tests"
pnpm test:ci

echo "==> Running build"
pnpm build
