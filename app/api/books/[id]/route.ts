/**
 * Books API — get + patch by id (Phoenix WS2b Task 2b.1.2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canAdminBooks, canMutateBooks, getApiUser } from '@/lib/api/request-user';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBookById, updateBook } from '@/lib/mongo-queries';
import { serializeMongoDoc } from '@/lib/mongo-serialize';
import { createClient } from '@/lib/supabase/server';
import { createPublicCatalogClient, PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';

export const dynamic = 'force-dynamic';

const PatchBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  cover_url: z.string().url().optional().nullable(),
  manuscript_url: z.string().url().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  genre: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

type RouteContext = { params: { id: string } };

async function resolveId(context: RouteContext): Promise<string> {
  return context.params.id;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }

    if (isMongoPrimary()) {
      const book = await getBookById(id);
      if (!book) {
        return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, book: serializeMongoDoc(book) });
    }

    const supabase = createPublicCatalogClient();
    const { data: book, error } = await supabase
      .from('books')
      .select(PUBLIC_BOOK_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[api/books/[id]] supabase get failed:', error);
      return NextResponse.json({ success: false, error: 'Failed to load book' }, { status: 500 });
    }
    if (!book) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, book });
  } catch (error) {
    console.error('[api/books/[id]] GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getApiUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canMutateBooks(user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const id = await resolveId(context);
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
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
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body' },
        { status: 400 }
      );
    }

    if (isMongoPrimary()) {
      const existing = await getBookById(id);
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
      }
      const ownerId = String(existing.author_id);
      if (!canAdminBooks(user) && ownerId !== user.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const book = await updateBook(id, parsed.data);
      if (!book) {
        return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, book: serializeMongoDoc(book) });
    }

    const supabase = await createClient();
    const { data: existing, error: loadError } = await supabase
      .from('books')
      .select('id, author_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ success: false, error: 'Failed to load book' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }
    if (!canAdminBooks(user) && existing.author_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: book, error } = await supabase
      .from('books')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(PUBLIC_BOOK_SELECT)
      .single();

    if (error) {
      const status = error.code === '23505' ? 409 : 500;
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to update book' },
        { status }
      );
    }

    return NextResponse.json({ success: true, book });
  } catch (error) {
    console.error('[api/books/[id]] PATCH error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const conflict = /duplicate|E11000/i.test(message);
    return NextResponse.json(
      { success: false, error: conflict ? 'Slug already exists' : 'Internal server error' },
      { status: conflict ? 409 : 500 }
    );
  }
}
