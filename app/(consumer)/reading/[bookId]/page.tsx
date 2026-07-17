// PERF-PHASE2-6 — Server-first reading page
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { hasCompletedOrderForBook } from '@/lib/reading/entitlement';
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

  if (!profile) {
    redirect('/books');
  }

  const { data: book } = await admin.from('books').select('*').eq('id', params.bookId).maybeSingle();

  if (!book) {
    redirect('/books');
  }

  // Fail closed: private/draft and unpaid titles require a completed-order entitlement.
  // Product flow does not grant free/public catalog access without purchase.
  const entitled = await hasCompletedOrderForBook(admin, profile.id, params.bookId);
  if (!entitled) {
    redirect(book.slug ? `/books/${book.slug}` : '/library');
  }

  const { data: progress } = await admin
    .from('reading_progress')
    .select('*')
    .eq('user_id', profile.id)
    .eq('book_id', params.bookId)
    .maybeSingle();

  return (
    <ReadingClient book={book as Book} initialProgress={(progress as ReadingProgress) || null} />
  );
}
