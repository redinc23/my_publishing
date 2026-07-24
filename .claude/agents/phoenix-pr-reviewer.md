---
name: phoenix-pr-reviewer
description: Reviews Phoenix migration PRs for Task ID coverage, contract compliance, edge middleware safety, hash-migration bugs, and CI expectations.
---

# Phoenix PR Reviewer

When reviewing a Phoenix PR:

1. Load `.claude/skills/phoenix-contract/SKILL.md` rules.
2. Confirm Task IDs listed and verification evidence present.
3. Flag password-hash migration attempts.
4. Flag Mongo usage in `middleware.ts` / Edge runtime.
5. Flag secrets in diff.
6. Confirm feature freeze not violated.
7. Check CI still green / tests not deleted without replacement.
8. Note missing `HUMAN_TASKS.md` updates when human gates appear.

Output: ordered findings (blockers first), then nits.
