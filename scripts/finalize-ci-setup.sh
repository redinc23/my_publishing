#!/bin/bash

# ============================================================================
# Production CI/CD Setup Script
# ============================================================================
# This script configures GitHub repository secrets and branch protection rules
# for the production CI/CD pipeline.
#
# Prerequisites:
# - GitHub CLI (gh) must be installed and authenticated
# - User must have admin access to the repository
#
# Usage:
#   ./scripts/finalize-ci-setup.sh [--dry-run]
#
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=${1:-""}
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}============================================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}============================================================================${NC}"
}

run_command() {
    if [ "$DRY_RUN" == "--dry-run" ]; then
        echo "[DRY-RUN] Would execute: $*"
    else
        "$@"
    fi
}

# ============================================================================
# Validation
# ============================================================================

validate_prerequisites() {
    log_section "Validating Prerequisites"

    # Check for gh CLI
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) is not installed. Please install it first."
        log_info "Installation: https://cli.github.com/manual/installation"
        exit 1
    fi
    log_success "GitHub CLI is installed"

    # Check if authenticated
    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI is not authenticated. Please run 'gh auth login' first."
        exit 1
    fi
    log_success "GitHub CLI is authenticated"

    # Check repository access
    if [ -z "$REPO" ]; then
        log_error "Could not determine repository. Please run from repository root."
        exit 1
    fi
    log_success "Repository detected: $REPO"

    # Check admin access
    PERMISSION=$(gh api repos/$REPO --jq '.permissions.admin' 2>/dev/null || echo "false")
    if [ "$PERMISSION" != "true" ]; then
        log_warning "You may not have admin access to this repository."
        log_warning "Some operations might fail."
    else
        log_success "Admin access confirmed"
    fi
}

# ============================================================================
# Set Repository Secrets
# ============================================================================

