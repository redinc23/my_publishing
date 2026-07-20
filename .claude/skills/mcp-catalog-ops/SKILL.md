---
name: mcp-catalog-ops
description: This skill should be used when the user asks about the Mangu MCP server, /api/mcp, MCP_ENABLED, recommend_books, search_books, get_book, list_genres, MCP health tool, mcp-handler, catalog MCP clients, or migrating MCP off Supabase onto Mongo.
version: 1.1.0
---

# MCP Catalog Ops

In-app Model Context Protocol server exposing the **public catalog** only.

## Endpoint

- Transport: Streamable HTTP via `mcp-handler`
- Path: `POST /api/mcp/mcp` (see `app/api/mcp/[transport]/route.ts`)
- Catalog data: `lib/mcp/catalog.ts` (dual-run Supabase / Mongo)
- Local: `http://localhost:3000/api/mcp/mcp`
- Prod: `https://www.mangu-publishers.com/api/mcp/mcp` (only if enabled)

Client configs: `.cursor/mcp.json`, `.vscode/mcp.json`, `docs/MCP_SERVER.md`.

## Safety defaults (non-negotiable)

1. **Disabled by default.** Without `MCP_ENABLED=true`, respond **404**.
2. Every enabled request passes `mcpGuard` (rate limit, fail-closed).
3. Read-only published + public books only. No manuscripts, no PII, no service-role.
4. Sanitize search text (`sanitizeSearchQuery` in `lib/mcp/guard.ts`) before filters.
5. Do not add mutating tools without activating `mcp-catalog-write` skill + security review.
6. Do not add authenticated user tools without `mcp-catalog-authz` skill.

## Tool catalog

| Tool              | Purpose                                                 |
| ----------------- | ------------------------------------------------------- |
| `recommend_books` | Popularity/rating/recency; optional genre or similar_to |
| `search_books`    | Title/description search (sanitized)                    |
| `get_book`        | Full details by book UUID or ObjectId                   |
| `list_genres`     | Distinct genres + counts                                |
| `health`          | API + DB connectivity (+ provider)                      |

Schemas and examples: `references/tool-schemas.md`.
Security notes: `references/security-posture.md`.

## Phoenix migration of MCP

Handlers use `lib/mcp/catalog.ts`. Target path (Mongo) is live behind
`DATABASE_PROVIDER=mongodb` using `getBooks` / `searchBooks` / `getBookById` /
`listGenreCounts`. Prod stays on Supabase until cutover.

Checklist: `references/phoenix-mcp-migration.md`.

## Operating procedures

### Enable locally

```bash
# in .env.local
MCP_ENABLED=true
npm run dev
# then
./.claude/skills/mcp-catalog-ops/scripts/mcp-smoke.sh http://localhost:3000
```

### After deploy

1. Confirm intended `MCP_ENABLED` value in Vercel env (human).
2. Run smoke script against target base URL.
3. On unexpected 404: check flag. On 429: check Upstash / burst. On empty data: DB/query layer.

### Adding a tool

1. Define zod schema + description in route.
2. Enforce published+public (or stricter) in handler.
3. Add unit tests + update `docs/MCP_SERVER.md` + `references/tool-schemas.md`.
4. Run smoke script.
5. Bump this skill `version`.

## Scripts

- `scripts/mcp-smoke.sh` — health + basic tool round-trip notes
- `scripts/mcp-load-check.sh` — burst expect 429 guidance
