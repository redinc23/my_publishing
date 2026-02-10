import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { unstable_cache } from 'next/cache';
import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];

// ============================================================================
// BOOKS QUERIES
// ============================================================================

export async function getPublishedBooks(filters?: {
  genre?: string;
  search?: string;
  sort?: 'newest' | 'oldest' | 'rating' | 'popular' | 'price';
  page?: number;
  limit?: number;
}) {
  const supabase = await createClient();
  const page = filters?.page || 0;
  const limit = filters?.limit || 20;

  let query = supabase
    .from('books')
    .select('*, author:authors(*, profile:profiles(*))')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .range(page * limit, (page + 1) * limit - 1);

  if (filters?.genre) {
    query = query.eq('genre', filters.genre);
  }

  if (filters?.search) {
    query = query.textSearch('search_vector', filters.search, {
      type: 'websearch',
    });
  }

  switch (filters?.sort) {
    case 'newest':
      query = query.order('published_at', { ascending: false });
      break;
    case 'oldest':
      query = query.order('published_at', { ascending: true });
      break;
    case 'rating':
      query = query.order('average_rating', { ascending: false });
      break;
    case 'popular':
      query = query.order('total_reads', { ascending: false });
      break;
    case 'price':
      query = query.order('price', { ascending: true });
      break;
    default:
      query = query.order('published_at', { ascending: false });
  }

  return query;
}

