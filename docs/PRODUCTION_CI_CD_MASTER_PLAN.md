# Production CI/CD Master Plan

## Overview

This document outlines the comprehensive CI/CD pipeline implementation for the mangu-platform Next.js application. The pipeline ensures code quality, security, and reliable deployments through automated testing and continuous delivery.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CI/CD Pipeline Architecture                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Push/PR   │───▶│   Quality   │───▶│    Build    │───▶│   Deploy    │  │
│  │   Trigger   │    │   Checks    │    │    Test     │    │   Preview   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                            │                  │                  │          │
│                            ▼                  ▼                  ▼          │
│                     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│                     │  Security   │    │    E2E      │    │   Deploy    │  │
│                     │   Audit     │    │   Tests     │    │ Production  │  │
│                     └─────────────┘    └─────────────┘    └─────────────┘  │
│                            │                  │                             │
│                            ▼                  ▼                             │
│                     ┌─────────────┐    ┌─────────────┐                     │
│                     │   CodeQL    │    │ Lighthouse  │                     │
│                     │  Analysis   │    │     CI      │                     │
│                     └─────────────┘    └─────────────┘                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Workflow Files

### 1. CI Pipeline (`ci.yml`)

The main CI pipeline runs on every push to `main`/`develop` and on pull requests.

#### Jobs:

| Job | Purpose | Dependencies |
|-----|---------|--------------|
| `quality-checks` | Linting, Type-check, Formatting | None |
| `security-audit` | npm audit, Snyk vulnerability scan | None |
| `unit-tests` | Jest tests with coverage | None |
| `build-test` | Next.js build verification | `quality-checks` |
| `e2e-tests` | Playwright tests with Postgres | `build-test` |
| `codeql` | GitHub CodeQL security analysis | None |
| `lighthouse` | Performance & accessibility checks | `build-test` |
| `deploy-staging` | Deploy to staging (develop branch) | `unit-tests`, `build-test`, `security-audit` |
| `deploy-production` | Deploy to production (main branch) | All checks |

### 2. Deploy Preview (`deploy-preview.yml`)

Automatically deploys preview environments for pull requests.

- **Trigger**: Pull request opened, synchronized, or reopened
- **Target**: Vercel Preview Environment
- **Features**:
  - Automatic preview URL generation
  - PR comment with preview link
  - Optional AWS Amplify deployment

### 3. Rollback (`rollback.yml`)

Manual workflow to revert deployments when issues are detected.

- **Trigger**: `workflow_dispatch` (manual)
- **Options**:
  - Environment selection (production/staging)
  - Rollback type (previous deployment or specific commit)
  - Reason documentation

### 4. Dependabot Auto-Approve (`dependabot-auto-approve.yml`)

Automatically approves and merges safe dependency updates.

- **Auto-approved**: Minor and patch updates
- **Manual review required**: Major version updates
- **Security check**: Runs npm audit on all updates

## Configuration Files

### Dependabot Configuration (`.github/dependabot.yml`)

```yaml
Updates configured for:
- npm dependencies (weekly, Mondays)
- GitHub Actions (weekly, Mondays)
- Docker images (weekly, Mondays)

Grouping:
- React ecosystem
- Radix UI components
- Testing libraries
- TypeScript/ESLint
- Supabase packages
```

### CodeQL Configuration (`.github/codeql/codeql-config.yml`)

- **Queries**: security-extended, security-and-quality
- **Languages**: JavaScript/TypeScript
- **Excluded paths**: node_modules, .next, test files
- **Analyzed paths**: app, components, lib, types, scripts

### Lighthouse Configuration (`.lighthouserc.json`)

| Metric | Threshold |
|--------|-----------|
| Performance | ≥ 0.9 |
| Accessibility | ≥ 0.9 |
| Best Practices | ≥ 0.9 |
| SEO | ≥ 0.9 |
| FCP | ≤ 2000ms |
| LCP | ≤ 2500ms |
| CLS | ≤ 0.1 |

## Required Secrets

### Supabase (Test Environment)

| Secret Name | Description |
|-------------|-------------|
| `SUPABASE_TEST_ANON_KEY` | Supabase anonymous key for test environment |
| `SUPABASE_TEST_SERVICE_KEY` | Supabase service role key for test environment |
| `SUPABASE_PREVIEW_URL` | Supabase project URL for preview deployments |
| `SUPABASE_PREVIEW_ANON_KEY` | Supabase anon key for preview deployments |
| `SUPABASE_PREVIEW_SERVICE_KEY` | Supabase service key for preview deployments |

### Supabase (Production)

| Secret Name | Description |
|-------------|-------------|
| `SUPABASE_PROD_URL` | Production Supabase project URL |
| `SUPABASE_PROD_ANON_KEY` | Production anonymous key |
| `SUPABASE_PROD_SERVICE_KEY` | Production service role key |

### Vercel

| Secret Name | Description |
|-------------|-------------|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

