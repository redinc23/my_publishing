# Juncture Controls: Commit → PR → Merge → Deploy → Monitor

> Controls at each stage of the deployment pipeline.  
> **Example tool:** MANGU Platform (digital publishing).

---

## Overview

Each **juncture** is a decision point where quality, security, and stability must be enforced. These controls apply to most tools deployed via GitHub.

---

## 1. Commit (Local)

**Goal:** Prevent bad code from entering the pipeline.

| Control | Requirement | MANGU Example |
|---------|-------------|---------------|
| **Lint** | Code passes `npm run lint` (or equivalent) | `next lint` |
| **Type-check** | No TypeScript errors | `tsc --noEmit` |
| **Secrets scan** | No API keys, tokens, or passwords in code | `.env*` in `.gitignore` |
| **Env validation** | Required env vars documented and validated | `npm run validate-env` |
| **Commit message** | Conventional format encouraged | `feat:`, `fix:`, `chore:` |

### Recommended Pre-Commit Hooks

```bash
# .husky/pre-commit (if using husky)
npm run lint
npm run type-check
```

### What Must NOT Be Committed

- `.env`, `.env.local`, `.env.production`
- `node_modules/`
- Build artifacts (`.next/`, `dist/`)
- API keys, webhook secrets, service role keys

---

## 2. Pull Request (Review)

**Goal:** Ensure changes are reviewed and tested before merge.

| Control | Requirement | MANGU Example |
|---------|-------------|---------------|
| **CI must pass** | All jobs green before merge | `.github/workflows/ci.yml` |
| **Tests** | Unit tests pass | `npm test` |
| **Build** | Project builds successfully | `next build` |
| **Review** | At least 1 approval (configurable) | GitHub branch protection |
| **No direct push** | No force-push to `main` | Branch protection rule |

### CI Pipeline Stages (MANGU)

```yaml
# .github/workflows/ci.yml
- npm ci
- npm run type-check
- npm run lint
- npm test
```

### PR Checklist (Human)

- [ ] Description explains what and why
- [ ] No unrelated changes (scope creep)
- [ ] Breaking changes documented
- [ ] Migrations (if any) are reversible or documented

---

## 3. Merge (Main Branch)

**Goal:** Protect `main` as the source of truth for production.

| Control | Requirement | MANGU Example |
|---------|-------------|---------------|
| **Branch protection** | PR required; CI required; approvals required | Configure in GitHub |
| **Squash or merge** | Clean history; no merge commits if preferred | Team preference |
| **Delete branch** | Optional auto-delete after merge | GitHub setting |
| **Tagging** | Optional: tag releases (e.g. `v1.0.0`) | Semantic versioning |

### Recommended Branch Protection Rules

- **Require pull request:** Yes
- **Require status checks:** `test` (or equivalent)
- **Require approvals:** 1
- **Restrict pushes:** No direct push to `main`
- **Allow force push:** No

---

## 4. Deploy (Staging / Production)

**Goal:** Deploy only verified builds; support rollback.

| Control | Requirement | MANGU Example |
|---------|-------------|---------------|
| **Build verification** | Deploy only after successful build | Amplify/Vercel auto-build |
| **Environment variables** | All required vars set; no placeholders in prod | Amplify env config |
| **Health check** | `/api/health` or equivalent returns healthy | `GET /api/health` → `{"status":"healthy"}` |
| **Rollback procedure** | Documented; executable in &lt;5 min | [MANGU Production Deployment](../MANGU_PRODUCTION_DEPLOYMENT.md) |
| **Staging first** | Deploy to staging before prod (when feasible) | Preview deployments |

### Deployment Targets (MANGU)

| Target | Trigger | Platform |
|--------|---------|----------|
| Preview | PR opened | Vercel/Amplify preview |
| Staging | Merge to `develop` (if used) | Optional |
| Production | Merge to `main` | Vercel, Amplify, or GCP Cloud Run |

### Post-Deploy Verification

- [ ] Homepage loads
- [ ] `/api/health` returns 200
- [ ] Auth flow works (login/signup)
- [ ] Critical paths (e.g. checkout) smoke-tested

---

## 5. Monitor (Post-Deploy)

**Goal:** Detect issues quickly; support incident response.

| Control | Requirement | MANGU Example |
|---------|-------------|---------------|
| **Logs** | Application logs accessible | Cloud Logging, Vercel logs |
| **Errors** | Error tracking (e.g. Sentry) | Optional |
| **Health endpoint** | Monitored externally or internally | `/api/health` |
| **Alerts** | Build failure, 5xx spikes | Platform notifications |
| **Dashboards** | Basic metrics visible | Supabase, Stripe, platform dashboards |

### Monitoring Checklist

- [ ] Build failures notify team
- [ ] Database/API errors visible
- [ ] Payment (Stripe) activity monitored
- [ ] Uptime or health check configured (optional)

---

## Control Matrix Summary

| Juncture | Automated | Manual |
|----------|-----------|--------|
| **Commit** | Lint, type-check, secrets scan | Commit message quality |
| **PR** | CI, tests, build | Code review, PR description |
| **Merge** | Branch protection, status checks | Approval |
| **Deploy** | Build, env validation | Rollback decision |
| **Monitor** | Logs, health checks | Alert response, incident handling |

---

## References

- [Standards Living Document](../STANDARDS_LIVING_DOCUMENT.md)
- [AI Agent Prompts](../prompts/AI-AGENT-PROMPTS.md)
- [MANGU Production Deployment](../MANGU_PRODUCTION_DEPLOYMENT.md)
- [Launch Checklist](../LAUNCH_CHECKLIST.md)
