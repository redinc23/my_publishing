/**
 * Stripe Checkout session API (Phoenix 2b.1.3).
 *
 * Dual-run:
 * - AUTH_PROVIDER for session identity
 * - DATABASE_PROVIDER for book lookup
 * Stripe session creation is unchanged.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiRequestUser } from '@/lib/api/request-user';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBookById, getBookBySlug } from '@/lib/mongo-queries';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/server';
import type { CheckoutSessionRequest, CheckoutSessionResponse } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    let body: CheckoutSessionRequest;
    try {
      body = (await request.json()) as CheckoutSessionRequest;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { book_id, book_slug, user_id } = body;

    if ((!book_id && !book_slug) || !user_id) {
      return NextResponse.json(
        { error: 'book_id (or book_slug) and user_id are required' },
        { status: 400 }
      );
    }

    const user = await getApiRequestUser();
    if (!user || user.id !== user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let bookId: string;
    let bookSlug: string;
    let bookTitle: string;
    let price: number;

    if (isMongoPrimary()) {
      const book = book_id
        ? await getBookById(book_id)
        : book_slug
          ? await getBookBySlug(book_slug)
          : null;

      if (!book) {
        return NextResponse.json({ error: 'Book not found' }, { status: 404 });
      }

      bookId = String(book._id);
      bookSlug = book.slug;
      bookTitle = book.title;
      price = book.price ?? 0;
    } else {
      const supabase = await createClient();
      let bookQuery = supabase.from('books').select('*');

      if (book_id) {
        bookQuery = bookQuery.eq('id', book_id);
      } else if (book_slug) {
        bookQuery = bookQuery.eq('slug', book_slug);
      }

      const { data: book, error: bookError } = await bookQuery.single();

      if (bookError || !book) {
        return NextResponse.json({ error: 'Book not found' }, { status: 404 });
      }

      bookId = book.id;
      bookSlug = book.slug;
      bookTitle = book.title;
      price = book.discount_price || book.price;
    }

    const session = await createCheckoutSession({
      bookId,
      bookSlug,
      userId: user_id,
      bookTitle,
      price,
    });

    const response: CheckoutSessionResponse = {
      sessionId: session.id,
      url: session.url || '',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
