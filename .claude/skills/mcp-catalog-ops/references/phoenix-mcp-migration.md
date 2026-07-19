# Phoenix MCP Migration Notes

| Legacy (Supabase)                     | Phoenix (Mongo)                       |
| ------------------------------------- | ------------------------------------- |
| Anon client + RLS                     | `getDb()` queries filtered in code    |
| `books` + join `profiles` author      | `getBooks` / `$lookup` authors        |
| `book_stats_summary`                  | stats fields or aggregate equivalent  |
| `.or(title.ilike, description.ilike)` | `searchBooks` `$text` (keep sanitize) |
| genre distinct                        | Mongo aggregation `list_genres`       |

## Compatibility rules

1. Keep tool names stable.
2. Keep input zod shapes stable (additive optional fields OK).
3. Prefer same JSON response envelopes.
4. Update smoke script expectations if field names change intentionally.
5. Remove `@supabase` from MCP route in WS4 window with the rest of the purge.
6. Document any response field renames in `docs/MCP_SERVER.md`.
