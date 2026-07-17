import type { SupabaseClient } from '@supabase/supabase-js';

// NOTE: orders.user_id stores profiles.id (FK → profiles.id), NOT the auth
// user id. Callers must resolve auth.uid() → profiles.id before calling.

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

/**
 * Book ids contained in the profile's completed orders.
 * Fail closed: query errors propagate to the caller.
 */
export async function getCompletedOrderBookIds(
  client: SupabaseClient,
  profileId: string
): Promise<string[]> {
  const { data, error } = await client
    .from('orders')
    .select('items:order_items(book_id)')
    .eq('user_id', profileId)
    .eq('status', 'completed');

  if (error) throw error;

  const bookIds = new Set<string>();
  for (const order of data ?? []) {
    const items = (order as { items?: Array<{ book_id: string }> | null }).items ?? [];
    for (const item of items) {
      if (item.book_id) bookIds.add(item.book_id);
    }
  }
  return Array.from(bookIds);
}
