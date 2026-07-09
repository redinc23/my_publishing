// PERF-PHASE2-6 — Server-first reading page
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReadingClient from './ReadingClient';
import type { Book, ReadingProgress } from '@/types';

export default async function ReadingPage({ params }: { params: { bookId: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // PERF-PHASE2-6 — Parallel fetch book + progress on the server
  const [{ data: book }, { data: progress }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).single(),
    supabase
      .from('reading_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('book_id', params.bookId)
      .single(),
  ]);

  if (!book) {
    redirect('/books');
  }

  return (
    <ReadingClient book={book as Book} initialProgress={(progress as ReadingProgress) || null} />
  );
}
