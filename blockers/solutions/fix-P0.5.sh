#!/usr/bin/env bash
set -euo pipefail
echo '🔧 P0.5 Graceful rate-limit degradation...'
npm test -- --testPathPattern='book-action-rate-limit'
echo '✅ P0.5 Done'
