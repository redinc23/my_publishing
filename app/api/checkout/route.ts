import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/server';
import type { CheckoutSessionRequest, CheckoutSessionResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutSessionRequest = await request.json();
    const { book_id, book_slug, user_id } = body;

    if ((!book_id && !book_slug) || !user_id) {
      return NextResponse.json(
        { error: 'book_id (or book_slug) and user_id are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get book details
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

    // Create Stripe checkout session
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
