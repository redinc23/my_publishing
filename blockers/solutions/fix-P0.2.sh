#!/usr/bin/env bash
set -euo pipefail
echo '🔧 P0.2 Node version pin...'
echo '20' > .nvmrc
echo 'engine-strict=true' > .npmrc
echo '✅ P0.2 Done — use Node 20 (nvm use) before npm ci'
