# MCP Server

The app exposes its public APIs as a [Model Context Protocol](https://modelcontextprotocol.io) server, built with `mcp-handler` and served from the Next.js app itself.

## Endpoint

```
POST /api/mcp/mcp   (Streamable HTTP transport, stateless)
```

- Local dev: `http://localhost:3000/api/mcp/mcp`
- Production: `https://<your-domain>/api/mcp/mcp`

> The endpoint is **disabled by default** and returns `404` unless
> `MCP_ENABLED=true` — see the decision record below.

## Security & access control (P0-017 decision record)

**Decision (2026-07-20, issue #200 — implemented on the safest fail-closed
default, pending owner ratification):** the public MCP transport is a
non-launch surface, so it is **disabled by default; authenticated and
fail-closed rate-limited when explicitly enabled**. This combines the
"disable" and "auth+rate-limit" options from the Appendix F route matrix
(disable / auth+rate-limit / network-restrict): the endpoint stays off unless
an operator deliberately turns it on, and it can never be reachable
unauthenticated.

| State                                                          | Behavior                                                                                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `MCP_ENABLED` unset or not exactly `true` (default)            | `404 {"error":"not_found"}` — indistinguishable from a nonexistent route                                                                  |
| `MCP_ENABLED=true` but `MCP_API_KEY` not configured            | fail-closed `404` (misconfiguration can never open the endpoint)                                                                          |
| Enabled, request over the rate limit                           | `429 {"error":"rate_limited"}` + `Retry-After`; limiter errors/unavailability also reject (fail closed — see `lib/rate-limit.ts`, P0-011) |
| Enabled, missing/invalid `Authorization: Bearer <MCP_API_KEY>` | `401 {"error":"unauthorized"}` + `WWW-Authenticate: Bearer`                                                                               |
| Enabled, valid key, under the limit                            | request proceeds to the MCP handler                                                                                                       |

- Rate limiting uses the shared `api` bucket, keyed by client IP
  (`mcp:<ip>`), and runs **before** the auth check so Bearer-key brute force
  is capped too (CCR-007).
- Key comparison is constant-time (SHA-256 digests + `timingSafeEqual`), so
  neither the key length nor a matching prefix leaks via timing.
- All tools remain read-only over `published` + `public` rows. Data access goes
  through `lib/mcp/catalog.ts` (dual-run): Supabase anon + RLS by default, or the
  Phoenix Mongo query layer when `DATABASE_PROVIDER=mongodb`. Search input is
  sanitized against filter injection (`sanitizeSearchQuery`).
- Guard implementation: `lib/mcp/guard.ts` (`mcpGuard`), applied to all
  methods exported by `app/api/mcp/[transport]/route.ts`.

**Enabling (operator):** set `MCP_ENABLED=true` **and** a strong
`MCP_API_KEY` (e.g. `openssl rand -hex 32`) in the deployment environment,
then distribute the key only to trusted MCP clients.

**Rollback:** unset `MCP_ENABLED` (or set it to anything but `true`) — the
transport immediately returns `404`, no code revert needed. Reverting the
guarding commit removes the key requirement.

## Tools

| Tool              | Description                                                                   |
| ----------------- | ----------------------------------------------------------------------------- |
| `recommend_books` | Popularity / rating / recency ranking; optional genre or `similar_to_book_id` |
| `search_books`    | Text search over published book titles/descriptions                           |
| `get_book`        | Full details for a book by UUID or ObjectId (author + stats)                  |
| `list_genres`     | Distinct genres with counts                                                   |
| `health`          | API / DB connectivity + active catalog `provider`                             |

Server version: **1.1.0**. Catalog access defaults to Supabase (prod-safe);
set `DATABASE_PROVIDER=mongodb` only in non-prod / cutover environments.

## Client configuration

Already committed for this repo:

- **VS Code / Copilot**: `.vscode/mcp.json`
- **Cursor**: `.cursor/mcp.json`
- **Copilot CLI**: added to `~/.copilot/mcp-config.json`

Manual config for any other MCP client:

When the transport is enabled, clients must send the Bearer key:

```json
{
  "mcpServers": {
    "mangu-publishers": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp/mcp",
      "headers": { "Authorization": "Bearer <MCP_API_KEY>" }
    }
  }
}
```

## Adding tools

Edit `app/api/mcp/[transport]/route.ts` and register more tools with `server.tool(name, description, zodSchema, handler)`.
