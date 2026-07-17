import { NextRequest, NextResponse } from 'next/server';
import { createPublicCatalogClient, PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get('book_id');
    const limit = parseInt(searchParams.get('limit') || '6');

    if (!bookId) {
      return NextResponse.json({ error: 'book_id is required' }, { status: 400 });
    }

    if (!UUID_PATTERN.test(bookId)) {
      return NextResponse.json({ error: 'Invalid book_id' }, { status: 400 });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'limit must be an integer between 1 and 50' },
        { status: 400 }
      );
    }

    const supabase = createPublicCatalogClient();

    // Get the book's genre
    const { data: book } = await supabase
      .from('books')
      .select('genre')
      .eq('id', bookId)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .single();

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Find similar books by genre
    const { data: similarBooks, error } = await supabase
      .from('books')
      .select(PUBLIC_BOOK_SELECT)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .eq('genre', book.genre)
      .neq('id', bookId)
      .order('total_reads', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Resonance Similar] Failed to load similar books:', error);
      return NextResponse.json({ error: 'Failed to load similar books' }, { status: 500 });
    }

    return NextResponse.json({ data: similarBooks || [] });
  } catch (error) {
    console.error('[Resonance Similar] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