### Stripe

| Secret Name | Description |
|-------------|-------------|
| `STRIPE_TEST_SECRET_KEY` | Stripe test mode secret key |
| `STRIPE_TEST_PUBLISHABLE_KEY` | Stripe test mode publishable key |
| `STRIPE_TEST_WEBHOOK_SECRET` | Stripe test webhook signing secret |
| `STRIPE_LIVE_SECRET_KEY` | Stripe live mode secret key (production) |
| `STRIPE_LIVE_PUBLISHABLE_KEY` | Stripe live mode publishable key (production) |
| `STRIPE_LIVE_WEBHOOK_SECRET` | Stripe live webhook signing secret (production) |

### Other Services

| Secret Name | Description |
|-------------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `RESEND_API_KEY` | Resend email API key |
| `CODECOV_TOKEN` | Codecov upload token |
| `SNYK_TOKEN` | Snyk security scanning token |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI GitHub app token |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications (optional) |

### AWS (for Amplify deployment)

| Secret Name | Description |
|-------------|-------------|
| `AWS_AMPLIFY_ROLE_ARN` | AWS IAM role ARN for Amplify deployments |
| `AWS_REGION` | AWS region (e.g., us-east-1) |
| `AMPLIFY_APP_ID` | AWS Amplify application ID |

## Deployment Strategy

### Environments

```
┌─────────────────────────────────────────────────────────────────┐
│                    Deployment Environments                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Preview   │    │   Staging   │    │     Production      │ │
│  │  (PR-based) │    │  (develop)  │    │       (main)        │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│        │                  │                      │              │
│        ▼                  ▼                      ▼              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Vercel    │    │   Vercel    │    │  Vercel / Amplify   │ │
│  │   Preview   │    │   Staging   │    │    + Route 53       │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Vercel Deployment (Primary)

1. **Preview**: Automatic deployment for every PR
2. **Staging**: Automatic deployment on `develop` branch push
3. **Production**: Automatic deployment on `main` branch push (after all checks pass)

### AWS Amplify + Route 53 (Alternative/Hybrid)

For enterprise deployments requiring AWS infrastructure:

1. **DNS Management**: Route 53 for custom domain management
2. **CDN**: CloudFront for global content delivery
3. **Hosting**: Amplify for serverless Next.js hosting
4. **SSL**: ACM for certificate management

#### Amplify Setup:

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
amplify init

# Add hosting
amplify add hosting

# Deploy
amplify publish
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run ci` | Run all CI checks (lint, type-check, format, tests, build) |
| `npm run ci:quick` | Quick validation (lint, type-check, format) |
| `npm run ci:full` | Full CI including E2E tests |
| `npm run test:ci` | Jest with coverage and JUnit reporter |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

## Branch Protection Rules

### Main Branch

- **Required status checks**:
  - `quality-checks`
  - `unit-tests`
  - `build-test`
  - `e2e-tests`
  - `security-audit`
  - `codeql`
- **Required reviews**: 1
- **Dismiss stale reviews**: Yes
- **Require up-to-date branches**: Yes
- **Restrict force pushes**: Yes
- **Restrict deletions**: Yes

### Develop Branch

- **Required status checks**:
  - `quality-checks`
  - `unit-tests`
  - `build-test`
- **Required reviews**: 1

## Monitoring & Alerts

### GitHub Actions

- View workflow runs: `Actions` tab in repository
- Download artifacts: Available for 7-30 days depending on type

### Notifications

1. **GitHub**: Email notifications for failed workflows
2. **Slack**: Optional webhook integration for deployment notifications
3. **Vercel**: Dashboard and email notifications

## Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Check build locally
npm run build

# Check for missing environment variables
npm run validate-env
```

#### 2. Test Failures

```bash
# Run tests locally
npm test
npm run test:e2e
```

#### 3. Deployment Issues

```bash
# Check Vercel deployment
vercel logs [deployment-url]

# Manual rollback
# Use the rollback.yml workflow
```

### Emergency Procedures

#### Production Incident Response

1. **Assess**: Check error logs and monitoring dashboards
2. **Rollback**: Use `rollback.yml` workflow if needed
3. **Communicate**: Update stakeholders
4. **Investigate**: Root cause analysis
5. **Fix**: Create PR with fix
6. **Document**: Update runbooks if needed

## Setup Script

Run the setup script to configure repository secrets and branch protection:

```bash
chmod +x scripts/finalize-ci-setup.sh
./scripts/finalize-ci-setup.sh
```

## Maintenance

### Weekly

- Review Dependabot PRs
- Check security alerts
- Review workflow run times

### Monthly

- Update action versions
- Review and update thresholds
- Audit secrets rotation

### Quarterly

- Review and update documentation
- Performance baseline updates
- Security audit review

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [AWS Amplify Hosting](https://docs.amplify.aws/guides/hosting/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [CodeQL Documentation](https://codeql.github.com/docs/)
