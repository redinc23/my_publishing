#!/usr/bin/env bash
set -euo pipefail
echo '🔧 P0.4 Rate-limit tests...'
npm test -- --testPathPattern='rate-limit'
echo '✅ P0.4 Done'
