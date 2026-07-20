/**
 * MCP Server for Mangu Publishers
 * Exposes the app's public catalog as MCP tools at /api/mcp/mcp (Streamable HTTP).
 *
 * Security posture (P0-017, G7 — decision recorded in docs/MCP_SERVER.md):
 *  - DISABLED by default. The endpoint returns 404 unless `MCP_ENABLED=true`.
 *  - When enabled: fail-closed rate limit + Bearer MCP_API_KEY.
 *  - Read-only published catalog. Dual-run via lib/mcp/catalog.ts
 *    (DATABASE_PROVIDER=mongodb|supabase).
 */

import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { mcpGuard } from '@/lib/mcp/guard';
import {
  mcpGetBook,
  mcpHealth,
  mcpListGenres,
  mcpRecommendBooks,
  mcpSearchBooks,
} from '@/lib/mcp/catalog';

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'recommend_books',
      'Get book recommendations ranked by popularity and recency. Optionally filter by genre.',
      {
        limit: z.number().int().min(1).max(50).default(10),
        genre: z.string().optional(),
        // Accept UUID (Supabase) or ObjectId/string (Mongo) — keep tool name stable.
        exclude_book_ids: z.array(z.string().min(1)).optional(),
      },
      async ({ limit, genre, exclude_book_ids }) => {
        const books = await mcpRecommendBooks({ limit, genre, exclude_book_ids });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ books, total: books.length }, null, 2),
            },
          ],
        };
      }
    );

    server.tool(
      'search_books',
      'Search published books by title or description text.',
      {
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(10),
      },
      async ({ query, limit }) => {
        const data = await mcpSearchBooks({ query, limit });
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }
    );

    server.tool(
      'get_book',
      'Get full details for a single published book by ID, including author and stats.',
      // UUID or Mongo ObjectId hex / imported string id
      { book_id: z.string().min(1) },
      async ({ book_id }) => {
        const data = await mcpGetBook(book_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }
    );

    server.tool(
      'list_genres',
      'List distinct genres among published books with counts.',
      {},
      async () => {
        const counts = await mcpListGenres();
        return { content: [{ type: 'text' as const, text: JSON.stringify(counts, null, 2) }] };
      }
    );

    server.tool('health', 'Check API and database connectivity.', {}, async () => {
      const payload = await mcpHealth();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      };
    });
  },
  {
    serverInfo: { name: 'mangu-publishers', version: '1.1.0' },
  },
  {
    basePath: '/api/mcp',
    maxDuration: 60,
    verboseLogs: false,
  }
);

async function guarded(request: Request, ...rest: unknown[]): Promise<Response> {
  const blocked = await mcpGuard(request);
  if (blocked) return blocked;
  return (handler as (req: Request, ...args: unknown[]) => Promise<Response>)(request, ...rest);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
