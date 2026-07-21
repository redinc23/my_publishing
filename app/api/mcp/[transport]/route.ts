/**
 * MCP Server for Mangu Publishers
 * Exposes the app's public catalog as MCP tools at /api/mcp/mcp (Streamable HTTP).
 *
 * Security posture (P0-017, G7 — decision recorded in docs/MCP_SERVER.md):
 *  - DISABLED by default. The endpoint returns 404 unless `MCP_ENABLED=true`,
 *    so this non-launch surface is never open unless explicitly turned on
 *    (least privilege / honest scope — CCR-008, CCR-018).
 *  - When enabled, every request is fail-closed rate limited (CCR-007) via the
 *    shared `api` bucket, keyed by client IP, and must present
 *    `Authorization: Bearer ${MCP_API_KEY}` (401 otherwise). If
 *    `MCP_ENABLED=true` but no key is configured, the endpoint fails closed
 *    as if disabled — it can never be open unauthenticated.
 *  - Read-only over published+public books only. User search text is sanitized
 *    before it reaches a PostgREST filter (no `.or()` injection).
 *  - Dual-run: DATABASE_PROVIDER=mongodb uses lib/mcp/catalog Mongo path;
 *    default remains Supabase anon + RLS.
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

/** Accepts Supabase UUIDs and Mongo ObjectId hex strings. */
const bookIdSchema = z.string().min(1).max(64);

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'recommend_books',
      'Get book recommendations ranked by popularity and recency. Optionally filter by genre.',
      {
        limit: z.number().int().min(1).max(50).default(10),
        genre: z.string().optional(),
        exclude_book_ids: z.array(bookIdSchema).optional(),
      },
      async ({ limit, genre, exclude_book_ids }) => {
        const result = await mcpRecommendBooks({ limit, genre, exclude_book_ids });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
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
      { book_id: bookIdSchema },
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
      const health = await mcpHealth();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(health, null, 2),
          },
        ],
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

// Apply the gate + rate-limit guard in front of the MCP handler, forwarding
// all Next.js route arguments (request, context) through unchanged.
async function guarded(request: Request, ...rest: unknown[]): Promise<Response> {
  const blocked = await mcpGuard(request);
  if (blocked) return blocked;
  return (handler as (req: Request, ...args: unknown[]) => Promise<Response>)(request, ...rest);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
