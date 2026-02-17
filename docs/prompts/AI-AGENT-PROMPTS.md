# AI Agent Prompts: Standards & Controls

> 6 copy-paste prompts for audits, requirements, validation, and live checks.  
> **Example tool:** MANGU Platform (digital publishing).

---

## How to Use

Copy the prompt block into your AI assistant (Cursor, ChatGPT, Claude, etc.). Replace `[REPO_PATH]` or `[TOOL_NAME]` with your project path or tool name. Run the prompt against your codebase or deployment docs.

---

## Prompt 1: Pre-Commit Audit

**Use when:** Before committing; or when reviewing local changes.

```
You are auditing a codebase for pre-commit readiness. Use the standards in docs/STANDARDS_LIVING_DOCUMENT.md and docs/workflows/JUNCTURE-CONTROLS.md.

For the repo at [REPO_PATH] (or current workspace):

1. Check that no secrets (API keys, tokens, passwords) are in committed files.
2. Verify .gitignore excludes .env*, node_modules, build artifacts.
3. Confirm lint and type-check scripts exist and pass.
4. List any files that would fail a pre-commit gate (lint/type errors, secrets).
5. Recommend specific fixes.

Output: A concise audit report with PASS/FAIL per check and actionable fixes.
```

---

## Prompt 2: Requirements & Standards Compliance

**Use when:** Starting a new feature; or validating a PR against standards.

```
You are checking a project against deployment standards. Reference docs/STANDARDS_LIVING_DOCUMENT.md and docs/workflows/JUNCTURE-CONTROLS.md.

For [TOOL_NAME] (e.g. MANGU platform):

1. Does the project have a /api/health (or equivalent) endpoint returning {"status":"healthy"}?
2. Are environment variables documented (e.g. .env.example) and validated at startup?
3. Is there a CI workflow that runs type-check, lint, and tests on PR?
4. Are rollback procedures documented?
5. Are secrets excluded from the repo?

Output: A compliance matrix (Requirement | Status | Evidence) and gaps to address.
```

---

## Prompt 3: PR Validation (Pre-Merge)

**Use when:** Reviewing a PR before merge.

```
You are validating a pull request against deployment standards. Use docs/workflows/JUNCTURE-CONTROLS.md.

For the PR in this workspace:

1. Does the PR description explain what changed and why?
2. Are there any new dependencies? If so, are they justified and secure?
3. Are there database migrations? If so, are they reversible or documented?
4. Do the changes introduce new env vars? Are they documented?
5. Are there any obvious security issues (e.g. hardcoded secrets, unsafe user input)?
6. Does the change align with the Juncture Controls (commit → PR → merge)?

Output: A validation report with PASS/WARN/FAIL per item and recommended actions.
```

---

## Prompt 4: Deployment Readiness Validation

**Use when:** Before deploying to staging or production.

```
You are validating deployment readiness. Reference docs/LAUNCH_CHECKLIST.md and docs/workflows/JUNCTURE-CONTROLS.md.

For [TOOL_NAME] about to deploy:

1. List all required environment variables and confirm they are set (or documented as optional).
2. Verify database migrations are applied and in correct order.
3. Check that build succeeds (npm run build or equivalent).
4. Confirm health endpoint exists and returns healthy.
5. Verify Stripe/webhook/payment config if applicable.
6. Confirm rollback procedure is documented and executable.

Output: A deployment readiness checklist with status and blocking items.
```

---

## Prompt 5: Live Post-Deploy Check

**Use when:** Immediately after a deployment to verify it's healthy.

```
You are performing a live post-deploy verification. Use docs/LAUNCH_CHECKLIST.md "Post-Launch Verification" section.

For the deployed [TOOL_NAME] at [BASE_URL]:

1. Homepage loads without 500 errors.
2. /api/health returns 200 and {"status":"healthy"}.
3. Auth flows work (login, signup, logout).
4. Core user paths work (browse, search, checkout if applicable).
5. No critical errors in logs (if logs are accessible).

Create a script or curl commands to automate checks 1–2. For 3–5, provide a manual checklist.

Output: A verification script/commands and a checklist with PASS/FAIL.
```

---

## Prompt 6: Incident / Security Audit

**Use when:** After an incident; or for periodic security review.

```
You are conducting an incident or security audit. Reference docs/STANDARDS_LIVING_DOCUMENT.md and docs/workflows/JUNCTURE-CONTROLS.md.

For [TOOL_NAME]:

1. Trace the path from commit → PR → merge → deploy. Were all juncture controls followed?
2. Identify any gaps: missing branch protection, skipped tests, undocumented rollback.
3. Check for common security issues: exposed secrets, SQL injection, XSS, CSRF.
4. Verify RLS (Row Level Security) or equivalent is correctly applied to user data.
5. Recommend concrete improvements to prevent similar incidents.

Output: An audit report with timeline, root cause analysis, and prioritized remediation.
```

---

## Quick Reference

| Prompt | When to Use |
|--------|-------------|
| **1. Pre-Commit Audit** | Before `git commit` |
| **2. Requirements Compliance** | New feature start; PR validation |
| **3. PR Validation** | Before merging a PR |
| **4. Deployment Readiness** | Before deploy to staging/prod |
| **5. Live Post-Deploy Check** | Right after deployment |
| **6. Incident / Security Audit** | Post-incident; periodic review |

---

## Related Documents

- [Standards Living Document](../STANDARDS_LIVING_DOCUMENT.md)
- [Juncture Controls](../workflows/JUNCTURE-CONTROLS.md)
- [Launch Checklist](../LAUNCH_CHECKLIST.md)
