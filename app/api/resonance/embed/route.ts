import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/admin';
import { generateBookEmbedding } from '@/lib/resonance/embeddings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { book_id } = body;

    if (!book_id) {
      return NextResponse.json({ error: 'book_id is required' }, { status: 400 });
    }

    const supabase = createClient();

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const embedding = await generateBookEmbedding(book);

    const { error: updateError } = await supabase
      .from('resonance_vectors')
      .upsert({
        book_id,
        embedding: JSON.stringify(embedding),
        metadata: {
          title: book.title,
          genre: book.genre,
          updated_at: new Date().toISOString(),
        },
      });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
