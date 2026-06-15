#!/usr/bin/env bash
set -e
 echo '🔧 P0.1 Fixing lockfile...'
 node --version
echo '20' > .nvmrc
rm -f package-lock.json
npm install
npm ci
 echo '✅ P0.1 Done'