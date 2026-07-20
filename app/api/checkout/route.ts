import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getRequestAuthUser } from '@/lib/auth/request-user';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBookById, getBookBySlug } from '@/lib/mongo-queries';
import { createCheckoutSession } from '@/lib/stripe/server';
import { createClient } from '@/lib/supabase/server';
import type { CheckoutSessionRequest, CheckoutSessionResponse } from '@/types';

export const dynamic = 'force-dynamic';

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

    const authUser = await getRequestAuthUser(request.headers);
    if (!authUser || authUser.id !== user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isMongoPrimary()) {
      const book = book_id
        ? await getBookById(book_id, { status: 'published' })
        : book_slug
          ? await getBookBySlug(book_slug, { status: 'published' })
          : null;

      if (!book) {
        return NextResponse.json({ error: 'Book not found' }, { status: 404 });
      }

      const bookId =
        book._id instanceof ObjectId ? book._id.toHexString() : String(book._id);
      const price = typeof book.price === 'number' ? book.price : 0;

      const session = await createCheckoutSession({
        bookId,
        bookSlug: book.slug,
        userId: user_id,
        bookTitle: book.title,
        price,
      });

      const response: CheckoutSessionResponse = {
        sessionId: session.id,
        url: session.url || '',
      };
      return NextResponse.json(response);
    }

    // Supabase path (production default)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const session = await createCheckoutSession({
      bookId: book.id,
      bookSlug: book.slug,
      userId: user_id,
      bookTitle: book.title,
      price: book.discount_price || book.price,
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
