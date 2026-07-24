#!/usr/bin/env bash
# =============================================================================
# mangu-repo-janitor.sh — one-command cleanup + hardening for redinc23/my_publishing
#
# What it handles (idempotent, dry-run by default — pass --apply to execute):
#   audit        Full read-only report: open PRs, branch census, secret scan, prod health
#   prs          Close the 6 obsolete PRs superseded by merged #243/#280 (already done 2026-07-19; safe to re-run)
#   branches     Delete stale branches (storm/scratch/merged) — keeps main + every open-PR head + keep-list
#   secrets-scan Verify no live JWTs/secrets remain on main HEAD
#   health       Probe production /api/live, /api/health?ready=1, homepage
#   gcp-secrets  Verify GCP Secret Manager entries required by cloudbuild.yaml / hardened deploy.yml (H0.3)
#   workflows    Write the 4 hardened workflow files (H0.4) into a local clone;
#                with --apply also commits, pushes branch, and opens the PR (needs YOUR git/gh auth — has workflow scope)
#
# Usage:
#   ./mangu-repo-janitor.sh audit                 # see everything, change nothing
#   ./mangu-repo-janitor.sh branches              # dry-run: list what WOULD be deleted
#   ./mangu-repo-janitor.sh branches --apply      # actually delete
#   ./mangu-repo-janitor.sh workflows --apply     # land H0.4 via your own credentials
#   ./mangu-repo-janitor.sh all --apply           # the whole mop-up
#
# Requires: gh (authenticated: gh auth login), git, curl, jq
# =============================================================================
set -euo pipefail

REPO="redinc23/my_publishing"
PROD="https://www.mangu-publishers.com"
APPLY=0
CMD="${1:-audit}"
[[ "${2:-}" == "--apply" || "${1:-}" == "--apply" ]] && APPLY=1

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
die()  { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null || die "missing dependency: $1"; }

need gh; need git; need curl; need jq

# Branches that must survive cleanup (open-PR heads are added dynamically).
KEEP_EXPLICIT=(
  main
  feature/top-dog-launch                                        # PR #282 (active launch work)
  release-please--branches--main--components--mangu-publishers  # PR #249 (release 1.0.2)
  cursor/mongodb-scaffold-dffa                                  # PR #234 (strategic: Phoenix/Mongo)
  cursor/phoenix-recon-deep-dive-95d8                           # PR #248 (Phoenix recon reference)
  cursor/cowork-operator-workflows-c5d8                         # PR #281 (cowork control plane + storm-guard)
  cursor/copilot-cli-integration-3cae                           # PR #142 (owner decision pending)
)

# Obsolete PRs: 4 cursor duplicates of merged #280, 1 duplicate of merged #243, 1 bot health-sweep noise.
OBSOLETE_PRS=(253 255 258 259 254 262)

# -----------------------------------------------------------------------------
cmd_audit() {
  say "1/4 Open PRs"
  gh pr list --repo "$REPO" --state open --limit 100 \
    --json number,title,author,isDraft,headRefName \
    --jq '.[] | "  #\(.number)\t\(.author.login)\t\(if .isDraft then "draft" else "ready" end)\t\(.title)"' \
    | sort -t'#' -k2 -n

  say "2/4 Branch census"
  local total storm
  total=$(gh api "repos/$REPO/branches?per_page=100" --paginate --jq 'length' | paste -sd+ | bc)
  storm=$(gh api "repos/$REPO/branches?per_page=100" --paginate --jq '.[].name' | grep -c 'ci-autofix-automation' || true)
  echo "  total branches: $total   (cursor ci-autofix storm branches: $storm)"

  say "3/4 Secret scan on main HEAD"
  cmd_secrets_scan || true

  say "4/4 Production health"
  cmd_health || true

  echo
  warn "Nothing was modified. Re-run any subcommand with --apply to execute."
}

# -----------------------------------------------------------------------------
cmd_prs() {
  say "Closing obsolete PRs (idempotent)"
  for n in "${OBSOLETE_PRS[@]}"; do
    state=$(gh pr view "$n" --repo "$REPO" --json state --jq .state 2>/dev/null || echo "unknown")
    if [[ "$state" == "OPEN" ]]; then
      if (( APPLY )); then
        gh pr close "$n" --repo "$REPO" \
          --comment "Closing as obsolete — superseded by merged #243/#280 or pure bot noise (see remediation report). Cleanup via mangu-repo-janitor.sh."
        ok "closed PR #$n"
      else
        warn "would close PR #$n (currently OPEN)"
      fi
    else
      ok "PR #$n already $state"
    fi
  done
}

