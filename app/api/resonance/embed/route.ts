// PERF-PHASE2-7
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { generateBookEmbedding } from '@/lib/resonance/embeddings';
import { revalidateResonance } from '@/lib/supabase/queries';

export async function POST(request: NextRequest) {
  try {
    let body: { book_id?: string };
    try {
      body = (await request.json()) as { book_id?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { book_id } = body;

    if (!book_id) {
      return NextResponse.json({ error: 'book_id is required' }, { status: 400 });
    }

    const authClient = await createServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await authClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createAdminClient();

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const embedding = await generateBookEmbedding(book);

    const { error: updateError } = await supabase.from('resonance_vectors').upsert(
      {
        book_id,
        embedding: JSON.stringify(embedding),
        metadata: {
          title: book.title,
          genre: book.genre,
          updated_at: new Date().toISOString(),
        },
      },
      { onConflict: 'book_id' }
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    revalidateResonance(); // PERF-PHASE2-7
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
