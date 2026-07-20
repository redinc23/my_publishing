/**
 * Book by id API (Phoenix 2b.1.2).
 *
 * Dual-run: DATABASE_PROVIDER=mongodb|supabase (default supabase).
 */

import { NextRequest, NextResponse } from 'next/server';
import { canMutateCatalog, getApiRequestUser } from '@/lib/api/request-user';
import { serializeMongo, slugifyTitle } from '@/lib/api/serialize-mongo';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBookById, updateBookById, type UpdateBookInput } from '@/lib/mongo-queries';
import { createClient } from '@/lib/supabase/server';
import type { BookStatus } from '@/types/mongo';

export const runtime = 'nodejs';

type RouteContext = { params: { id: string } };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (isMongoPrimary()) {
      const book = await getBookById(id);
      if (!book) {
        return NextResponse.json({ error: 'Book not found' }, { status: 404 });
      }
      return NextResponse.json(serializeMongo(book));
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('books')
      .select('*, author:profiles!books_author_id_fkey(id, full_name, avatar_url)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[api/books/:id] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type PatchBody = UpdateBookInput & { title?: string; slug?: string };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getApiRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canMutateCatalog(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = context.params;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const patch: UpdateBookInput = {};
    if (typeof body.title === 'string') patch.title = body.title.trim();
    if (typeof body.slug === 'string') patch.slug = body.slug.trim();
    else if (patch.title) patch.slug = slugifyTitle(patch.title);
    if (typeof body.description === 'string') patch.description = body.description;
    if (body.cover_url !== undefined) patch.cover_url = body.cover_url;
    if (body.manuscript_url !== undefined) patch.manuscript_url = body.manuscript_url;
    if (body.status) patch.status = body.status as BookStatus;
    if (body.visibility) patch.visibility = body.visibility;
    if (typeof body.price === 'number') patch.price = body.price;
    if (typeof body.currency === 'string') patch.currency = body.currency;
    if (typeof body.genre === 'string') patch.genre = body.genre;
    if (Array.isArray(body.tags)) patch.tags = body.tags;
    if (body.content_type) patch.content_type = body.content_type;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    if (isMongoPrimary()) {
      const existing = await getBookById(id);
      if (!existing) {
        return NextResponse.json({ error: 'Book not found' }, { status: 404 });
      }
      if (user.role !== 'admin' && String(existing.author_id) !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      try {
        const updated = await updateBookById(id, patch);
        if (!updated) {
          return NextResponse.json({ error: 'Book not found' }, { status: 404 });
        }
        return NextResponse.json(serializeMongo(updated));
      } catch (error) {
        const code = (error as { code?: number })?.code;
        if (code === 11000) {
          return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
        }
        throw error;
      }
    }

    const supabase = await createClient();
    const { data: existing, error: loadError } = await supabase
      .from('books')
      .select('id, author_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    if (user.role !== 'admin' && existing.author_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('books')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[api/books/:id] PATCH failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
