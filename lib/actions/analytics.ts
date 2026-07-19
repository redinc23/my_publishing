'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { DateRange } from '@/types/analytics';
import type { BookStats, HeatmapData, GeographyData, LiveReader } from '@/types/analytics';
import { getCache, setCache } from '@/lib/services/cache-service';
import { requireAuthorOwnedBook } from '@/lib/supabase/author-ownership';

export async function getBookAnalytics(bookId: string, dateRange: DateRange): Promise<BookStats[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    await requireAuthorOwnedBook(user.id, bookId);

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    await requireAuthorOwnedBook(user.id, bookId);

    const { data, error } = await supabase.rpc('get_engagement_heatmap', {
      p_book_id: bookId,
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    await requireAuthorOwnedBook(user.id, bookId);

    const { data, error } = await supabase.rpc('get_geography_data', {
      p_book_id: bookId,
      p_start_date: dateRange.from?.toISOString().split('T')[0],
      p_end_date: dateRange.to?.toISOString().split('T')[0],
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    await requireAuthorOwnedBook(user.id, bookId);

    // Get active sessions from the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const { data: sessions, error } = await supabase
      .from('analytics_sessions')
      .select('*')
      .eq('book_id', bookId)
      .eq('is_active', true)
      .gte('last_activity_at', fifteenMinutesAgo.toISOString())
      .order('last_activity_at', { ascending: false });

    if (error) throw error;

    const userIds = Array.from(
      new Set((sessions || []).map((session) => session.user_id).filter(Boolean))
    ) as string[];

    const profilesByUserId = new Map<string, { name?: string }>();
    if (userIds.length > 0) {
      // Ownership has already been verified above. Use the server-only client
      // for the narrow display-name lookup so public_profiles does not need to
      // bypass profiles RLS as a SECURITY DEFINER view.
      const { data: profiles, error: profilesError } = await createAdminClient()
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      for (const profile of profiles || []) {
        profilesByUserId.set(profile.user_id, { name: profile.full_name ?? undefined });
      }
    }

    const readers: LiveReader[] = (sessions || []).map((session) => ({
      ...session,
      user: session.user_id ? profilesByUserId.get(session.user_id) : undefined,
      reading_progress: session.max_progress ?? undefined,
    }));

    return {
      readers,
      total: readers.length,
    };
  } catch (error) {
    console.error('Error fetching live readers:', error);
    return { readers: [], total: 0 };
  }
}
