# MCP Tool Schemas

Mirror of `app/api/mcp/[transport]/route.ts`. Update when tools change.

## recommend_books

Inputs:

- `limit`: int 1–50, default 10
- `genre`: string optional
- `exclude_book_ids`: uuid[] optional

Output: JSON `{ books: Book[], total: number }` (text content).

## search_books

Inputs:

- `query`: string min 1 (sanitized server-side; empty after sanitize → `[]`)
- `limit`: int 1–50, default 10

Output: JSON array of book summaries.

## get_book

Inputs:

- `book_id`: uuid

Output: JSON book detail including author + stats, or error.

## list_genres

Inputs: none (or as implemented).

Output: genres with counts.

## health

Inputs: none.

Output: connectivity status for API/DB used by MCP.
