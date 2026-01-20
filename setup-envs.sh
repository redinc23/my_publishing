#!/usr/bin/env bash
set -euo pipefail

# Configuration
REPOS_FILE="${1:-repos.txt}"
GH_PAT="${GH_PAT:-}"
DRY_RUN="${DRY_RUN:-false}"
MAX_RETRIES=3
RETRY_DELAY=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_error() { echo -e "${RED}ERROR:${NC} $1"; }
log_success() { echo -e "${GREEN}SUCCESS:${NC} $1"; }
log_warn() { echo -e "${YELLOW}WARN:${NC} $1"; }
log_info() { echo -e "INFO: $1"; }

# Validate inputs
validate_inputs() {
    if [[ -z "$GH_PAT" ]]; then
        log_error "GH_PAT must be set in environment"
        exit 1
    fi

    if [[ ! -f "$REPOS_FILE" ]]; then
        log_error "Repos file '$REPOS_FILE' not found"
        exit 1
    fi

    # Count repos
    local repo_count=$(grep -cE '^[^#]' "$REPOS_FILE" || echo "0")
    if [[ "$repo_count" -eq 0 ]]; then
        log_error "No repositories found in $REPOS_FILE"
        exit 1
    fi

    log_info "Found $repo_count repositories to process"
}

# GitHub API with retries
gh_api_with_retry() {
    local cmd="$1"
    local desc="$2"
    local attempt=1

    while [[ $attempt -le $MAX_RETRIES ]]; do
        if [[ $attempt -gt 1 ]]; then
            log_warn "Retry $attempt/$MAX_RETRIES for: $desc"
            sleep $RETRY_DELAY
        fi

        if eval "$cmd"; then
            return 0
        fi

        attempt=$((attempt + 1))
    done

    log_error "Failed after $MAX_RETRIES attempts: $desc"
    return 1
}

# Check if repo exists and is accessible
check_repo_access() {
    local repo="$1"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would check access to $repo"
        return 0
    fi

    if gh_api_with_retry \
        "curl -s -o /dev/null -w '%{http_code}' \
        -H 'Authorization: token $GH_PAT' \
        'https://api.github.com/repos/$repo' | grep -q '200'" \
        "Check repo access for $repo"; then
        log_success "Repository $repo is accessible"
        return 0
    else
        log_error "Cannot access repository $repo"
        return 1
    fi
}

# Create environment
create_environment() {
    local repo="$1"
    local env="$2"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create environment $env for $repo"
        return 0
    fi

    gh_api_with_retry \
        "curl -sSf -X PUT \
        -H 'Authorization: token $GH_PAT' \
        -H 'Accept: application/vnd.github+json' \
        'https://api.github.com/repos/$repo/environments/$env' \
        -d '{\"wait_timer\":0}' >/dev/null" \
        "Create $env environment for $repo"
}

# Set environment secret
set_environment_secret() {
    local repo="$1"
    local env="$2"
    local secret_value="$3"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would set secret DEPLOY_KEY for $env in $repo"
        return 0
    fi

    # Use gh cli to set secret which handles encryption automatically
    # This is more robust than manual sodium encryption
    gh_api_with_retry \
        "echo '$secret_value' | gh secret set DEPLOY_KEY --env '$env' --repo '$repo' --body -" \
        "Set secret for $env in $repo"
}

