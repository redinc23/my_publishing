---
name: mcp-catalog-authz
description: This skill should be used when adding authenticated MCP tools (library, purchases, drafts) to the Mangu catalog MCP server. Currently a STUB — activate only when product explicitly leaves read-only public catalog scope.
version: 0.0.1
status: stub
---

# MCP Catalog Authz (STUB)

**Status:** Not active. Public catalog MCP remains anonymous + read-only.

Before implementing authenticated tools:

1. Amend `docs/MCP_SERVER.md` + Phoenix/product docs (feature freeze may block).
2. Define authn mechanism (API key / session) compatible with MCP transport.
3. Define per-tool authorization matrix.
4. Add tests for 401/403 paths.
5. Bump this skill to 1.0.0 and remove stub status.
6. Security review required (`mangu-security-hygiene`).

Until then: refuse to add authenticated MCP tools under feature freeze.
