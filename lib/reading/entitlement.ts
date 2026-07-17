import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * True when the profile has a completed order containing the book.
 * Fail closed: query errors propagate to the caller.
 */
export async function hasCompletedOrderForBook(
  admin: SupabaseClient,
  profileId: string,
  bookId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from('orders')
    .select('id, items:order_items!inner(book_id)')
    .eq('user_id', profileId)
    .eq('status', 'completed')
    .eq('items.book_id', bookId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}
