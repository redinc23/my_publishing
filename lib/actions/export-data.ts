/* eslint-disable */
'use server';

/**
 * Export Data Server Actions
 * Production-grade data export with validation and authorization
 */

import { createClient } from '@/lib/supabase/server';
import { 
  BookIdSchema, 
  DateRangeSchema, 
  ExportFormatSchema,
  validateSafe,
  getFirstError 
} from '@/lib/validations/schemas';
import type { ExportResult, ExportDateRange } from '@/types/export';

/**
 * Export analytics data for a book
 */
export async function exportAnalyticsData(
  bookId: unknown,
  dateRange: unknown,
  format: unknown
): Promise<ExportResult> {
  try {
    const supabase = await createClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Unauthorized - please sign in' };
    }

    // Validate book ID
    const bookIdResult = validateSafe(BookIdSchema, bookId);
    if (!bookIdResult.success) {
      return { success: false, error: getFirstError(bookIdResult.error) };
    }

    // Validate date range
    const dateRangeResult = validateSafe(DateRangeSchema, dateRange || {});
    if (!dateRangeResult.success) {
      return { success: false, error: getFirstError(dateRangeResult.error) };
    }

    // Validate format
    const formatResult = validateSafe(ExportFormatSchema, format || 'csv');
    if (!formatResult.success) {
      return { success: false, error: getFirstError(formatResult.error) };
    }

    // Verify book ownership
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, author_id, title')
      .eq('id', bookIdResult.data)
      .single();

    if (bookError || !book) {
      return { success: false, error: 'Book not found' };
    }

    if (book.author_id !== user.id) {
      // Check if admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        return { success: false, error: 'Unauthorized - you do not own this book' };
      }
    }

    // Build query
    let query = supabase
      .from('analytics_events')
      .select('*')
      .eq('book_id', bookIdResult.data)
      .order('created_at', { ascending: false });

    // Apply date filters
    const { from, to } = dateRangeResult.data as ExportDateRange;
    if (from) {
      const fromDate = typeof from === 'string' ? new Date(from) : from;
      query = query.gte('created_at', fromDate.toISOString());
    }
    if (to) {
      const toDate = typeof to === 'string' ? new Date(to) : to;
      query = query.lte('created_at', toDate.toISOString());
    }

    const { data: events, error: queryError } = await query.limit(10000);

    if (queryError) {
      console.error('Export query error:', queryError);
      return { success: false, error: 'Failed to fetch analytics data' };
    }

    // Format output
    const validFormat = formatResult.data;
    let output: string;
    let mimeType: string;

    if (validFormat === 'json') {
      output = JSON.stringify(events, null, 2);
      mimeType = 'application/json';
    } else if (validFormat === 'csv') {
      const headers = ['id', 'book_id', 'event_type', 'user_id', 'session_id', 'created_at'];
      const rows = events?.map(e => headers.map(h => e[h as keyof typeof e] ?? '').join(',')) || [];
      output = [headers.join(','), ...rows].join('\n');
      mimeType = 'text/csv';
    } else {
      // Excel would need a library like xlsx - return CSV for now
      const headers = ['id', 'book_id', 'event_type', 'user_id', 'session_id', 'created_at'];
      const rows = events?.map(e => headers.map(h => e[h as keyof typeof e] ?? '').join(',')) || [];
      output = [headers.join(','), ...rows].join('\n');
      mimeType = 'text/csv';
    }

    return {
      success: true,
      data: output,
      format: validFormat,
      filename: `analytics-${book.title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.${validFormat === 'excel' ? 'csv' : validFormat}`,
      mime_type: mimeType,
      byte_size: new Blob([output]).size,
    };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: 'Export failed unexpectedly' };
  }
}

/**
 * Export revenue data for a book or all books
 */
