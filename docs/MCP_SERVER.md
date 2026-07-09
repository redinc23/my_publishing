# MCP Server

The app exposes its public APIs as a [Model Context Protocol](https://modelcontextprotocol.io) server, built with `mcp-handler` and served from the Next.js app itself.

## Endpoint

```
POST /api/mcp/mcp   (Streamable HTTP transport, stateless)
```

- Local dev: `http://localhost:3000/api/mcp/mcp`
- Production: `https://<your-domain>/api/mcp/mcp`

## Tools

| Tool              | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `recommend_books` | Popularity/recency-ranked recommendations, optional genre filter |
| `search_books`    | Text search over published book titles/descriptions              |
| `get_book`        | Full details for a book by ID (author + stats)                   |
| `list_genres`     | Distinct genres with counts                                      |
| `health`          | API and DB connectivity check                                    |

All tools use the Supabase anon key, so only `published` + `public` data is exposed (RLS enforced).

## Client configuration

Already committed for this repo:

- **VS Code / Copilot**: `.vscode/mcp.json`
- **Cursor**: `.cursor/mcp.json`
- **Copilot CLI**: added to `~/.copilot/mcp-config.json`

Manual config for any other MCP client:

```json
{
  "mcpServers": {
    "mangu-publishers": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp/mcp"
    }
  }
}
```

## Adding tools

Edit `app/api/mcp/[transport]/route.ts` and register more tools with `server.tool(name, description, zodSchema, handler)`.
