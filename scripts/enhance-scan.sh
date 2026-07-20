#!/usr/bin/env bash
# mangu-navigator: enhancement opportunity scan (read-only signals, not verdicts).
# Surfaces cheap, concrete leads for the enhancement engine to triage.
# Usage: enhance-scan.sh [--repo <path>]
set -uo pipefail

REPO=""
[[ "${1:-}" == "--repo" ]] && REPO="${2:-}"
[[ -z "${REPO}" ]] && REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "${REPO}" || exit 1

hr() { printf '%s\n' "----------------------------------------------------------------------"; }
count() { grep -rE "$1" ${2} --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' '; }

hr; echo "MANGU ENHANCE SCAN  ($(git rev-parse --short HEAD 2>/dev/null))  — signals only"; hr

echo "[debt markers]"
echo "  TODO/FIXME/HACK in app+lib+components: $(count 'TODO|FIXME|HACK' 'app/ lib/ components/')"
grep -rEn 'TODO|FIXME|HACK' app/ lib/ components/ --include='*.ts*' 2>/dev/null | head -5 | sed 's/^/    /'

echo
echo "[prod hygiene]"
echo "  console.log in app+lib: $(count 'console\.log' 'app/ lib/')  (should trend to 0; use lib/logger patterns)"

echo
echo "[performance signals]"
IMG=$(grep -rE '<img[ >]' app/ components/ --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
NIMG=$(grep -rE 'next/image' app/ components/ --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
echo "  raw <img> tags: ${IMG} vs next/image imports: ${NIMG}  (raw <img> skips optimization)"
UC=$(grep -rl "^'use client'" app/ components/ --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
echo "  'use client' components: ${UC}  (each adds client JS; audit the heaviest)"
echo "  dynamic imports (code-split): $(count 'next/dynamic' 'app/ components/')"

echo
echo "[SEO signals]"
PAGES=$(find app -name 'page.tsx' 2>/dev/null | wc -l | tr -d ' ')
META=$(grep -rlE 'export (const metadata|async function generateMetadata)' app/ --include='page.tsx' --include='layout.tsx' 2>/dev/null | wc -l | tr -d ' ')
echo "  page.tsx files: ${PAGES}; files exporting metadata/generateMetadata: ${META}"
echo "  JsonLd usages: $(count 'JsonLd' 'app/ components/')  · OG image usages: $(count 'OpenGraphImage|opengraph' 'app/ components/')"

echo
echo "[a11y quick greps]  (heuristics — verify with real audit)"
echo "  aria- attributes: $(count 'aria-' 'app/ components/')  · alt= props: $(count 'alt=' 'app/ components/')"

echo
echo "[experience surface inventory]"
for f in components/audio components/reader components/library components/social app/\(consumer\)/book-clubs app/\(consumer\)/readers-hub; do
  [[ -e "$f" ]] && echo "  present: $f"
done
grep -rn "placeholder\|coming.soon\|Coming Soon" app/ --include='*.tsx' -il 2>/dev/null | head -5 | sed 's/^/  stub surface: /'

echo
hr
echo "Triage these through references/enhancement-engine.md (classify → rank → ledger)."
hr
