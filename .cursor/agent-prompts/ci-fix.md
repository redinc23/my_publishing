# CI autofix — closed loop

Fix CI failures for **PR #{{PR_NUMBER}}** (`{{PR_TITLE}}`) on `{{REPO_FULL}}`.

## Strict rules

1. **Scope:** Fix only what is required to make the failing checks pass. Do not add features, refactors, or unrelated changes.
2. **Branch:** Push commits directly to `{{HEAD_REF}}`. Do **not** open a new pull request.
3. **Verify locally** before pushing (in order):
   - `npm run type-check`
   - `npm run lint`
   - `npm test`
   - `npm run build`
4. **Phoenix freeze:** No new product features. Migration parity only when the failure is in Phoenix work.
5. **Secrets:** If CI fails due to missing GitHub/Vercel secrets, stop and comment on the PR — do not invent credentials.

## Failure context

| Field | Value |
|-------|-------|
| Workflow | {{WORKFLOW_NAME}} |
| Run | {{WORKFLOW_URL}} |
| Commit | `{{HEAD_SHA}}` |
| Attempt | {{ATTEMPT}} of {{MAX_ATTEMPTS}} |

## Failed job logs (truncated)

```
{{FAILURE_LOGS}}
```

## Success criteria

Push a fix to `{{HEAD_REF}}`. GitHub Actions will re-run CI. When all required checks pass, `auto-merge.yml` squash-merges the PR automatically.

If you cannot fix the failure after a genuine attempt, comment on the PR with the blocker and stop.
