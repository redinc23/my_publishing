'use server';

import { createClient } from '@/lib/supabase/server';
import type { DateRange } from '@/types/analytics';
import type { BookStats, HeatmapData, GeographyData, LiveReader } from '@/types/analytics';
import { getCache, setCache } from '@/lib/services/cache-service';

export async function getBookAnalytics(
  bookId: string,
  dateRange: DateRange
): Promise<BookStats[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    // Verify book ownership
    const { data: book } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', bookId)
      .single();

    if (!book || book.author_id !== user.id) {
      throw new Error('Unauthorized');
    }

    // Check cache
    const cacheKey = `analytics:${bookId}:${dateRange.from?.toISOString()}-${dateRange.to?.toISOString()}`;
    const cached = await getCache<BookStats[]>(cacheKey);
    if (cached) return cached;

    // Fetch from database
    const { data, error } = await supabase
      .from('book_stats_daily')
      .select('*')
      .eq('book_id', bookId)
      .gte('date', dateRange.from?.toISOString().split('T')[0] || '')
      .lte('date', dateRange.to?.toISOString().split('T')[0] || '')
      .order('date', { ascending: true });

    if (error) throw error;

    // Cache the result
    await setCache(cacheKey, data || [], 2 * 60 * 1000); // 2 minutes

    return data || [];
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return [];
  }
}

export async function getEngagementHeatmap(bookId: string): Promise<HeatmapData[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('get_engagement_heatmap', {
      p_book_id: bookId
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching heatmap:', error);
    return [];
  }
}

export async function getGeographyData(
  bookId: string,
  dateRange: DateRange
): Promise<GeographyData[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('get_geography_data', {
      p_book_id: bookId,
      p_start_date: dateRange.from?.toISOString().split('T')[0],
      p_end_date: dateRange.to?.toISOString().split('T')[0]
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching geography data:', error);
    return [];
  }
}

export async function getLiveReaders(bookId: string): Promise<{
  readers: LiveReader[];
  total: number;
}> {
  try {
    const supabase = await createClient();

    // Get active sessions from the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const { data, error } = await supabase
      .from('analytics_sessions')
      .select(`
        *,
        user:users(name, email, avatar_url)
      `)
      .eq('book_id', bookId)
      .eq('is_active', true)
      .gte('last_activity_at', fifteenMinutesAgo.toISOString())
      .order('last_activity_at', { ascending: false });

    if (error) throw error;

    return {
      readers: data || [],
      total: data?.length || 0,
    };
  } catch (error) {
    console.error('Error fetching live readers:', error);
    return { readers: [], total: 0 };
  }
}
