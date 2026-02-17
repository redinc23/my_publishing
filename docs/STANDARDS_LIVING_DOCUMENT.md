# Standards & Controls Living Document

> **Example Tool:** MANGU Platform (digital publishing)  
> **Purpose:** Single source of truth for deployment standards, controls, and workflows applied when tools are deployed to GitHub and beyond.

---

## Reality Check

**What this document IS:**
- A living, evolving reference for how we deploy tools safely
- A navigation hub to detailed workflows and prompts
- A reality check against "we do it right" vs. what actually happens
- Applicable to most tools (MANGU is the reference example)

**What this document is NOT:**
- A replacement for human judgment
- A guarantee that every deployment follows every control
- A one-time read—it must be updated as practices change

---

## End-to-End Workflow (High Level)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   COMMIT    │───▶│     PR      │───▶│    MERGE     │───▶│   DEPLOY    │───▶│   MONITOR   │
│  (local)    │    │  (review)   │    │  (main)      │    │ (staging/   │    │ (health,     │
│             │    │             │    │              │    │  prod)      │    │  logs)      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                    │                   │                   │                   │
      ▼                    ▼                   ▼                   ▼                   ▼
  Pre-commit          CI checks          Branch prot.        Build verify       Health checks
  Lint/type-check     Tests              Approvals           Env validation     Alerts
  Secrets scan        Security scan      Squash/merge        Rollback ready     Dashboards
```

Each **juncture** has defined controls. See [Juncture Controls](./workflows/JUNCTURE-CONTROLS.md) for details.

---

## Navigation

| Document | Purpose |
|----------|---------|
| **[Juncture Controls](./workflows/JUNCTURE-CONTROLS.md)** | Controls at each stage: commit → PR → merge → deploy → monitor |
| **[AI Agent Prompts](./prompts/AI-AGENT-PROMPTS.md)** | 6 copy-paste prompts for audits, requirements, validation, live checks |
| [Deployment Guide](./DEPLOYMENT.md) | General deployment options (Vercel, Amplify, GCP) |
| [MANGU Production Deployment](./MANGU_PRODUCTION_DEPLOYMENT.md) | GCP Cloud Run flight manual |
| [AWS Amplify Deployment](./AWS_AMPLIFY_DEPLOYMENT.md) | Amplify-specific deployment |
| [Launch Checklist](./LAUNCH_CHECKLIST.md) | Pre/post-launch verification |
| [Development Guide](./DEVELOPMENT.md) | Local development setup |

---

## Standards Summary (Most Tools)

| Standard | Requirement |
|----------|-------------|
| **Branch protection** | `main` requires PR, passing CI, at least 1 approval |
| **CI pipeline** | Type-check, lint, unit tests on every PR |
| **Secrets** | No secrets in repo; use env vars / secrets manager |
| **Environment parity** | Staging mirrors production config (minus live keys) |
| **Health endpoint** | `/api/health` returns `{"status":"healthy"}` |
| **Rollback** | Documented rollback procedure; previous revision deployable |
| **Monitoring** | Logs, errors, and basic metrics visible post-deploy |

---

## MANGU-Specific Reality Check

| Control | Status | Notes |
|---------|--------|-------|
| Pre-commit hooks | ⚠️ Optional | `npm run validate-env` exists; consider husky/lint-staged |
| CI on PR | ✅ | `.github/workflows/ci.yml` runs type-check, lint, test |
| Branch protection | ⚠️ Configure in GitHub | Not enforced by repo alone |
| Deploy on merge | ✅ | Vercel/Amplify auto-deploy from `main` |
| Health check | ✅ | `/api/health` endpoint |
| Rollback | ✅ | Documented in MANGU Production Deployment |
| Secrets | ✅ | `.env.production` not committed; use platform secrets |

---

## Last Updated

- **Date:** 2025-02-17
- **Owner:** Platform team
- **Next review:** After next major deployment or incident
