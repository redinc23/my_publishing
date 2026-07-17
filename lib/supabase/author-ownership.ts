import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getAuthorForUser } from '@/lib/supabase/portal-queries';

/**
 * Resolve auth user → profile → author and confirm they own the book.
 * books.author_id is authors.id, never auth.users.id.
 */
export async function requireAuthorOwnedBook(userId: string, bookId: string) {
  const author = await getAuthorForUser(userId);
  if (!author) {
    throw new Error('Unauthorized');
  }

  const admin = createAdminClient();
  const { data: book, error } = await admin
    .from('books')
    .select('id, author_id')
    .eq('id', bookId)
    .maybeSingle();

  if (error) throw error;
  if (!book || book.author_id !== author.id) {
    throw new Error('Unauthorized');
  }

  return { author, book };
}