# Commit workflow file
commit_workflow() {
    local repo="$1"
    local branch="${2:-main}"
    local workflow_content="$3"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would commit workflow to $repo on branch $branch"
        return 0
    fi

    local tmpdir
    tmpdir=$(mktemp -d)

    # Clone repo
    if ! git clone --depth 1 \
        "https://x-access-token:${GH_PAT}@github.com/${repo}.git" \
        -b "$branch" "$tmpdir" 2>/dev/null; then
        log_warn "Branch $branch not found, creating it"
        git clone --depth 1 \
            "https://x-access-token:${GH_PAT}@github.com/${repo}.git" \
            "$tmpdir"
        pushd "$tmpdir" >/dev/null
        git checkout -b "$branch"
        popd >/dev/null
    fi

    pushd "$tmpdir" >/dev/null

    # Check if workflow already exists
    if [[ -f ".github/workflows/build-and-release.yml" ]]; then
        log_warn "Workflow already exists in $repo, skipping"
        popd >/dev/null
        rm -rf "$tmpdir"
        return 0
    fi

    # Create workflow
    mkdir -p .github/workflows
    echo "$workflow_content" > .github/workflows/build-and-release.yml

    # Commit and push
    git add .github/workflows/build-and-release.yml
    git commit -m "chore(ci): add build-and-release workflow" || true

    if git push origin "$branch"; then
        log_success "Workflow committed to $repo:$branch"
    else
        log_error "Failed to push workflow to $repo"
        popd >/dev/null
        rm -rf "$tmpdir"
        return 1
    fi

    popd >/dev/null
    rm -rf "$tmpdir"
    return 0
}

# Process a single repository
process_repo() {
    local line="$1"
    local repo secret branch

    # Parse line (support repo|secret|branch format)
    IFS='|' read -r repo secret branch <<< "$line"

    # Set defaults
    secret="${secret:-REPLACE_WITH_REAL_SECRET_VALUE}"
    branch="${branch:-main}"

    log_info "Processing $repo (branch: $branch)"

    # Validate repo access
    if ! check_repo_access "$repo"; then
        return 1
    fi

    # Create environments
    for env in dev prod; do
        if create_environment "$repo" "$env"; then
            log_success "Created $env environment"
        else
            log_warn "Environment $env may already exist"
        fi
    done

    # Set secrets
    for env in dev prod; do
        if set_environment_secret "$repo" "$env" "$secret"; then
            log_success "Set secret for $env"
        else
            log_error "Failed to set secret for $env"
            return 1
        fi
    done

    # Commit workflow
    if commit_workflow "$repo" "$branch" "$WORKFLOW_TEMPLATE"; then
        log_success "Workflow committed successfully"
    else
        log_error "Failed to commit workflow"
        return 1
    fi

    return 0
}

# Main execution
main() {
    validate_inputs

    # Authenticate gh CLI
    echo "$GH_PAT" | gh auth login --with-token --hostname github.com

    # Define workflow template
    read -r -d '' WORKFLOW_TEMPLATE <<'YML'
name: Build & Release
on:
  push:
    branches: [ "main", "develop" ]
  pull_request:
    branches: [ "main" ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup
        run: echo "Setting up build environment..."
      - name: Build
        run: |
          echo "Building application..."
          # Add your build commands here

  deploy-dev:
    needs: build
    if: github.ref == 'refs/heads/develop' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    environment:
      name: dev
      url: https://dev.example.com
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Dev
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        run: |
          echo "Deploying to development environment..."
          # Add your deployment commands here

  deploy-prod:
    needs: [build, deploy-dev]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: prod
      url: https://example.com
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Production
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        run: |
          echo "Deploying to production environment..."
          # Add your deployment commands here
YML

    # Track successes and failures
    local success_count=0
    local failure_count=0
    local processed_repos=()
    local failed_repos=()

    # Process each repository
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^# ]] && continue

        line="${line//[$'\t\r\n ']}"

        log_info "========================================"

        if process_repo "$line"; then
            log_success "Completed $line"
            success_count=$((success_count + 1))
            processed_repos+=("$line")
        else
            log_error "Failed to process $line"
            failure_count=$((failure_count + 1))
            failed_repos+=("$line")
        fi

        log_info "========================================"
        echo ""

    done < "$REPOS_FILE"

    # Summary report
    log_info "========== PROCESSING COMPLETE =========="
    log_info "Successfully processed: $success_count"
    log_info "Failed: $failure_count"

    if [[ ${#failed_repos[@]} -gt 0 ]]; then
        log_warn "Failed repositories:"
        for failed in "${failed_repos[@]}"; do
            echo "  - $failed"
        done
    fi

    if [[ $failure_count -gt 0 ]]; then
        exit 1
    fi
}

# Run main function
main "$@"
