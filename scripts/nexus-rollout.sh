#!/bin/bash

# NEXUS Multi-Repo Rollout Script
# Standardizes analysis and recovery planning across all repositories.

set -e

REPOS_FILE="repos.txt"
OUTPUT_DIR="./nexus_analysis_reports"
ANALYZER_SCRIPT="scripts/nexus_analyzer.py"

echo "🎯 Starting NEXUS Multi-Repo Rollout..."
echo "======================================"

if [ ! -f "$REPOS_FILE" ]; then
    echo "❌ Error: $REPOS_FILE not found."
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Loop through repos in repos.txt
# Format: repo|secret|branch
grep -v '^#' "$REPOS_FILE" | while IFS='|' read -r repo secret branch; do
    if [ -z "$repo" ]; then continue; fi

    repo_name=$(basename "$repo")
    echo "--------------------------------------"
    echo "📦 Processing: $repo_name ($repo)"
    echo "🔹 Target Branch: ${branch:-main}"

    if [ ! -d "$repo_name" ]; then
        echo "📥 [INFO] $repo_name not found locally. Skipping analysis."
        echo "💡 To analyze, clone the repo first:"
        echo "   git clone -b ${branch:-main} https://github.com/$repo.git $repo_name"
        # Secret could be used as: https://$secret@github.com/$repo.git
        continue
    fi

    echo "🔍 Analyzing $repo_name..."
    python3 "$ANALYZER_SCRIPT" "$repo_name" --output "$OUTPUT_DIR"
done

echo "--------------------------------------"
echo "📊 Generating global rollout summary..."
python3 "$ANALYZER_SCRIPT" --repos "$REPOS_FILE" --output "$OUTPUT_DIR"

echo "✅ Rollout process complete!"
echo "📄 Global summary available at: $OUTPUT_DIR/ROLLOUT_SUMMARY.md"
