/* eslint-disable */
'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { 
  CreateBookSchema, 
  UpdateBookSchema, 
  type Book,
  type CreateBookInput, 
  type UpdateBookInput 
} from '@/types/books';
import { getAuthorContext } from '@/lib/utils/author-context';

// Rate limiting
const RATE_LIMIT = new Map<string, { count: number; timestamp: number }>();

const checkRateLimit = (userId: string, action: string) => {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const limit = RATE_LIMIT.get(key);

  if (limit) {
    if (now - limit.timestamp < 60000) { // 1 minute window
      if (limit.count >= 10) { // 10 requests per minute
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      limit.count += 1;
    } else {
      RATE_LIMIT.set(key, { count: 1, timestamp: now });
    }
  } else {
    RATE_LIMIT.set(key, { count: 1, timestamp: now });
  }

  // Clean up old entries
  setTimeout(() => {
    RATE_LIMIT.delete(key);
  }, 60000);
};

// Audit logging
const logAudit = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  resourceId: string,
  resourceType: string,
  details: Record<string, any>
) => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  try {
    const adminClient = createAdminClient();
    await adminClient.from('audit_logs').insert({
      user_id: user?.id,
      action,
      table_name: resourceType,
      record_id: resourceId,
      new_data: details,
      ip_address: null, // Would be set by a middleware in production
      user_agent: null,
    });
  } catch (error) {
    console.warn('Audit log failed:', error);
  }
};

export async function createBook(input: CreateBookInput) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    checkRateLimit(user.id, 'create_book');

    // Validate input
    const validated = CreateBookSchema.parse(input);

    const { authorId } = await getAuthorContext(supabase, user.id);
    if (!authorId) {
      return { success: false, error: 'Author profile not found', code: 'AUTHOR_NOT_FOUND' };
    }

    // Generate slug from title
    const slug = validated.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check for duplicate slug
    const { data: existingBook } = await supabase
      .from('books')
      .select('id')
      .eq('slug', slug)
      .eq('author_id', authorId)
      .is('deleted_at', null)
      .single();

    if (existingBook) {
      return { 
        success: false, 
        error: 'A book with this title already exists', 
        code: 'DUPLICATE_BOOK' 
      };
    }

    const { data, error } = await supabase
      .from('books')
      .insert({
        title: validated.title,
        description: validated.description,
        isbn: validated.isbn,
        genre: validated.genre,
        cover_url: validated.cover_url,
        slug,
        author_id: authorId,
      })
      .select()
      .single();

    if (error) throw error;

    if (validated.epub_url || validated.manuscript_url) {
      await supabase.from('book_content').insert({
        book_id: data.id,
        epub_url: validated.epub_url || null,
        pdf_url: validated.manuscript_url || null,
      });
    }

    // Log audit
    await logAudit(supabase, 'CREATE', data.id, 'book', {
      title: data.title,
      status: data.status
    });

    revalidatePath('/admin/books');
    revalidatePath('/books');

    return { success: true, data, code: 'BOOK_CREATED' };
  } catch (error) {
    console.error('Create book error:', error);
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: 'Validation failed', 
        details: error.errors,
        code: 'VALIDATION_ERROR'
      };
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create book',
      code: 'UNKNOWN_ERROR'
    };
  }
}

