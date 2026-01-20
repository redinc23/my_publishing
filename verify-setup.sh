#!/usr/bin/env bash
set -euo pipefail

# Configuration
REPOS_FILE="${1:-repos.txt}"
GH_PAT="${GH_PAT:-}"

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

verify_repo() {
    local repo="$1"
    local branch="${2:-main}"
    local errors=0

    log_info "Verifying $repo..."

    # Check repo access
    if ! gh api "repos/$repo" >/dev/null 2>&1; then
        log_error "Cannot access repository $repo"
        return 1
    fi

    # Check environments and secrets
    for env in dev prod; do
        if gh api "repos/$repo/environments/$env" >/dev/null 2>&1; then
            echo -e "  - Environment $env: ${GREEN}OK${NC}"

            # Check secret
            # Note: We can only check if secret exists, not its value
            if gh api "repos/$repo/environments/$env/secrets/DEPLOY_KEY" >/dev/null 2>&1; then
                echo -e "    - Secret DEPLOY_KEY: ${GREEN}OK${NC}"
            else
                echo -e "    - Secret DEPLOY_KEY: ${RED}MISSING${NC}"
                errors=$((errors + 1))
            fi
        else
            echo -e "  - Environment $env: ${RED}MISSING${NC}"
            errors=$((errors + 1))
        fi
    done

    # Check workflow file
    if gh api "repos/$repo/contents/.github/workflows/build-and-release.yml?ref=$branch" >/dev/null 2>&1; then
        echo -e "  - Workflow file: ${GREEN}OK${NC}"
    else
        echo -e "  - Workflow file: ${RED}MISSING${NC}"
        errors=$((errors + 1))
    fi

    if [[ $errors -eq 0 ]]; then
        return 0
    else
        return 1
    fi
}

total_errors=0

while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^# ]] && continue

    line="${line//[$'\t\r\n ']}"
    IFS='|' read -r repo secret branch <<< "$line"
    branch="${branch:-main}"

    if ! verify_repo "$repo" "$branch"; then
        total_errors=$((total_errors + 1))
    fi
    echo ""

done < "$REPOS_FILE"

if [[ $total_errors -eq 0 ]]; then
    log_success "All verifications passed!"
else
    log_error "Verification failed with $total_errors errors."
    exit 1
fi