export async function getBookBySlug(slug: string) {
  const supabase = await createClient();

  return supabase
    .from('books')
    .select('*, author:authors(*, profile:profiles(*)), content:book_content(*)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();
}

export async function getBookById(id: string) {
  const supabase = await createClient();

  return supabase
    .from('books')
    .select('*, author:authors(*, profile:profiles(*)), content:book_content(*)')
    .eq('id', id)
    .single();
}

export async function getFeaturedBooks(limit = 6) {
  try {
    const data = await unstable_cache(
      async (limit) => {
        // Use admin client to bypass RLS and avoid cookie dependency for static cache
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from('books')
          .select('*, author:authors(*, profile:profiles(*))')
          .eq('is_featured', true)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .order('featured_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data;
      },
      ['featured-books'],
      { tags: ['featured-books'], revalidate: 3600 }
    )(limit);

    return { data, error: null };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching featured books:', error);
    // Return error in a format compatible with Supabase response
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

export async function getTrendingBooks(limit = 12) {
  const supabase = await createClient();

  return supabase
    .from('books')
    .select('*, author:authors(*, profile:profiles(*))')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('total_reads', { ascending: false })
    .limit(limit);
}

export async function searchBooks(query: string, limit = 20) {
  const supabase = await createClient();

  return supabase
    .from('books')
    .select('*, author:authors(*, profile:profiles(*))')
    .textSearch('search_vector', query, {
      type: 'websearch',
    })
    .eq('status', 'published')
    .eq('visibility', 'public')
    .limit(limit);
}

export async function getBooksByGenre(genre: string, limit = 20) {
  const supabase = await createClient();

  return supabase
    .from('books')
    .select('*, author:authors(*, profile:profiles(*))')
    .eq('genre', genre)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('published_at', { ascending: false })
    .limit(limit);
}

// ============================================================================
// AUTHORS QUERIES
// ============================================================================

export async function getAuthorById(id: string) {
  const supabase = await createClient();

  return supabase
    .from('authors')
    .select('*, profile:profiles(*)')
    .eq('id', id)
    .single();
}

export async function getAuthorBySlug(slug: string) {
  const supabase = await createClient();

  return supabase
    .from('authors')
    .select('*, profile:profiles(*)')
    .eq('pen_name', slug)
    .single();
}

export async function getAuthorBooks(authorId: string) {
  const supabase = await createClient();

  return supabase
    .from('books')
    .select('*')
    .eq('author_id', authorId)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('published_at', { ascending: false });
}

// ============================================================================
// READING PROGRESS QUERIES
// ============================================================================

export async function getUserReadingProgress(userId: string) {
  const supabase = await createClient();

  return supabase
    .from('reading_progress')
    .select('*, book:books(*, author:authors(*, profile:profiles(*)))')
    .eq('user_id', userId)
    .order('last_accessed', { ascending: false });
}

export async function getReadingProgress(userId: string, bookId: string) {
  const supabase = await createClient();

  return supabase
    .from('reading_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .single();
}

export async function updateReadingProgress(
  userId: string,
  bookId: string,
  position: number
) {
  const supabase = await createClient();

  return supabase.rpc('update_reading_progress', {
    target_user_id: userId,
    target_book_id: bookId,
    new_position: position,
  });
}

export async function markBookAsFinished(userId: string, bookId: string, rating?: number) {
  const supabase = await createClient();

  return supabase
    .from('reading_progress')
    .upsert({
      user_id: userId,
      book_id: bookId,
      current_position: 100,
      is_finished: true,
      finished_at: new Date().toISOString(),
      rating: rating || null,
    });
}

// ============================================================================
// RECOMMENDATIONS QUERIES
// ============================================================================

export async function getPersonalizedRecommendations(
  userId: string,
  limit = 12
) {
  const supabase = await createClient();

  return supabase.rpc('get_recommendations', {
    target_user_id: userId,
    recommendation_limit: limit,
  });
}

export async function getSimilarBooks(bookId: string, limit = 6) {
  const supabase = await createClient();

  return supabase.rpc('get_similar_books', {
    target_book_id: bookId,
    match_count: limit,
  });
}

// ============================================================================
// MANUSCRIPTS QUERIES
// ============================================================================

export async function getAuthorManuscripts(authorId: string) {
  const supabase = await createClient();

  return supabase
    .from('manuscripts')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });
}

export async function getManuscriptById(id: string) {
  const supabase = await createClient();

  return supabase.from('manuscripts').select('*').eq('id', id).single();
}

export async function submitManuscript(data: {
  author_id: string;
  title: string;
  working_title?: string;
  synopsis?: string;
  genre: string;
  word_count?: number;
  target_audience?: string;
  manuscript_file_url?: string;
  sample_chapters_url?: string;
  cover_draft_url?: string;
}) {
  const supabase = await createClient();

  return supabase
    .from('manuscripts')
    .insert({
      ...data,
      status: 'submitted',
      submission_date: new Date().toISOString(),
    })
    .select()
    .single();
}

export async function updateManuscriptStatus(
  id: string,
  status: string,
  editorial_notes?: string
) {
  const supabase = await createClient();

  return supabase
    .from('manuscripts')
    .update({
      status,
      editorial_notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
}

// ============================================================================
// ORDERS QUERIES
// ============================================================================

export async function getUserOrders(userId: string) {
  const supabase = await createClient();

  return supabase
    .from('orders')
    .select('*, items:order_items(*, book:books(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
}

export async function getOrderById(orderId: string) {
  const supabase = await createClient();

  return supabase
    .from('orders')
    .select('*, items:order_items(*, book:books(*))')
    .eq('id', orderId)
    .single();
}

export async function createOrder(data: {
  user_id: string;
  order_number: string;
  total_amount: number;
  payment_intent_id?: string;
  items: Array<{
    book_id: string;
    unit_price: number;
  }>;
}) {
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: data.user_id,
      order_number: data.order_number,
      total_amount: data.total_amount,
      payment_intent_id: data.payment_intent_id,
      status: 'pending',
    })
    .select()
    .single();

  if (orderError || !order) {
    return { error: orderError };
  }

  const orderItems = data.items.map((item) => ({
    order_id: order.id,
    book_id: item.book_id,
    unit_price: item.unit_price,
    license_key: `LIC-${Date.now()}-${item.book_id}`,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    return { error: itemsError };
  }

  return { data: order };
}

// ============================================================================
// ENGAGEMENT QUERIES
// ============================================================================

export async function trackEngagement(data: {
  user_id?: string;
  book_id: string;
  event_type: 'view' | 'purchase' | 'read' | 'rating' | 'share' | 'wishlist';
  event_value?: Record<string, unknown>;
}) {
  const supabase = await createClient();

  return supabase.from('engagement_events').insert({
    user_id: data.user_id || null,
    book_id: data.book_id,
    event_type: data.event_type,
    event_value: data.event_value || null,
  });
}

// ============================================================================
// PROFILE QUERIES
// ============================================================================

export async function getProfile(userId: string) {
  const supabase = await createClient();

  return supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
}

export async function updateProfile(
  userId: string,
  updates: Partial<Tables['profiles']['Update']>
) {
  const supabase = await createClient();

  return supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();
}