export async function updateBook(bookId: string, input: UpdateBookInput) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    checkRateLimit(user.id, 'update_book');

    // Validate input
    const validated = UpdateBookSchema.parse(input);

    const { authorId, role } = await getAuthorContext(supabase, user.id);
    const isAdmin = role === 'admin';

    // Check ownership and if book exists
    const { data: book } = await supabase
      .from('books')
      .select('author_id, deleted_at')
      .eq('id', bookId)
      .single();

    if (!book || (!isAdmin && book.author_id !== authorId)) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (book.deleted_at) {
      return { success: false, error: 'Book has been deleted', code: 'BOOK_DELETED' };
    }

    // Handle slug uniqueness if being updated
    if (validated.slug) {
      const { data: existingBook } = await supabase
        .from('books')
        .select('id')
        .eq('slug', validated.slug)
        .neq('id', bookId)
        .eq('author_id', book.author_id)
        .is('deleted_at', null)
        .single();

      if (existingBook) {
        return { 
          success: false, 
          error: 'Another book with this slug already exists', 
          code: 'DUPLICATE_SLUG' 
        };
      }
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof validated.title !== 'undefined') updatePayload.title = validated.title;
    if (typeof validated.description !== 'undefined') updatePayload.description = validated.description;
    if (typeof validated.isbn !== 'undefined') updatePayload.isbn = validated.isbn;
    if (typeof validated.genre !== 'undefined') updatePayload.genre = validated.genre;
    if (typeof validated.cover_url !== 'undefined') updatePayload.cover_url = validated.cover_url;
    if (typeof validated.status !== 'undefined') updatePayload.status = validated.status;
    if (typeof validated.page_count !== 'undefined') updatePayload.page_count = validated.page_count;
    if (typeof validated.word_count !== 'undefined') updatePayload.word_count = validated.word_count;
    if (typeof validated.slug !== 'undefined') updatePayload.slug = validated.slug;

    const { data, error } = await supabase
      .from('books')
      .update(updatePayload)
      .eq('id', bookId)
      .select()
      .single();

    if (error) throw error;

    if (typeof validated.epub_url !== 'undefined' || typeof validated.manuscript_url !== 'undefined') {
      const contentUpdates: Record<string, string | null> = {};
      if (typeof validated.epub_url !== 'undefined') {
        contentUpdates.epub_url = validated.epub_url || null;
      }
      if (typeof validated.manuscript_url !== 'undefined') {
        contentUpdates.pdf_url = validated.manuscript_url || null;
      }

      const { data: existingContent } = await supabase
        .from('book_content')
        .select('id')
        .eq('book_id', bookId)
        .single();

      if (existingContent?.id) {
        await supabase
          .from('book_content')
          .update(contentUpdates)
          .eq('id', existingContent.id);
      } else {
        await supabase.from('book_content').insert({
          book_id: bookId,
          ...contentUpdates,
        });
      }
    }

    // Log audit
    await logAudit(supabase, 'UPDATE', bookId, 'book', {
      changes: Object.keys(validated),
      new_status: validated.status
    });

    revalidatePath('/admin/books');
    revalidatePath(`/books/${bookId}`);
    revalidatePath(`/books/${data.slug}`);

    return { success: true, data, code: 'BOOK_UPDATED' };
  } catch (error) {
    console.error('Update book error:', error);
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: 'Validation failed', 
        details: error.errors,
        code: 'VALIDATION_ERROR'
      };
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update book',
      code: 'UNKNOWN_ERROR'
    };
  }
}

export async function deleteBook(bookId: string, hardDelete: boolean = false) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    checkRateLimit(user.id, 'delete_book');

    const { authorId, role } = await getAuthorContext(supabase, user.id);
    const isAdmin = role === 'admin';

    const { data: book } = await supabase
      .from('books')
      .select('author_id, deleted_at')
      .eq('id', bookId)
      .single();

    if (!book || (!isAdmin && book.author_id !== authorId)) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (hardDelete && user.user_metadata?.role !== 'admin') {
      return { success: false, error: 'Admin required for hard delete', code: 'ADMIN_REQUIRED' };
    }

    if (hardDelete) {
      // Hard delete (admin only)
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId);

      if (error) throw error;
    } else {
      // Soft delete
      const { error } = await supabase
        .from('books')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', bookId);

      if (error) throw error;
    }

    // Log audit
    await logAudit(supabase, hardDelete ? 'HARD_DELETE' : 'SOFT_DELETE', bookId, 'book', {});

    revalidatePath('/admin/books');
    revalidatePath('/books');

    return { success: true, code: hardDelete ? 'BOOK_HARD_DELETED' : 'BOOK_SOFT_DELETED' };
  } catch (error) {
    console.error('Delete book error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete book',
      code: 'UNKNOWN_ERROR'
    };
  }
}

export async function restoreBook(bookId: string) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { authorId, role } = await getAuthorContext(supabase, user.id);
    const isAdmin = role === 'admin';

    const { data: book } = await supabase
      .from('books')
      .select('author_id, deleted_at')
      .eq('id', bookId)
      .single();

    if (!book || (!isAdmin && book.author_id !== authorId)) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!book.deleted_at) {
      return { success: false, error: 'Book is not deleted', code: 'NOT_DELETED' };
    }

    const { error } = await supabase
      .from('books')
      .update({ 
        deleted_at: null,
        status: 'draft' // Reset to draft when restoring
      })
      .eq('id', bookId);

    if (error) throw error;

    // Log audit
    await logAudit(supabase, 'RESTORE', bookId, 'book', {});

    revalidatePath('/admin/books');
    revalidatePath('/books');

    return { success: true, code: 'BOOK_RESTORED' };
  } catch (error) {
    console.error('Restore book error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to restore book',
      code: 'UNKNOWN_ERROR'
    };
  }
}

