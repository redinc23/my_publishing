#!/usr/bin/env bash
set -euo pipefail

# Configuration
REPOS_FILE="${1:-repos.txt}"
GH_PAT="${GH_PAT:-}"
DRY_RUN="${DRY_RUN:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_error() { echo -e "${RED}ERROR:${NC} $1"; }
log_success() { echo -e "${GREEN}SUCCESS:${NC} $1"; }
log_warn() { echo -e "${YELLOW}WARN:${NC} $1"; }
log_info() { echo -e "INFO: $1"; }

if [[ -z "$GH_PAT" ]]; then
    log_error "GH_PAT must be set in environment"
    exit 1
fi

if [[ ! -f "$REPOS_FILE" ]]; then
    log_error "Repos file '$REPOS_FILE' not found"
    exit 1
fi

# Authenticate gh CLI
echo "$GH_PAT" | gh auth login --with-token --hostname github.com

delete_environment() {
    local repo="$1"
    local env="$2"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would delete environment $env in $repo"
        return 0
    fi

    # Check if environment exists first to avoid error
    if gh api "repos/$repo/environments/$env" >/dev/null 2>&1; then
        if gh api -X DELETE "repos/$repo/environments/$env" >/dev/null; then
            log_success "Deleted environment $env in $repo"
        else
            log_error "Failed to delete environment $env in $repo"
        fi
    else
        log_warn "Environment $env does not exist in $repo"
    fi
}

remove_workflow() {
    local repo="$1"
    local branch="${2:-main}"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would remove workflow from $repo on branch $branch"
        return 0
    fi

    local tmpdir
    tmpdir=$(mktemp -d)

    # Clone repo
    if ! git clone --depth 1 \
        "https://x-access-token:${GH_PAT}@github.com/${repo}.git" \
        -b "$branch" "$tmpdir" 2>/dev/null; then
        log_error "Failed to clone $repo branch $branch"
        rm -rf "$tmpdir"
        return 1
    fi

    pushd "$tmpdir" >/dev/null

    if [[ -f ".github/workflows/build-and-release.yml" ]]; then
        git rm ".github/workflows/build-and-release.yml"
        git commit -m "chore(ci): remove build-and-release workflow"
        if git push origin "$branch"; then
            log_success "Removed workflow from $repo"
        else
            log_error "Failed to push changes to $repo"
        fi
    else
        log_warn "Workflow file not found in $repo"
    fi

    popd >/dev/null
    rm -rf "$tmpdir"
}

# Main loop
while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^# ]] && continue

    line="${line//[$'\t\r\n ']}"

    # Parse line
    IFS='|' read -r repo secret branch <<< "$line"
    branch="${branch:-main}"

    log_info "Processing $repo..."

    delete_environment "$repo" "dev"
    delete_environment "$repo" "prod"
    remove_workflow "$repo" "$branch"

done < "$REPOS_FILE"

log_info "Cleanup complete."
