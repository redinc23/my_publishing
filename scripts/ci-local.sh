#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Running type checks"
npm run type-check

echo "==> Running lint checks"
npm run lint

echo "==> Running unit tests"
npm test

echo "==> Running build"
npm run build
