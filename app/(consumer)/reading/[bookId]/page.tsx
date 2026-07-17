// PERF-PHASE2-6 — Server-first reading page
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
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

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  // PERF-PHASE2-6 — Parallel fetch book + progress on the server
  const [{ data: book }, { data: progress }] = await Promise.all([
    admin.from('books').select('*').eq('id', params.bookId).single(),
    profile
      ? admin
          .from('reading_progress')
          .select('*')
          .eq('user_id', profile.id)
          .eq('book_id', params.bookId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!book) {
    redirect('/books');
  }

  return (
    <ReadingClient book={book as Book} initialProgress={(progress as ReadingProgress) || null} />
  );
}
