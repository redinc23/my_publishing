# MCP Tool Schemas

Mirror of `app/api/mcp/[transport]/route.ts` + `lib/mcp/catalog.ts`. Update when tools change.

Book IDs accept legacy UUIDs **or** 24-char Mongo ObjectId hex (dual-run).

## recommend_books

Inputs:

- `limit`: int 1–50, default 10
- `genre`: string optional
- `exclude_book_ids`: book-id[] optional
- `similar_to_book_id`: book-id optional (additive) — prefer same genre as seed

Output: JSON `{ books: Book[], total: number }` (text content).
Ranking uses views/purchases (when present), avg_rating, review_count, and recency.

## search_books

Inputs:

- `query`: string min 1 (sanitized server-side; empty after sanitize → `[]`)
- `limit`: int 1–50, default 10

Output: JSON array of book summaries.

## get_book

Inputs:

- `book_id`: UUID or ObjectId hex

Output: JSON book detail including author + stats, or error.

## list_genres

Inputs: none (or as implemented).

Output: genres with counts.

## health

Inputs: none.

Output: `{ status, db, provider }` where `provider` is `supabase` | `mongodb`.
