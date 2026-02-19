#!/bin/bash

# ==============================================================================
# 🚀 MANGU PLATFORM - CI/CD FINALIZATION SCRIPT
# This script sets up GitHub Secrets and Branch Protection rules.
# Usage: ./scripts/finalize-ci-setup.sh
# ==============================================================================

# Ensure we're in the root
cd "$(dirname "$0")/.."

echo "🔍 Checking GitHub CLI auth..."
if ! gh auth status &>/dev/null; then
    echo "❌ Error: You must be logged in to GitHub CLI. Run 'gh auth login' first."
    # In this environment, we assume we are logged in, but proceed with caution if not.
fi

# Get Repo Name
REPO_JSON=$(gh repo view --json nameWithOwner)
REPO=$(echo "$REPO_JSON" | jq -r .nameWithOwner)
echo "✅ Connected to: $REPO"

# --- 1. SET TEST/MOCK SECRETS (Safe to automate) ---
echo -e "\n🔐 Setting up TEST Environment Secrets (Mock Values)..."

# Generate random secure keys for mocks
MOCK_KEY=$(openssl rand -base64 32)
MOCK_SERVICE_KEY=$(openssl rand -base64 32)

echo "Setting SUPABASE_TEST_PROJECT_URL..."
gh secret set SUPABASE_TEST_PROJECT_URL --body "https://test-project.supabase.co"

echo "Setting SUPABASE_TEST_PROJECT_KEY..."
gh secret set SUPABASE_TEST_PROJECT_KEY --body "mock-anon-key-$MOCK_KEY"

echo "Setting SUPABASE_TEST_SERVICE_KEY..."
gh secret set SUPABASE_TEST_SERVICE_KEY --body "mock-service-key-$MOCK_SERVICE_KEY"

echo "Setting PREVIEW_URL..."
gh secret set PREVIEW_URL --body "https://preview.mangu.app"

echo "✅ Test secrets configured."

# --- 2. BRANCH PROTECTION RULES ---
echo -e "\n🛡️  Setting up Branch Protection for 'main'..."

# Try to set branch protection. If it fails (due to permissions), we warn but don't fail the script.
if gh api -X PUT "repos/$REPO/branches/main/protection" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": [
        "quality-checks",
        "unit-tests",
        "build-test",
        "e2e-tests",
        "CodeQL"
      ]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": {
      "required_approving_review_count": 1,
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": false
    },
    "restrictions": null,
    "required_linear_history": true,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'; then
    echo "✅ Branch protection enabled."
else
    echo "⚠️  WARNING: Could not set branch protection rules."
    echo "   This usually means the GITHUB_TOKEN used by Cursor doesn't have 'Repo Administration' permissions."
    echo "   Please set branch protection rules manually in GitHub Settings > Branches."
fi

echo -e "\n🎉 SETUP COMPLETE!"
echo "---------------------------------------------------"
echo "⚠️  ACTION REQUIRED: You still need to manually set these PRODUCTION secrets if using deployments:"
echo "   - VERCEL_TOKEN"
echo "   - AWS_ACCESS_KEY_ID (for Amplify)"
echo "   - AWS_SECRET_ACCESS_KEY (for Amplify)"
echo "   - SLACK_BOT_TOKEN (for notifications)"
echo "Run: gh secret set NAME_OF_SECRET"
echo "---------------------------------------------------"
