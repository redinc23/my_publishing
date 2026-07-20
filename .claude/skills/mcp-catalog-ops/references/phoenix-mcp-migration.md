# Phoenix MCP Migration Notes

| Legacy (Supabase)                     | Phoenix (Mongo)                       |
| ------------------------------------- | ------------------------------------- |
| Anon client + RLS                     | `getDb()` queries filtered in code    |
| `books` + join `profiles` author      | `getBooks` / `$lookup` authors        |
| `book_stats_summary`                  | stats fields or aggregate equivalent  |
| `.or(title.ilike, description.ilike)` | `searchBooks` `$text` (keep sanitize) |
| genre distinct                        | Mongo aggregation `listGenreCounts`   |

## Compatibility rules

1. Keep tool names stable.
2. Keep input zod shapes stable (additive optional fields OK).
3. Prefer same JSON response envelopes.
4. Update smoke script expectations if field names change intentionally.
5. Remove `@supabase` from MCP route in WS4 window with the rest of the purge
   (catalog layer already dual-runs; route has zero direct `@supabase` imports).
6. Document any response field renames in `docs/MCP_SERVER.md`.

## Dual-run status (2026-07-20)

`lib/mcp/catalog.ts` switches on `DATABASE_PROVIDER`:

- **supabase** (default / prod today): anon client + RLS, published+public only
- **mongodb**: `getBooks` / `searchBooks` / `getBookById` / `listGenreCounts` with
  `status=published` + `visibility=public` enforced in query filters

Prod must stay on supabase until Phase 11–12 readiness. Local/preview can set
`DATABASE_PROVIDER=mongodb` to exercise the MCP Mongo path.
