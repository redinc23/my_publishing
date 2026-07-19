/**
 * Reader Engagement — shared server helpers for the bookmarks / highlights /
 * wishlist / follows API routes.
 *
 * Centralises: rate limiting, auth context (user-scoped Supabase client),
 * JSON/query parsing with Zod, and the "migration not applied → 503" contract
 * that lets clients degrade gracefully before the engagement tables exist.
 */

import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

// ---------------------------------------------------------------------------
// Types mirroring migration 20260719140000_reader_engagement.sql
// ---------------------------------------------------------------------------

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
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
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

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/** Fail-closed rate limit; returns a ready response when limited, else null. */
export async function guardRateLimit(request: Request): Promise<NextResponse | null> {
  const result = await enforceRateLimit('api', getClientIdentifier(request));
  if (result.success) return null;
  return NextResponse.json(
    {
      error:
        result.reason === 'unavailable'
          ? 'Service temporarily unavailable. Please try again shortly.'
          : 'Rate limit exceeded. Please slow down.',
    },
    { status: result.reason === 'unavailable' ? 503 : 429, headers: result.headers }
  );
}

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

export interface AuthContext {
  /** RLS-scoped client — table policies enforce per-user isolation. */
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
}

/**
 * Require a signed-in user. On success returns the user-scoped client;
 * on failure returns a ready 401 response.
 */
export async function requireAuth(): Promise<
  { ctx: AuthContext; response: null } | { ctx: null; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ctx: null,
      response: NextResponse.json(
        { error: 'You must be signed in to use this feature.' },
        { status: 401 }
      ),
    };
  }

  return { ctx: { supabase, user: { id: user.id } }, response: null };
}

// ---------------------------------------------------------------------------
// Body / query parsing
// ---------------------------------------------------------------------------

function firstZodMessage(error: ZodError): string {
  return error.errors[0]?.message ?? 'Invalid request';
}

/** Parse + validate a JSON body. On failure returns a 400 response. */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; response: null } | { data: null; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      data: null,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      data: null,
      response: NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 }),
    };
  }
  return { data: parsed.data, response: null };
}

/** Parse + validate URL search params against a Zod object schema. */
export function parseQuery<T>(
  request: Request,
  schema: ZodSchema<T>
): { data: T; response: null } | { data: null; response: NextResponse } {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return {
      data: null,
      response: NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 }),
    };
  }
  return { data: parsed.data, response: null };
}

// ---------------------------------------------------------------------------
// Missing-migration contract
// ---------------------------------------------------------------------------

/** True when a PostgREST/Postgres error means the engagement table is missing. */
export function isMissingEngagementTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    /does not exist|schema cache|could not find the table/i.test(error.message ?? '')
  );
}

/**
 * Uniform 503 for "migration 20260719140000 not applied yet". Clients treat
 * this as 'feature unavailable' and degrade quietly.
 */
export function migrationMissingResponse(): NextResponse {
  return NextResponse.json(
    { error: 'reader-engagement-unavailable', message: 'This feature is not available yet.' },
    { status: 503 }
  );
}