export async function exportRevenueData(
  bookId: unknown,
  dateRange: unknown,
  format: unknown
): Promise<ExportResult> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate inputs
    const dateRangeResult = validateSafe(DateRangeSchema, dateRange || {});
    if (!dateRangeResult.success) {
      return { success: false, error: getFirstError(dateRangeResult.error) };
    }

    const formatResult = validateSafe(ExportFormatSchema, format || 'csv');
    if (!formatResult.success) {
      return { success: false, error: getFirstError(formatResult.error) };
    }

    // Build query - get orders for user's books
    let query = supabase
      .from('orders')
      .select(`
        id,
        book_id,
        amount,
        currency,
        status,
        created_at,
        books!inner(title, author_id)
      `)
      .eq('books.author_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    // Filter by specific book if provided
    if (bookId) {
      const bookIdResult = validateSafe(BookIdSchema, bookId);
      if (bookIdResult.success) {
        query = query.eq('book_id', bookIdResult.data);
      }
    }

    // Apply date filters
    const { from, to } = dateRangeResult.data as ExportDateRange;
    if (from) {
      const fromDate = typeof from === 'string' ? new Date(from) : from;
      query = query.gte('created_at', fromDate.toISOString());
    }
    if (to) {
      const toDate = typeof to === 'string' ? new Date(to) : to;
      query = query.lte('created_at', toDate.toISOString());
    }

    const { data: orders, error: queryError } = await query.limit(10000);

    if (queryError) {
      console.error('Revenue export error:', queryError);
      return { success: false, error: 'Failed to fetch revenue data' };
    }

    const validFormat = formatResult.data;
    let output: string;

    if (validFormat === 'json') {
      output = JSON.stringify(orders, null, 2);
    } else {
      const headers = ['id', 'book_id', 'book_title', 'amount', 'currency', 'status', 'created_at'];
      const rows = orders?.map(o => [
        o.id,
        o.book_id,
        (o.books as any)?.title || '',
        o.amount,
        o.currency,
        o.status,
        o.created_at
      ].join(',')) || [];
      output = [headers.join(','), ...rows].join('\n');
    }

    return {
      success: true,
      data: output,
      format: validFormat,
      filename: `revenue-export-${Date.now()}.${validFormat === 'json' ? 'json' : 'csv'}`,
      mime_type: validFormat === 'json' ? 'application/json' : 'text/csv',
    };
  } catch (error) {
    console.error('Revenue export error:', error);
    return { success: false, error: 'Export failed' };
  }
}

/**
 * Export reader data
 */
export async function exportReaderData(
  bookId: unknown,
  dateRange: unknown
): Promise<ExportResult> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate inputs
    const dateRangeResult = validateSafe(DateRangeSchema, dateRange || {});
    if (!dateRangeResult.success) {
      return { success: false, error: getFirstError(dateRangeResult.error) };
    }

    // Get unique readers for user's books
    let query = supabase
      .from('analytics_events')
      .select('user_id, book_id, created_at, books!inner(author_id)')
      .eq('books.author_id', user.id)
      .not('user_id', 'is', null);

    if (bookId) {
      const bookIdResult = validateSafe(BookIdSchema, bookId);
      if (bookIdResult.success) {
        query = query.eq('book_id', bookIdResult.data);
      }
    }

    const { from, to } = dateRangeResult.data as ExportDateRange;
    if (from) {
      const fromDate = typeof from === 'string' ? new Date(from) : from;
      query = query.gte('created_at', fromDate.toISOString());
    }
    if (to) {
      const toDate = typeof to === 'string' ? new Date(to) : to;
      query = query.lte('created_at', toDate.toISOString());
    }

    const { data: events, error } = await query.limit(10000);

    if (error) {
      return { success: false, error: 'Failed to fetch reader data' };
    }

    // Aggregate by user
    const readerMap = new Map<string, { user_id: string; books: Set<string>; first_seen: string; last_seen: string }>();
    
    events?.forEach(event => {
      if (!event.user_id) return;
      
      const existing = readerMap.get(event.user_id);
      if (existing) {
        existing.books.add(event.book_id);
        if (event.created_at < existing.first_seen) existing.first_seen = event.created_at;
        if (event.created_at > existing.last_seen) existing.last_seen = event.created_at;
      } else {
        readerMap.set(event.user_id, {
          user_id: event.user_id,
          books: new Set([event.book_id]),
          first_seen: event.created_at,
          last_seen: event.created_at,
        });
      }
    });

    const readers = Array.from(readerMap.values()).map(r => ({
      user_id: r.user_id,
      books_read: r.books.size,
      first_seen: r.first_seen,
      last_seen: r.last_seen,
    }));

    const output = JSON.stringify(readers, null, 2);

    return {
      success: true,
      data: output,
      format: 'json',
      filename: `readers-export-${Date.now()}.json`,
      mime_type: 'application/json',
    };
  } catch (error) {
    console.error('Reader export error:', error);
    return { success: false, error: 'Export failed' };
  }
}