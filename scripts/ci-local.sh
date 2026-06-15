#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Running lint checks"
npm run lint -- --max-warnings=0

echo "==> Running type checks"
npm run type-check

echo "==> Running unit tests"
npm test -- --runInBand

echo "==> Running build"
npm run build
