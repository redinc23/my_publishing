'use server';

import { createClient } from '@/lib/supabase/server';
import type { DateRange } from '@/types/analytics';
import type { BookSale, BookPricing } from '@/types/revenue';
import { getAuthorContext } from '@/lib/utils/author-context';

export async function getBookRevenue(
  bookId: string,
  dateRange: DateRange
): Promise<{ total: number; sales: BookSale[] }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { authorId, role } = await getAuthorContext(supabase, user.id);
    const isAdmin = role === 'admin';

    // Verify book ownership
    const { data: book } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', bookId)
      .single();

    if (!book || (!isAdmin && book.author_id !== authorId)) {
      throw new Error('Unauthorized');
    }

    let query = supabase
      .from('book_sales')
      .select('*')
      .eq('book_id', bookId)
      .eq('status', 'completed');

    if (dateRange.from) {
      query = query.gte('purchased_at', dateRange.from.toISOString());
    }
    if (dateRange.to) {
      query = query.lte('purchased_at', dateRange.to.toISOString());
    }

    const { data: sales, error } = await query.order('purchased_at', { ascending: false });

    if (error) throw error;

    const total = sales?.reduce((sum, sale) => sum + sale.author_earnings, 0) || 0;

    return {
      total: total / 100, // Convert cents to dollars
      sales: sales || [],
    };
  } catch (error) {
    console.error('Error fetching revenue:', error);
    return { total: 0, sales: [] };
  }
}

export async function getBookPricing(bookId: string): Promise<BookPricing | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data: pricing, error } = await supabase
      .from('book_pricing')
      .select('*')
      .eq('book_id', bookId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return pricing || null;
  } catch (error) {
    console.error('Error fetching pricing:', error);
    return null;
  }
}

export async function updateBookPricing(
  bookId: string,
  pricing: Partial<BookPricing>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { authorId, role } = await getAuthorContext(supabase, user.id);
    const isAdmin = role === 'admin';

    // Verify book ownership
    const { data: book } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', bookId)
      .single();

    if (!book || (!isAdmin && book.author_id !== authorId)) {
      throw new Error('Unauthorized');
    }

    const { error } = await supabase
      .from('book_pricing')
      .upsert({
        book_id: bookId,
        ...pricing,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update pricing',
    };
  }
}