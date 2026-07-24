/* eslint-disable */
'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath, revalidateTag } from 'next/cache';
import { revalidateBooks } from '@/lib/supabase/queries'; // PERF-PHASE2-2
import { z } from 'zod';
import {
  CreateBookSchema,
  UpdateBookSchema,
  type Book,
  type CreateBookInput,
  type UpdateBookInput,
} from '@/types/books';
import { isMongoPrimary } from '@/lib/db/provider';
import { createBookMongo, updateBookMongo } from '@/lib/mongo-books';
import { getBookById } from '@/lib/mongo-queries';
import { recordAudit } from '@/lib/audit';

// Rate limiting
const RATE_LIMIT = new Map<string, { count: number; timestamp: number }>();

const checkRateLimit = (userId: string, action: string) => {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const limit = RATE_LIMIT.get(key);

  if (limit) {
    if (now - limit.timestamp < 60000) {
      // 1 minute window
      if (limit.count >= 10) {
        // 10 requests per minute
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from('audit_logs').insert({
    user_id: user?.id,
    action,
    resource_id: resourceId,
    resource_type: resourceType,
    details,
    ip_address: null, // Would be set by a middleware in production
    user_agent: null,
  });
};

export async function createBook(input: CreateBookInput) {
  try {
    if (isMongoPrimary()) {
      const { getRequestUser } = await import('@/lib/api/request-user');
      const user = await getRequestUser();
      if (!user) {
        return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
      }
      checkRateLimit(user.id, 'create_book');
      const validated = CreateBookSchema.parse(input);
      const result = await createBookMongo({
        title: validated.title,
        description: validated.description,
        cover_url: validated.cover_url,
        manuscript_url: validated.manuscript_url,
        author_id: user.id,
        tags: validated.tags,
      });
      if ('error' in result) {
        return {
          success: false,
          error: result.error,
          code: result.code === 'DUPLICATE_SLUG' ? 'DUPLICATE_BOOK' : result.code,
        };
      }
      await recordAudit(user.id, 'CREATE', String(result.book._id), {
        resource_type: 'book',
        title: result.book.title,
        status: result.book.status,
      });
      revalidatePath('/admin/books');
      revalidatePath('/books');
      revalidateTag('featured-books');
      revalidateBooks();
      return { success: true, data: result.book, code: 'BOOK_CREATED' };
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    checkRateLimit(user.id, 'create_book');

    // Validate input
    const validated = CreateBookSchema.parse(input);

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
      .eq('author_id', user.id)
      .is('deleted_at', null)
      .single();

    if (existingBook) {
      return {
        success: false,
        error: 'A book with this title already exists',
        code: 'DUPLICATE_BOOK',
      };
    }

    const { data, error } = await supabase
      .from('books')
      .insert({
        ...validated,
        slug,
        author_id: user.id,
        author_name: user.user_metadata?.full_name || user.email || 'Anonymous',
        metadata: validated.metadata || {},
        tags: validated.tags || [],
        categories: validated.categories || [],
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await logAudit(supabase, 'CREATE', data.id, 'book', {
      title: data.title,
      status: data.status,
    });

    revalidatePath('/admin/books');
    revalidatePath('/books');
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, data, code: 'BOOK_CREATED' };
  } catch (error) {
    console.error('Create book error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export async function updateBook(bookId: string, input: UpdateBookInput) {
  try {
    if (isMongoPrimary()) {
      const { getRequestUser } = await import('@/lib/api/request-user');
      const user = await getRequestUser();
      if (!user) {
        return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
      }
      checkRateLimit(user.id, 'update_book');
      const validated = UpdateBookSchema.parse(input);
      const existing = await getBookById(bookId);
      if (!existing || (String(existing.author_id) !== user.id && user.role !== 'admin')) {
        return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
      }
      const result = await updateBookMongo(bookId, {
        title: validated.title,
        description: validated.description,
        cover_url: validated.cover_url,
        manuscript_url: validated.manuscript_url,
        status: validated.status,
        slug: validated.slug,
        tags: validated.tags,
      });
      if ('error' in result) {
        return { success: false, error: result.error, code: result.code };
      }
      await recordAudit(user.id, 'UPDATE', bookId, {
        resource_type: 'book',
        title: result.book.title,
      });
      revalidatePath('/admin/books');
      revalidatePath('/books');
      revalidatePath(`/books/${result.book.slug}`);
      revalidateTag('featured-books');
      revalidateBooks();
      return { success: true, data: result.book, code: 'BOOK_UPDATED' };
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    checkRateLimit(user.id, 'update_book');

    // Validate input
    const validated = UpdateBookSchema.parse(input);

    // Check ownership and if book exists
    const { data: book } = await supabase
      .from('books')
      .select('author_id, deleted_at')
      .eq('id', bookId)
      .single();

    if (!book || book.author_id !== user.id) {
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
        .eq('author_id', user.id)
        .is('deleted_at', null)
        .single();

      if (existingBook) {
        return {
          success: false,
          error: 'Another book with this slug already exists',
          code: 'DUPLICATE_SLUG',
        };
      }
    }

    const { data, error } = await supabase
      .from('books')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookId)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await logAudit(supabase, 'UPDATE', bookId, 'book', {
      changes: Object.keys(validated),
      new_status: validated.status,
    });

    revalidatePath('/admin/books');
    revalidatePath(`/books/${bookId}`);
    revalidatePath(`/books/${data.slug}`);
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, data, code: 'BOOK_UPDATED' };
  } catch (error) {
    console.error('Update book error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.errors,
        code: 'VALIDATION_ERROR',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Admin-only book update. Unlike updateBook (author-scoped), this lets a user
 * with the 'admin' role edit ANY book, including the external retailer URLs.
 */
export async function updateBookAdmin(
  bookId: string,
  input: {
    title?: string;
    subtitle?: string;
    description?: string;
    content_type?: 'book' | 'comic' | 'paper';
    slug?: string;
    price?: number;
    isbn?: string;
    genre?: string;
    page_count?: number;
    word_count?: number;
    status?: 'draft' | 'published' | 'archived';
    cover_url?: string | null;
    epub_url?: string | null;
    amazon_url?: string | null;
    kindle_url?: string | null;
    apple_books_url?: string | null;
    audible_url?: string | null;
    barnes_noble_url?: string | null;
    google_play_books_url?: string | null;
  }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    // Role check: role lives on profiles.role (same gate as requireAdmin).
    // profiles.id is its own UUID; the auth user id is profiles.user_id.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Admin access required', code: 'FORBIDDEN' };
    }

    checkRateLimit(user.id, 'update_book_admin');

    // Service-role client after role check — matches createBookAdmin / updateBookStatusAction.
    // There is no admin UPDATE RLS policy on books for the session client.
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('books')
      .select('id, deleted_at')
      .eq('id', bookId)
      .single();

    if (!existing) {
      return { success: false, error: 'Book not found', code: 'NOT_FOUND' };
    }
    if (existing.deleted_at) {
      return { success: false, error: 'Book has been deleted', code: 'BOOK_DELETED' };
    }

    // Normalize a URL input: trimmed string, or null when blank.
    const url = (v?: string | null) => {
      const t = (v ?? '').trim();
      return t.length ? t : null;
    };

    // Only write keys that were actually provided.
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) updates.title = input.title;
    if (input.subtitle !== undefined) updates.subtitle = input.subtitle || null;
    if (input.description !== undefined) updates.description = input.description || null;
    if (input.content_type !== undefined) updates.content_type = input.content_type;
    if (input.slug !== undefined) updates.slug = input.slug;
    if (input.price !== undefined) updates.price = input.price;
    if (input.isbn !== undefined) updates.isbn = input.isbn || null;
    if (input.genre !== undefined) updates.genre = input.genre || null;
    if (input.page_count !== undefined) updates.page_count = input.page_count;
    if (input.word_count !== undefined) updates.word_count = input.word_count;
    if (input.status !== undefined) updates.status = input.status;
    if (input.cover_url !== undefined) updates.cover_url = url(input.cover_url);
    if (input.epub_url !== undefined) updates.epub_url = url(input.epub_url);
    if (input.amazon_url !== undefined) updates.amazon_url = url(input.amazon_url);
    if (input.kindle_url !== undefined) updates.kindle_url = url(input.kindle_url);
    if (input.apple_books_url !== undefined) updates.apple_books_url = url(input.apple_books_url);
    if (input.audible_url !== undefined) updates.audible_url = url(input.audible_url);
    if (input.barnes_noble_url !== undefined)
      updates.barnes_noble_url = url(input.barnes_noble_url);
    if (input.google_play_books_url !== undefined)
      updates.google_play_books_url = url(input.google_play_books_url);

    // Slug uniqueness across all books (admin is not author-scoped).
    if (typeof updates.slug === 'string') {
      const { data: dupe } = await admin
        .from('books')
        .select('id')
        .eq('slug', updates.slug)
        .neq('id', bookId)
        .is('deleted_at', null)
        .single();
      if (dupe) {
        return {
          success: false,
          error: 'Another book with this slug already exists',
          code: 'DUPLICATE_SLUG',
        };
      }
    }

    const { data, error } = await admin
      .from('books')
      .update(updates)
      .eq('id', bookId)
      .select()
      .single();

    if (error) throw error;

    await logAudit(supabase, 'UPDATE', bookId, 'book', {
      changes: Object.keys(updates).filter((k) => k !== 'updated_at'),
      admin: true,
    });

    revalidatePath('/admin/books');
    revalidatePath(`/books/${bookId}`);
    if (data?.slug) revalidatePath(`/books/${data.slug}`);
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, data, code: 'BOOK_UPDATED' };
  } catch (error) {
    console.error('Admin update book error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Admin-only book creation for /admin/books/new. Unlike createBook
 * (author-scoped, RLS requires author_id = auth.uid()), this lets an admin
 * create a book for any author (or none), so the insert uses the service-role
 * client after the role check passes.
 */
export async function createBookAdmin(input: {
  title: string;
  slug?: string;
  description?: string;
  genre: string;
  price?: number;
  status?: 'draft' | 'published';
  content_type?: 'book' | 'comic' | 'paper';
  author_id?: string | null;
  cover_url?: string | null;
  epub_url?: string | null;
}) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Admin access required', code: 'FORBIDDEN' };
    }

    checkRateLimit(user.id, 'create_book_admin');

    const title = (input.title || '').trim();
    const genre = (input.genre || '').trim();
    if (!title) {
      return { success: false, error: 'Title is required', code: 'VALIDATION_ERROR' };
    }
    if (!genre) {
      return { success: false, error: 'Genre is required', code: 'VALIDATION_ERROR' };
    }

    const slug = (input.slug || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) {
      return {
        success: false,
        error: 'Slug could not be derived from title',
        code: 'VALIDATION_ERROR',
      };
    }

    const admin = createAdminClient();

    const { data: dupe } = await admin.from('books').select('id').eq('slug', slug).maybeSingle();
    if (dupe) {
      return {
        success: false,
        error: 'A book with this slug already exists',
        code: 'DUPLICATE_SLUG',
      };
    }

    const status = input.status || 'draft';
    const { data, error } = await admin
      .from('books')
      .insert({
        title,
        slug,
        description: input.description?.trim() || null,
        genre,
        price: input.price ?? 0,
        status,
        content_type: input.content_type || 'book',
        author_id: input.author_id || null,
        cover_url: input.cover_url?.trim() || null,
        epub_url: input.epub_url?.trim() || null,
        published_at: status === 'published' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit(supabase, 'CREATE', data.id, 'book', {
      title: data.title,
      status: data.status,
      admin: true,
    });

    revalidatePath('/admin/books');
    revalidatePath('/books');
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, data, code: 'BOOK_CREATED' };
  } catch (error) {
    console.error('Admin create book error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export async function deleteBook(bookId: string, hardDelete: boolean = false) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    checkRateLimit(user.id, 'delete_book');

    const { data: book } = await supabase
      .from('books')
      .select('author_id, deleted_at')
      .eq('id', bookId)
      .single();

    if (!book || book.author_id !== user.id) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (hardDelete && user.user_metadata?.role !== 'admin') {
      return { success: false, error: 'Admin required for hard delete', code: 'ADMIN_REQUIRED' };
    }

    if (hardDelete) {
      // Hard delete (admin only)
      const { error } = await supabase.from('books').delete().eq('id', bookId);

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
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, code: hardDelete ? 'BOOK_HARD_DELETED' : 'BOOK_SOFT_DELETED' };
  } catch (error) {
    console.error('Delete book error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete book',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export async function restoreBook(bookId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { data: book } = await supabase
      .from('books')
      .select('author_id, deleted_at')
      .eq('id', bookId)
      .single();

    if (!book || book.author_id !== user.id) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!book.deleted_at) {
      return { success: false, error: 'Book is not deleted', code: 'NOT_DELETED' };
    }

    const { error } = await supabase
      .from('books')
      .update({
        deleted_at: null,
        status: 'draft', // Reset to draft when restoring
      })
      .eq('id', bookId);

    if (error) throw error;

    // Log audit
    await logAudit(supabase, 'RESTORE', bookId, 'book', {});

    revalidatePath('/admin/books');
    revalidatePath('/books');
    revalidateTag('featured-books');
    revalidateBooks(); // PERF-PHASE2-2

    return { success: true, code: 'BOOK_RESTORED' };
  } catch (error) {
    console.error('Restore book error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore book',
      code: 'UNKNOWN_ERROR',
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

    let query = supabase
      .from('books')
      .select('*', { count: 'exact' })
      .eq('author_id', user.id)
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
      code: 'BOOKS_FETCHED',
    };
  } catch (error) {
    console.error('Get my books error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch books',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export async function searchBooks(
  query: string,
  filters?: {
    language?: string;
    minRating?: number;
    category?: string;
    tag?: string;
    limit?: number;
  }
) {
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
      ...filters,
    });

    if (error) throw error;

    return { success: true, data, code: 'SEARCH_COMPLETED' };
  } catch (error) {
    console.error('Search books error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search books',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export async function getBookStats(bookId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

    const { data: book } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', bookId)
      .single();

    if (!book || book.author_id !== user.id) {
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
        monthly_trends: monthlyStats || [],
      },
      code: 'STATS_FETCHED',
    };
  } catch (error) {
    console.error('Get book stats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export async function incrementViewCount(bookId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
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
        supabase.from('book_view_cache').upsert(
          {
            cache_key: cacheKey,
            last_viewed: now.toISOString(),
          },
          { onConflict: 'cache_key' }
        ),

        // Log view for analytics
        supabase.from('book_views').insert({
          book_id: bookId,
          user_id: userId,
          viewed_at: now.toISOString(),
          ip_address: null,
          user_agent: null,
        }),
      ]);
    }

    return { success: true, code: 'VIEW_INCREMENTED' };
  } catch (error) {
    console.error('Increment view count error:', error);
    // Don't fail the request if view counting fails
    return { success: false, code: 'VIEW_INCREMENT_FAILED' };
  }
}
