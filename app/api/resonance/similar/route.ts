import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get('book_id');
    const limit = parseInt(searchParams.get('limit') || '6');

    if (!bookId) {
      return NextResponse.json({ error: 'book_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get the book's genre
    const { data: book } = await supabase
      .from('books')
      .select('genre')
      .eq('id', bookId)
      .single();

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Find similar books by genre
    const { data: similarBooks, error } = await supabase
      .from('books')
      .select('*, author:authors!inner(*, profile:profiles!inner(*))')
      .eq('status', 'published')
      .eq('genre', book.genre)
      .neq('id', bookId)
      .order('total_reads', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: similarBooks || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