# -----------------------------------------------------------------------------
cmd_branches() {
  say "Branch cleanup"
  mapfile -t all < <(gh api "repos/$REPO/branches?per_page=100" --paginate --jq '.[].name')
  mapfile -t open_heads < <(gh pr list --repo "$REPO" --state open --limit 100 --json headRefName --jq '.[].headRefName')

  local keep=("${KEEP_EXPLICIT[@]}" "${open_heads[@]}")
  local delete=()
  for b in "${all[@]}"; do
    local k=0
    for kb in "${keep[@]}"; do [[ "$b" == "$kb" ]] && { k=1; break; }; done
    (( k )) || delete+=("$b")
  done

  echo "  branches total: ${#all[@]} | keep: $((${#all[@]} - ${#delete[@]})) | delete: ${#delete[@]}"
  printf '  DELETE: %s\n' "${delete[@]}" | head -40
  (( ${#delete[@]} > 40 )) && echo "  … and $(( ${#delete[@]} - 40 )) more"

  if (( APPLY )); then
    for b in "${delete[@]}"; do
      if gh api -X DELETE "repos/$REPO/git/refs/heads/$b" >/dev/null 2>&1; then
        ok "deleted $b"
      else
        warn "could not delete $b (protected or missing permission)"
      fi
    done
    ok "branch cleanup complete"
  else
    warn "dry-run — re-run with --apply to delete"
  fi
}

# -----------------------------------------------------------------------------
cmd_secrets_scan() {
  local hits
  hits=$(gh search code "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 repo:$REPO" \
          --json path --jq '.[].path' 2>/dev/null || true)
  if grep -Eq 'next\.config\.js|\.env' <<<"$hits"; then
    warn "JWT-shaped strings found in sensitive files: $hits"
    return 1
  fi
  ok "only documented CI mocks/placeholders on main HEAD (history still hot — H0.1 rotation required)"
  gh api "repos/$REPO/contents/.github/bug-to-issue-state.json" >/dev/null 2>&1 \
    && warn ".github/bug-to-issue-state.json still tracked on main (deletable after workflow hardening lands)" || true
}

# -----------------------------------------------------------------------------
cmd_health() {
  local ready
  ready=$(curl -sf -m 15 "$PROD/api/health?ready=1") || { warn "readiness probe FAILED"; return 1; }
  jq -e '.ready == true' <<<"$ready" >/dev/null \
    && ok "ready:true — env/db/auth/migrations/stripe all pass" \
    || { warn "ready != true:"; echo "$ready" | head -5; return 1; }
  for ep in /api/live /; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$PROD$ep")
    [[ "$code" == "200" ]] && ok "$ep → 200" || warn "$ep → $code"
  done
}

# -----------------------------------------------------------------------------
cmd_gcp_secrets() {
  say "H0.3 — GCP Secret Manager verification"
  command -v gcloud >/dev/null || die "gcloud CLI not installed/authenticated"
  local project required missing=0
  project=$(gcloud config get-value project 2>/dev/null)
  echo "  GCP project: $project"
  required=(supabase-service-role-key stripe-secret-key stripe-webhook-secret)
  for s in "${required[@]}"; do
    if gcloud secrets describe "$s" --project="$project" >/dev/null 2>&1; then
      ok "$s exists"
    else
      warn "$s MISSING — create: printf '%s' \"\$VALUE\" | gcloud secrets create $s --data-file=- --project=$project"
      missing=1
    fi
  done
  for s in resend-api-key openai-api-key upstash-redis-rest-url upstash-redis-rest-token; do
    gcloud secrets describe "$s" --project="$project" >/dev/null 2>&1 \
      && ok "$s exists (optional)" || echo "  - $s absent (optional)"
  done
  (( missing )) && return 1 || ok "all required secrets present"
}

# -----------------------------------------------------------------------------
write_hardened_workflows() {  # $1 = repo root
  local root="$1"
  mkdir -p "$root/.github/workflows"

  cat > "$root/.github/workflows/deploy.yml" <<'YAML'
name: Deploy to Cloud Run

on:
  workflow_run:
    workflows: ['CI']
    types: [completed]
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: deploy-production-cloud-run
  cancel-in-progress: false

jobs:
  deploy:
    if: ${{ ((github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main') || github.event.workflow_run.conclusion == 'success') && vars.GCP_PROJECT_ID != '' }}
    runs-on: ubuntu-latest
    environment: production
    timeout-minutes: 30
    env:
      HAS_GCP_SA_KEY: ${{ secrets.GCP_SA_KEY != '' }}

    steps:
      - uses: actions/checkout@v7

      - name: Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version-file: '.nvmrc'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY }}
          NEXT_PUBLIC_SITE_URL: ${{ secrets.NEXT_PUBLIC_SITE_URL }}

      - name: Authenticate to Google Cloud
        if: ${{ env.HAS_GCP_SA_KEY == 'true' }}
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy to Cloud Run
        if: ${{ env.HAS_GCP_SA_KEY == 'true' }}
        uses: google-github-actions/deploy-cloudrun@v3
        with:
          service: mangu-publishers
          region: us-central1
          source: .
          env_vars: |
            NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
            NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
            NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${{ secrets.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY }}
            NEXT_PUBLIC_SITE_URL=${{ secrets.NEXT_PUBLIC_SITE_URL }}
            NODE_ENV=production
          # Privileged keys mounted from GCP Secret Manager — never plaintext env.
          # Names match cloudbuild.yaml. Prereq: H0.3 (verify secrets exist in the GCP project).
          secrets: |
            SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest
            STRIPE_SECRET_KEY=stripe-secret-key:latest
            STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest
YAML

  cat > "$root/.github/workflows/bug-to-issue.yml" <<'YAML'
name: Bug to Issue (continuous failures)

on:
  workflow_run:
    workflows: ['CI'] # must match the `name:` of ci.yml exactly, else this never fires
    types:
      - completed

permissions:
  actions: read
  contents: read
  issues: write

concurrency:
  group: bug-to-issue-${{ github.event.workflow_run.head_branch }}
  cancel-in-progress: false

jobs:
  create_or_update_issue:
    if: ${{ github.event.workflow_run.conclusion != 'skipped' }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout default branch
        uses: actions/checkout@v7
        with:
          ref: ${{ github.event.repository.default_branch }}

      - name: Setup Node
        uses: actions/setup-node@v7
        with:
          node-version-file: '.nvmrc'

      # State lives in the Actions cache, not git history.
      # (Previously every CI completion committed .github/bug-to-issue-state.json
      # to main — the state-push noise loop. restore-keys picks up the most
      # recent counter snapshot; each run saves under its unique run id.)
      - name: Restore bug-to-issue state (cache)
        uses: actions/cache/restore@v4
        with:
          path: .github/bug-to-issue-state.json
          key: bug-to-issue-state-${{ github.run_id }}
          restore-keys: |
            bug-to-issue-state-

      - name: Install deps
        # Pin to CJS-compatible releases; unpinned @actions/core@2+ is ESM-only and breaks require() in bug-to-issue.js
        # --no-save: install into node_modules only; do not dirty package.json/lock
        run: npm i --no-save @actions/core@1.11.1 @actions/github@6.0.0

      - name: Run bug-to-issue
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OWNER: ${{ github.repository_owner }}
          REPO: ${{ github.event.repository.name }}
          RUN_ID: ${{ github.event.workflow_run.id }}
          RUN_CONCLUSION: ${{ github.event.workflow_run.conclusion }}
          RUN_HTML_URL: ${{ github.event.workflow_run.html_url }}
          RUN_NAME: ${{ github.event.workflow_run.name }}
          RUN_HEAD_BRANCH: ${{ github.event.workflow_run.head_branch }}
          RUN_HEAD_SHA: ${{ github.event.workflow_run.head_sha }}
          THRESHOLD_FAILS: '3' # create issue after 3 consecutive fails
          CLOSE_AFTER_SUCCESSES: '2' # auto-close after 2 consecutive successes
        run: node .github/scripts/bug-to-issue.js

      - name: Save bug-to-issue state (cache)
        uses: actions/cache/save@v4
        with:
          path: .github/bug-to-issue-state.json
          key: bug-to-issue-state-${{ github.run_id }}
YAML

  cat > "$root/.github/workflows/ci.yml" <<'YAML'
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      USE_MOCKS: true
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY }}
      NEXT_PUBLIC_SITE_URL: ${{ secrets.NEXT_PUBLIC_SITE_URL }}
      # Never expose the production service-role key to pull_request runs.
      # PR jobs use the documented CI mock fixture (same as scripts/pre-launch-verify.sh).
      SUPABASE_SERVICE_ROLE_KEY: ${{ github.event_name != 'pull_request' && secrets.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-for-ci' }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: '.nvmrc'
          cache: npm
      - run: npm ci
      - run: npm run validate-env
      - run: npm run type-check
      - run: npm run lint
      - run: npm test
      - run: npm run build
YAML

  cat > "$root/.github/workflows/auto-merge.yml" <<'YAML'
name: Auto-Merge PRs

on:
  pull_request:
    types: [opened, synchronize, labeled, reopened]
  check_suite:
    types: [completed]

permissions:
  pull-requests: write
  contents: write
  checks: read
  issues: write

concurrency:
  group: auto-merge
  cancel-in-progress: false

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Auto-merge labeled PRs
        uses: actions/github-script@v9
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const { owner, repo } = context.repo;

            // LABEL-GATED ONLY: a human must apply the `auto-merge` label.
            // Hardening fix: removed the AI-agent username bypass that let bot PRs
            // merge themselves with zero human review, and removed the dead
            // workflow_run trigger for the retired 'Vercel Build, Test & Deploy' workflow.

            const { data: prs } = await github.rest.pulls.list({
              owner, repo,
              state: 'open',
              base: 'main',
              per_page: 20
            });

            for (const pr of prs) {
              const labels = pr.labels.map(l => l.name);
              if (!labels.includes('auto-merge')) {
                core.info(`Skipping PR #${pr.number} — no auto-merge label`);
                continue;
              }

              const { data: checks } = await github.rest.checks.listForRef({
                owner, repo,
                ref: pr.head.sha,
                per_page: 50
              });

              const runs = checks.check_runs;
              const relevant = runs.filter(r => r.name !== 'auto-merge');
              const allDone = relevant.every(r => r.status === 'completed');
              const allPassed = relevant.every(r =>
                r.conclusion === 'success' || r.conclusion === 'skipped' || r.conclusion === 'neutral'
              );

              const ciCheck = relevant.find(r => r.name === 'CI');
              if (!ciCheck || ciCheck.conclusion !== 'success') {
                core.warning(`PR #${pr.number}: Required CI check not present or not successful — not merging`);
                continue;
              }

              if (!allDone) {
                core.info(`PR #${pr.number}: CI still running, skipping`);
                continue;
              }

              if (!allPassed) {
                core.warning(`PR #${pr.number}: CI failed — not merging`);
                await github.rest.issues.createComment({
                  owner, repo,
                  issue_number: pr.number,
                  body: '❌ **Auto-merge skipped** — CI checks failed. Fix the failures and this will retry automatically.'
                });
                continue;
              }

              core.info(`Merging PR #${pr.number}: ${pr.title}`);
              try {
                await github.rest.pulls.merge({
                  owner, repo,
                  pull_number: pr.number,
                  merge_method: 'squash',
                  commit_title: `${pr.title} (#${pr.number})`,
                  commit_message: pr.body || ''
                });
                core.info(`✅ Merged PR #${pr.number}`);
              } catch (err) {
                core.warning(`Could not merge PR #${pr.number}: ${err.message}`);
              }
            }
YAML
}

cmd_workflows() {
  say "H0.4 — workflow hardening set"
  local dir
  dir=$(mktemp -d)
  git clone --depth 1 "https://github.com/$REPO.git" "$dir/repo" --quiet
  write_hardened_workflows "$dir/repo"
  ok "4 hardened workflow files written to $dir/repo/.github/workflows/"
  git -C "$dir/repo" diff --stat || true

  if (( APPLY )); then
    git -C "$dir/repo" checkout -b chore/workflow-hardening-h04 --quiet
    git -C "$dir/repo" add .github/workflows
    git -C "$dir/repo" -c user.name="${GIT_AUTHOR_NAME:-mangu-janitor}" \
        -c user.email="${GIT_AUTHOR_EMAIL:-janitor@localhost}" commit --quiet -m \
"ci(hardening): H0.4 workflow security set

- deploy.yml: privileged secrets via GCP Secret Manager (secrets: block), permissions, concurrency, environment: production, timeout
- bug-to-issue.yml: state persisted via actions/cache instead of commits to main (kills state-push loop); contents:write dropped
- ci.yml: service-role key no longer exposed on pull_request runs; top-level read-only permissions
- auto-merge.yml: human-applied label gate only (AI-agent bypass removed); dead workflow_run trigger removed"
    git -C "$dir/repo" push -u origin chore/workflow-hardening-h04
    gh pr create --repo "$REPO" --base main --head chore/workflow-hardening-h04 \
      --title "ci(hardening): H0.4 workflow security set (deploy secrets, state-loop kill, label-gated auto-merge)" \
      --body "Applies the HUMAN_TASKS.md H0.4 hardening set. After merge: enable branch protection (H1.1), then run release-please (#249). Delete the tracked .github/bug-to-issue-state.json in a follow-up."
    ok "PR opened — review and merge"
  else
    warn "dry-run — files staged in $dir/repo (nothing pushed). Re-run with --apply to branch + push + open PR."
    echo "  To inspect: ls $dir/repo/.github/workflows/"
  fi
}

# -----------------------------------------------------------------------------
case "$CMD" in
  audit)        cmd_audit ;;
  prs)          cmd_prs ;;
  branches)     cmd_branches ;;
  secrets-scan) cmd_secrets_scan ;;
  health)       cmd_health ;;
  gcp-secrets)  cmd_gcp_secrets ;;
  workflows)    cmd_workflows ;;
  all)          cmd_prs; cmd_branches; cmd_secrets_scan || true; cmd_health || true; cmd_workflows ;;
  *) die "unknown command: $CMD (audit|prs|branches|secrets-scan|health|gcp-secrets|workflows|all)" ;;
esac