set_mock_secrets() {
    log_section "Setting Mock Secrets for Test Environment"

    # Note: These are mock values for development/testing purposes
    # Replace with real values in production

    declare -A SECRETS=(
        # Supabase Test
        ["SUPABASE_TEST_ANON_KEY"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-test-anon-key"
        ["SUPABASE_TEST_SERVICE_KEY"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-test-service-key"
        ["SUPABASE_PREVIEW_URL"]="https://mock-preview.supabase.co"
        ["SUPABASE_PREVIEW_ANON_KEY"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-preview-anon-key"
        ["SUPABASE_PREVIEW_SERVICE_KEY"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-preview-service-key"

        # Vercel
        ["VERCEL_TOKEN"]="mock-vercel-token-replace-with-real"
        ["VERCEL_ORG_ID"]="mock-org-id-replace-with-real"
        ["VERCEL_PROJECT_ID"]="mock-project-id-replace-with-real"

        # Stripe Test
        ["STRIPE_TEST_SECRET_KEY"]="sk_test_mock_stripe_key"
        ["STRIPE_TEST_PUBLISHABLE_KEY"]="pk_test_mock_stripe_key"
        ["STRIPE_TEST_WEBHOOK_SECRET"]="whsec_mock_webhook_secret"

        # Other Services
        ["OPENAI_API_KEY"]="sk-mock-openai-api-key"
        ["RESEND_API_KEY"]="re_mock_resend_api_key"
        ["CODECOV_TOKEN"]="mock-codecov-token"
        ["SNYK_TOKEN"]="mock-snyk-token"
    )

    for secret_name in "${!SECRETS[@]}"; do
        log_info "Setting secret: $secret_name"
        run_command gh secret set "$secret_name" --body "${SECRETS[$secret_name]}" --repo "$REPO" 2>/dev/null || {
            log_warning "Failed to set secret: $secret_name (may already exist or require different permissions)"
        }
    done

    log_success "Mock secrets configured"
    log_warning "Remember to replace mock values with real credentials before production deployment!"
}

# ============================================================================
# Set Branch Protection Rules
# ============================================================================

set_branch_protection() {
    log_section "Setting Branch Protection Rules"

    # Main branch protection
    log_info "Configuring protection for 'main' branch..."

    MAIN_PROTECTION='{
        "required_status_checks": {
            "strict": true,
            "contexts": [
                "Quality Checks",
                "Unit Tests",
                "Build Test",
                "Security Audit"
            ]
        },
        "enforce_admins": false,
        "required_pull_request_reviews": {
            "dismissal_restrictions": {},
            "dismiss_stale_reviews": true,
            "require_code_owner_reviews": false,
            "required_approving_review_count": 1
        },
        "restrictions": null,
        "required_linear_history": false,
        "allow_force_pushes": false,
        "allow_deletions": false,
        "block_creations": false,
        "required_conversation_resolution": true
    }'

    if [ "$DRY_RUN" == "--dry-run" ]; then
        echo "[DRY-RUN] Would set main branch protection with:"
        echo "$MAIN_PROTECTION" | jq .
    else
        echo "$MAIN_PROTECTION" | gh api \
            --method PUT \
            -H "Accept: application/vnd.github+json" \
            repos/$REPO/branches/main/protection \
            --input - 2>/dev/null && log_success "Main branch protection configured" || {
            log_warning "Failed to set main branch protection (branch may not exist or requires different permissions)"
        }
    fi

    # Develop branch protection (less strict)
    log_info "Configuring protection for 'develop' branch..."

    DEVELOP_PROTECTION='{
        "required_status_checks": {
            "strict": false,
            "contexts": [
                "Quality Checks",
                "Unit Tests"
            ]
        },
        "enforce_admins": false,
        "required_pull_request_reviews": {
            "dismissal_restrictions": {},
            "dismiss_stale_reviews": false,
            "require_code_owner_reviews": false,
            "required_approving_review_count": 1
        },
        "restrictions": null,
        "required_linear_history": false,
        "allow_force_pushes": false,
        "allow_deletions": false
    }'

    if [ "$DRY_RUN" == "--dry-run" ]; then
        echo "[DRY-RUN] Would set develop branch protection with:"
        echo "$DEVELOP_PROTECTION" | jq .
    else
        echo "$DEVELOP_PROTECTION" | gh api \
            --method PUT \
            -H "Accept: application/vnd.github+json" \
            repos/$REPO/branches/develop/protection \
            --input - 2>/dev/null && log_success "Develop branch protection configured" || {
            log_warning "Failed to set develop branch protection (branch may not exist)"
        }
    fi
}

# ============================================================================
# Create Repository Labels
# ============================================================================

create_labels() {
    log_section "Creating Repository Labels"

    declare -A LABELS=(
        ["dependencies"]="0366d6:Pull requests that update a dependency file"
        ["npm"]="cb2431:npm package updates"
        ["github-actions"]="000000:GitHub Actions updates"
        ["docker"]="0db7ed:Docker-related changes"
        ["patch"]="7057ff:Patch version update"
        ["minor"]="ffff00:Minor version update"
        ["major"]="ff0000:Major version update"
        ["breaking-change"]="d73a4a:Breaking change"
        ["rollback"]="b60205:Deployment rollback"
        ["incident"]="e99695:Production incident"
        ["staging"]="fbca04:Staging environment"
        ["production"]="0e8a16:Production environment"
        ["ci-cd"]="1d76db:CI/CD pipeline changes"
        ["security"]="d93f0b:Security-related changes"
    )

    for label_name in "${!LABELS[@]}"; do
        IFS=':' read -r color description <<< "${LABELS[$label_name]}"
        log_info "Creating label: $label_name"
        run_command gh label create "$label_name" --color "$color" --description "$description" --repo "$REPO" 2>/dev/null || {
            log_info "Label '$label_name' already exists or could not be created"
        }
    done

    log_success "Labels configured"
}

# ============================================================================
# Configure GitHub Environments
# ============================================================================

configure_environments() {
    log_section "Configuring GitHub Environments"

    # Create environments
    for env in "preview" "staging" "production"; do
        log_info "Creating environment: $env"
        run_command gh api \
            --method PUT \
            -H "Accept: application/vnd.github+json" \
            repos/$REPO/environments/$env 2>/dev/null || {
            log_warning "Failed to create environment: $env"
        }
    done

    # Add protection rules to production
    log_info "Adding protection rules to production environment..."

    PROD_PROTECTION='{
        "wait_timer": 0,
        "reviewers": [],
        "deployment_branch_policy": {
            "protected_branches": true,
            "custom_branch_policies": false
        }
    }'

    if [ "$DRY_RUN" != "--dry-run" ]; then
        echo "$PROD_PROTECTION" | gh api \
            --method PUT \
            -H "Accept: application/vnd.github+json" \
            repos/$REPO/environments/production \
            --input - 2>/dev/null || {
            log_warning "Failed to configure production environment protection"
        }
    fi

    log_success "Environments configured"
}

# ============================================================================
# Summary
# ============================================================================

print_summary() {
    log_section "Setup Complete!"

    echo ""
    echo "The following has been configured:"
    echo ""
    echo "  1. Repository Secrets (mock values)"
    echo "     - Supabase test/preview credentials"
    echo "     - Vercel deployment tokens"
    echo "     - Stripe test keys"
    echo "     - Third-party API keys"
    echo ""
    echo "  2. Branch Protection Rules"
    echo "     - main: Requires PR reviews, status checks, no force push"
    echo "     - develop: Requires basic status checks"
    echo ""
    echo "  3. Repository Labels"
    echo "     - Dependency management labels"
    echo "     - Environment labels"
    echo "     - CI/CD and security labels"
    echo ""
    echo "  4. GitHub Environments"
    echo "     - preview, staging, production"
    echo ""
    echo -e "${YELLOW}IMPORTANT:${NC}"
    echo "  - Replace mock secrets with real values before production use"
    echo "  - Review branch protection settings for your team's workflow"
    echo "  - Configure Vercel/Amplify project settings manually"
    echo ""
    echo "Documentation: docs/PRODUCTION_CI_CD_MASTER_PLAN.md"
    echo ""
}

# ============================================================================
# Main
# ============================================================================

main() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Production CI/CD Setup Script                                ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ "$DRY_RUN" == "--dry-run" ]; then
        log_warning "Running in DRY-RUN mode. No changes will be made."
    fi

    validate_prerequisites
    set_mock_secrets
    set_branch_protection
    create_labels
    configure_environments
    print_summary
}

main "$@"
