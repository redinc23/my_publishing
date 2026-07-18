/**
 * MCP Server for Mangu Publishers
 * Exposes the app's public catalog as MCP tools at /api/mcp/mcp (Streamable HTTP).
 *
 * Security posture (P0-017, G7):
 *  - DISABLED by default. The endpoint returns 404 unless `MCP_ENABLED=true`,
 *    so this non-launch surface is never open unless explicitly turned on
 *    (least privilege / honest scope — CCR-008, CCR-018).
 *  - When enabled, every request is fail-closed rate limited (CCR-007) via the
 *    shared `api` bucket, keyed by client IP.
 *  - Read-only over published+public books only (anon key + RLS). User search
 *    text is sanitized before it reaches a PostgREST filter (no `.or()`
 *    injection).
 */

import { createMcpHandler } from 'mcp-handler';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

/** MCP is off unless explicitly enabled — read per-request so it's togglable. */
export function isMcpEnabled(): boolean {
  return process.env.MCP_ENABLED === 'true';
}

/**
 * Strip characters that are significant in the PostgREST filter grammar so
 * user-supplied search text cannot break out of an `ilike` pattern or inject
 * additional `.or()` conditions. Also caps length.
 */
export function sanitizeSearchQuery(input: string): string {
  return input
    .replace(/[,()%*\\:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/**
 * Gate + rate-limit guard applied before the MCP handler runs. Returns a
 * Response to short-circuit (404 disabled / 429 limited), or null to proceed.
 */
export async function mcpGuard(request: Request): Promise<Response | null> {
  if (!isMcpEnabled()) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await enforceRateLimit('api', `mcp:${getClientIdentifier(request)}`);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'rate_limited', reason: result.reason }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...result.headers },
    });
  }

  return null;
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'recommend_books',
      'Get book recommendations ranked by popularity and recency. Optionally filter by genre.',
      {
        limit: z.number().int().min(1).max(50).default(10),
        genre: z.string().optional(),
        exclude_book_ids: z.array(z.string().uuid()).optional(),
      },
      async ({ limit, genre, exclude_book_ids }) => {
        let query = supabase()
          .from('books')
          .select(
            `*, author:profiles!books_author_id_fkey(id, full_name, avatar_url),
             stats:book_stats_summary(total_views, total_purchases, total_revenue)`
          )
          .eq('status', 'published')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (genre) query = query.eq('genre', genre);
        if (exclude_book_ids?.length) {
          query = query.not('id', 'in', `(${exclude_book_ids.join(',')})`);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Query failed: ${error.message}`);

        const scored = (data || [])
          .map((book) => {
            const recencyDays = Math.floor(
              (Date.now() - new Date(book.created_at).getTime()) / 86_400_000
            );
            const score =
              (book.stats?.total_views || 0) +
              (book.stats?.total_purchases || 0) * 10 +
              Math.max(0, 30 - recencyDays) * 5;
            return { ...book, _score: score };
          })
          .sort((a, b) => b._score - a._score)
          .map(({ _score, ...book }) => book);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ books: scored, total: scored.length }, null, 2),
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
        const safe = sanitizeSearchQuery(query);
        if (!safe) {
          return { content: [{ type: 'text' as const, text: JSON.stringify([], null, 2) }] };
        }
        const { data, error } = await supabase()
          .from('books')
          .select(
            'id, title, description, genre, created_at, author:profiles!books_author_id_fkey(id, full_name)'
          )
          .eq('status', 'published')
          .eq('visibility', 'public')
          .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
          .limit(limit);
        if (error) throw new Error(`Search failed: ${error.message}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }
    );

    server.tool(
      'get_book',
      'Get full details for a single published book by ID, including author and stats.',
      { book_id: z.string().uuid() },
      async ({ book_id }) => {
        const { data, error } = await supabase()
          .from('books')
          .select(
            `*, author:profiles!books_author_id_fkey(id, full_name, avatar_url),
             stats:book_stats_summary(total_views, total_purchases, total_revenue)`
          )
          .eq('id', book_id)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .single();
        if (error) throw new Error(`Book not found: ${error.message}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }
    );

    server.tool(
      'list_genres',
      'List distinct genres among published books with counts.',
      {},
      async () => {
        const { data, error } = await supabase()
          .from('books')
          .select('genre')
          .eq('status', 'published')
          .eq('visibility', 'public');
        if (error) throw new Error(`Query failed: ${error.message}`);
        const counts: Record<string, number> = {};
        for (const row of data || []) {
          if (row.genre) counts[row.genre] = (counts[row.genre] || 0) + 1;
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(counts, null, 2) }] };
      }
    );

    server.tool('health', 'Check API and database connectivity.', {}, async () => {
      const { error } = await supabase().from('books').select('id').limit(1);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              status: error ? 'degraded' : 'ok',
              db: error ? error.message : 'connected',
            }),
          },
        ],
      };
    });
  },
  {
    serverInfo: { name: 'mangu-publishers', version: '1.0.0' },
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
