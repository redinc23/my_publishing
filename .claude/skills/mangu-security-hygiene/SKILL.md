---
name: mangu-security-hygiene
description: This skill should be used when reviewing secrets exposure, supabase reintroduction, MCP least privilege, manuscript authorization, dependency risk, or pre-commit security concerns for Mangu Publishers.
version: 1.0.0
---

# Security Hygiene

## Hard stops for agents

1. Never commit `.env*` with real values.
2. After WS4: `grep -ri "supabase" app/ lib/ components/ types/` must be 0 for code hits.
3. Never put service-role keys in MCP, client bundles, or logs.
4. Never write exploit PoCs / attack scripts against any system.
5. Manuscripts: enforce purchase/admin/owner checks on download route.
6. Auth: no password-hash migration shortcuts.

## Review prompts (use on Phoenix PRs)

- Are new API routes rate-limited or behind auth as appropriate?
- Any Edge code importing Node-only Mongo driver?
- Any `access: 'public'` Blob paths leaking sensitive manuscripts without app gate? (D8)
- Webhook signature verified?
- User-controlled strings sanitized before queries?

## References

- `references/post-ws4-grep.md`
- Pair with `mangu-env-and-secrets`, `mcp-catalog-ops`
