/**
 * Book resource API (Phoenix WS2b Task 2b.1.2).
 *
 * GET   — fetch by id
 * PATCH — update fields (authenticated owner/admin)
 *
 * Dual-run behind DATABASE_PROVIDER (default supabase).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/api/request-auth';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBookById, updateBook, type UpdateBookPatch } from '@/lib/mongo-queries';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { BookStatus } from '@/types/mongo';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> } | { params: { id: string } };

async function resolveId(context: RouteContext): Promise<string> {
  const params = await Promise.resolve(context.params);
  return params.id;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = await resolveId(context);
  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  try {
    if (isMongoPrimary()) {
      const book = await getBookById(id);
      if (!book) {
        return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, book });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('books')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, book: data });
  } catch (error) {
    console.error('[api/books/[id] GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = await resolveId(context);
  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: UpdateBookPatch & { status?: BookStatus };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const allowed: (keyof UpdateBookPatch)[] = [
      'title',
      'slug',
      'description',
      'cover_url',
      'manuscript_url',
      'status',
      'visibility',
      'price',
      'discount_price',
      'currency',
      'genre',
      'tags',
      'content_type',
      'published_at',
    ];
    const patch: UpdateBookPatch = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (patch as any)[key] = body[key];
      }
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    if (isMongoPrimary()) {
      const existing = await getBookById(id);
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
      }
      const isOwner = String(existing.author_id) === user.id;
      const isAdmin = user.role === 'admin';
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      const ok = await updateBook(id, patch);
      if (!ok) {
        return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
      }
      const book = await getBookById(id);
      return NextResponse.json({ success: true, book });
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
    if (existing.author_id !== user.id && user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('books')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Failed to update book' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, book: data });
  } catch (error) {
    console.error('[api/books/[id] PATCH]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
