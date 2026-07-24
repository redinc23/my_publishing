import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, getRateLimitIdentity } from '@/lib/rate-limit';
import type { HighlightColor } from '@/lib/validations/reader-engagement';

export interface BookmarkRow {
  id: string;
  user_id: string;
  book_id: string;
  position: string;
  label: string | null;
  created_at: string;
  updated_at?: string;
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
  updated_at?: string;
}

export interface WishlistRow {
  id: string;
  user_id: string;
  book_id: string;
  created_at: string;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface EngagementContext {
  supabase: SupabaseServerClient;
  user: User;
}

type AuthResult =
  | { ctx: EngagementContext; response: null }
  | { ctx: null; response: NextResponse };

type ParseResult<T> = { data: T; response: null } | { data: null; response: NextResponse };

function validationResponse(error: z.ZodError): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid request',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    { status: 400 }
  );
}

/** Shared fail-closed API rate-limit guard for engagement endpoints. */
export async function guardRateLimit(request: Request): Promise<NextResponse | null> {
  const result = await enforceRateLimit('api', getRateLimitIdentity(request));
  if (result.success) return null;

  return NextResponse.json(
    {
      error:
        result.reason === 'unavailable'
          ? 'Rate limiter unavailable. Please try again shortly.'
          : 'Too many requests. Please try again later.',
    },
    {
      status: result.reason === 'unavailable' ? 503 : 429,
      headers: result.headers,
    }
  );
}

/** Authenticate once and return the matching cookie-scoped Supabase client. */
export async function requireAuth(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      if (error) console.warn('[engagement] auth lookup failed:', error.message);
      return {
        ctx: null,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    return { ctx: { supabase, user }, response: null };
  } catch (error) {
    console.error('[engagement] auth lookup failed:', error);
    return {
      ctx: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
}

/** Parse and validate a JSON request body without throwing into the route. */
export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<ParseResult<z.infer<TSchema>>> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return {
      data: null,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { data: null, response: validationResponse(parsed.error) };
  return { data: parsed.data, response: null };
}

/** Parse query parameters into a strict Zod schema. */
export function parseQuery<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema
): ParseResult<z.infer<TSchema>> {
  const input = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { data: null, response: validationResponse(parsed.error) };
  return { data: parsed.data, response: null };
}

/** Detect Postgres/PostgREST errors produced before engagement migrations land. */
export function isMissingEngagementTable(
  error: {
    code?: string;
    message?: string;
  } | null
): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist|schema cache|could not find the table/i.test(error.message ?? '')
  );
}

export function migrationMissingResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        'Reader engagement is temporarily unavailable while its database migration is applied.',
      code: 'ENGAGEMENT_MIGRATION_REQUIRED',
    },
    { status: 503 }
  );
}
