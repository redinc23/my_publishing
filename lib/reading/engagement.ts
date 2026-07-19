/**
 * Reader Engagement — shared server helpers + row types for the
 * bookmarks / highlights / wishlist / author-follows API routes.
 *
 * Graceful-degradation contract: when the reader_engagement migration has
 * not been applied yet (missing tables), helpers surface a recognizable
 * result so routes return 503 and pages render empty states — never crash.
 */

import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import type { HighlightColor } from '@/lib/validations/reader-engagement';

// ── Row types (mirror supabase/migrations/20260719140000_reader_engagement.sql)

export interface BookmarkRow {
  id: string;
  user_id: string;
  book_id: string;
  position: string;
  label: string | null;
  created_at: string;
}

export interface HighlightRow {
  id: string;
  user_id: string;
  book_id: string;
  selected_text: string;
  position: string | null;
  color: HighlightColor;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface WishlistRow {
  id: string;
  user_id: string;
  book_id: string;
  created_at: string;
}

export interface AuthorFollowRow {
  id: string;
  user_id: string;
  author_id: string;
  created_at: string;
}

// ── Rate limiting ────────────────────────────────────────────────────────────

/**
 * Enforce the shared 'api' bucket for this request.
 * Returns null when the request may proceed, otherwise a ready Response.
 */
export async function guardRateLimit(request: Request): Promise<NextResponse | null> {
  const result = await enforceRateLimit('api', getClientIdentifier(request));
  if (result.success) return null;

  return NextResponse.json(
    {
      error:
        result.reason === 'unavailable'
          ? 'Rate limiter unavailable. Please try again shortly.'
          : 'Rate limit exceeded. Please slow down.',
    },
    { status: result.reason === 'unavailable' ? 503 : 429, headers: result.headers }
  );
}

// ── Auth ─────────────────────────────────────────────────────────────────────

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export interface AuthedContext {
  supabase: ServerSupabase;
  user: { id: string };
}

/**
 * Require an authenticated user. Returns either the authed context or a
 * 401 response to send back.
 */
export async function requireAuth(): Promise<
  { ctx: AuthedContext; response?: never } | { ctx?: never; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { ctx: { supabase, user: { id: user.id } } };
}

// ── Body parsing ─────────────────────────────────────────────────────────────

/**
 * Parse + validate a JSON body against a zod schema.
 * Returns { data } or a 400 response.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; response?: never } | { data?: never; response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      ),
    };
  }
  return { data: parsed.data };
}

/** Validate URL search params against a zod schema. */
export function parseQuery<T>(
  request: Request,
  schema: ZodSchema<T>
): { data: T; response?: never } | { data?: never; response: NextResponse } {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid query parameters' },
        { status: 400 }
      ),
    };
  }
  return { data: parsed.data };
}

// ── Graceful degradation ─────────────────────────────────────────────────────

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/**
 * True when the error means "reader engagement tables don't exist yet"
 * (migration not applied): Postgres 42P01 (undefined_table) or PostgREST
 * schema-cache miss (PGRST205 / "could not find the table").
 */
export function isMissingEngagementTable(error: PostgrestLikeError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = (error.message || '').toLowerCase();
  return message.includes('does not exist') || message.includes('could not find the table');
}

/** Standard 503 for missing-migration state. */
export function migrationMissingResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Reader engagement is not available yet.', code: 'engagement_unavailable' },
    { status: 503 }
  );
}
