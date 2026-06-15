#!/usr/bin/env bash
set -e

# Navigate to the repository root relative to the script location
cd "$(dirname "$0")/../.."

 echo '🔧 P0.1 Fixing lockfile...'
 node --version
echo '20' > .nvmrc
rm -f package-lock.json
npm install
npm ci
 echo '✅ P0.1 Done'