export async function getMyBooks(options?: {
  status?: Book['status'];
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

    const { authorId } = await getAuthorContext(supabase, user.id);
    if (!authorId) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    let query = supabase
      .from('books')
      .select('*', { count: 'exact' })
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (!options?.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return { 
      success: true, 
      data, 
      count: count || 0,
      code: 'BOOKS_FETCHED' 
    };
  } catch (error) {
    console.error('Get my books error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch books',
      code: 'UNKNOWN_ERROR'
    };
  }
}

export async function searchBooks(query: string, filters?: {
  language?: string;
  minRating?: number;
  category?: string;
  tag?: string;
  limit?: number;
}) {
  try {
    const supabase = await createClient();

    let sqlQuery = `
      SELECT 
        id, title, subtitle, author_name, cover_url, average_rating,
        ts_rank(search_vector, websearch_to_tsquery('english', $1)) as relevance,
        ts_headline('english', description, websearch_to_tsquery('english', $1)) as match_snippet
      FROM books
      WHERE search_vector @@ websearch_to_tsquery('english', $1)
        AND status = 'published'
        AND deleted_at IS NULL
    `;

    const params: any[] = [query];
    let paramIndex = 2;

    if (filters?.language) {
      sqlQuery += ` AND language = $${paramIndex}`;
      params.push(filters.language);
      paramIndex++;
    }

    if (filters?.minRating) {
      sqlQuery += ` AND average_rating >= $${paramIndex}`;
      params.push(filters.minRating);
      paramIndex++;
    }

    if (filters?.category) {
      sqlQuery += ` AND $${paramIndex} = ANY(categories)`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters?.tag) {
      sqlQuery += ` AND $${paramIndex} = ANY(tags)`;
      params.push(filters.tag);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY relevance DESC`;
    
    if (filters?.limit) {
      sqlQuery += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    }

    const { data, error } = await supabase.rpc('books_search', {
      search_query: query,
      ...filters
    });

    if (error) throw error;

    return { success: true, data, code: 'SEARCH_COMPLETED' };
  } catch (error) {
    console.error('Search books error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to search books',
      code: 'UNKNOWN_ERROR'
    };
  }
}

export async function getBookStats(bookId: string) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

    const { authorId, role } = await getAuthorContext(supabase, user.id);
    const isAdmin = role === 'admin';

    const { data: book } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', bookId)
      .single();

    if (!book || (!isAdmin && book.author_id !== authorId)) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    // Get monthly stats
    const { data: monthlyStats } = await supabase
      .from('book_stats')
      .select('*')
      .eq('book_id', bookId)
      .order('month', { ascending: false })
      .limit(12);

    // Get total stats
    const { data: totalStats } = await supabase
      .from('books')
      .select('view_count, download_count, average_rating, review_count')
      .eq('id', bookId)
      .single();

    return { 
      success: true, 
      data: {
        ...totalStats,
        monthly_trends: monthlyStats || []
      },
      code: 'STATS_FETCHED'
    };
  } catch (error) {
    console.error('Get book stats error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
      code: 'UNKNOWN_ERROR'
    };
  }
}

export async function incrementViewCount(bookId: string) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    // Check if user has viewed this book recently (within 24 hours)
    const cacheKey = `view:${bookId}:${userId}`;
    const lastViewed = await supabase
      .from('book_view_cache')
      .select('last_viewed')
      .eq('cache_key', cacheKey)
      .single();

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (!lastViewed.data || new Date(lastViewed.data.last_viewed) < twentyFourHoursAgo) {
      await Promise.all([
        // Increment view count
        supabase.rpc('increment_view_count', { book_id: bookId }),

        // Update cache
        supabase
          .from('book_view_cache')
          .upsert({
            cache_key: cacheKey,
            last_viewed: now.toISOString()
          }, { onConflict: 'cache_key' }),

        // Log view for analytics
        supabase.from('book_views').insert({
          book_id: bookId,
          user_id: userId,
          viewed_at: now.toISOString(),
          ip_address: null,
          user_agent: null
        })
      ]);
    }

    return { success: true, code: 'VIEW_INCREMENTED' };
  } catch (error) {
    console.error('Increment view count error:', error);
    // Don't fail the request if view counting fails
    return { success: false, code: 'VIEW_INCREMENT_FAILED' };
  }
}
