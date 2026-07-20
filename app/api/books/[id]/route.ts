/**
 * Book by id — Phoenix WS2b Task 2b.1.2
 *
 * GET   /api/books/[id]
 * PATCH /api/books/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBookById } from '@/lib/mongo-queries';
import { updateBookMongo } from '@/lib/mongo-books';
import { getRequestUser } from '@/lib/api/request-user';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const PatchBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  cover_url: z.string().url().optional().nullable(),
  manuscript_url: z.string().url().optional().nullable(),
  genre: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).optional(),
});

type RouteContext = { params: { id: string } };

async function rateLimited(request: NextRequest) {
  const result = await enforceRateLimit('api', getClientIdentifier(request));
  if (result.success) return null;
  return NextResponse.json(
    {
      error: result.reason === 'unavailable' ? 'Rate limiter unavailable' : 'Rate limit exceeded',
    },
    {
      status: result.reason === 'unavailable' ? 503 : 429,
      headers: result.headers,
    }
  );
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  const { id } = params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  try {
    if (isMongoPrimary()) {
      const book = await getBookById(id);
      if (!book) {
        return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, provider: 'mongodb', book });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('books')
      .select(PUBLIC_BOOK_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, provider: 'supabase', book: data });
  } catch (error) {
    console.error('[api/books/[id] GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' },
      { status: 400 }
    );
  }

  try {
    if (isMongoPrimary()) {
      const existing = await getBookById(id);
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
      }
      const ownerId = String(existing.author_id);
      if (user.role !== 'admin' && ownerId !== user.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const result = await updateBookMongo(id, parsed.data);
      if ('error' in result) {
        const status =
          result.code === 'NOT_FOUND' ? 404 : result.code === 'DUPLICATE_SLUG' ? 409 : 400;
        return NextResponse.json(
          { success: false, error: result.error, code: result.code },
          { status }
        );
      }
      return NextResponse.json({ success: true, provider: 'mongodb', book: result.book });
    }

    const supabase = await createClient();
    const { data: existing, error: findError } = await supabase
      .from('books')
      .select('id, author_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ success: false, error: findError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }
    if (user.role !== 'admin' && existing.author_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('books')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const status = error.code === '23505' ? 409 : 500;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }

    return NextResponse.json({ success: true, provider: 'supabase', book: data });
  } catch (error) {
    console.error('[api/books/[id] PATCH]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
