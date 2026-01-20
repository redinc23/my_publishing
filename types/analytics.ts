/**
 * Analytics Types
 * Comprehensive type definitions for analytics tracking and reporting
 */

export type AnalyticsEventType = 
  | 'view' 
  | 'read' 
  | 'purchase' 
  | 'download' 
  | 'share'
  | 'bookmark'
  | 'review'
  | 'search'
  | 'click';

export type TimePeriod = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
export type MetricType = 'views' | 'unique_views' | 'purchases' | 'revenue' | 'conversions';
export type DeviceType = 'desktop' | 'mobile' | 'tablet';

/**
 * Raw analytics event as stored in database
 */
export interface AnalyticsEvent {
  id: string;
  book_id: string;
  user_id?: string;
  session_id: string;
  event_type: AnalyticsEventType;
  event_data?: Record<string, unknown>;
  referrer?: string;
  user_agent?: string;
  ip_address?: string;
  country?: string;
  device_type?: DeviceType;
  created_at: string;
}

/**
 * Aggregated book statistics
 */
export interface BookStats {
  id?: string;
  book_id: string;
  date: string;
  views: number;
  unique_views?: number;
  unique_users: number;
  reads?: number;
  purchases: number;
  revenue?: number;
  shares?: number;
  bookmarks?: number;
  avg_read_time_seconds?: number;
  downloads?: number;
  completion_rate?: number;
  bounce_rate?: number;
  avg_time_spent?: number;
}

/**
 * Summary statistics for a book
 */
export interface BookStatsSummary {
  book_id: string;
  book_title: string;
  total_views: number;
  unique_viewers: number;
  total_purchases: number;
  total_revenue: number;
  conversion_rate: number;
  avg_read_time_seconds: number;
  period: TimePeriod;
  period_start: string;
  period_end: string;
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  change_percent?: number;
}

/**
 * Analytics dashboard data
 */
export interface DashboardAnalytics {
  summary: {
    total_views: number;
    total_purchases: number;
    total_revenue: number;
    unique_visitors: number;
    conversion_rate: number;
  };
  trends: {
    views: TimeSeriesDataPoint[];
    revenue: TimeSeriesDataPoint[];
    purchases: TimeSeriesDataPoint[];
  };
  top_books: BookStatsSummary[];
  recent_events: AnalyticsEvent[];
  period: TimePeriod;
}

/**
 * Request to track an analytics event
 */
export interface TrackEventRequest {
  book_id: string;
  event_type: AnalyticsEventType;
  session_id: string;
  event_data?: Record<string, unknown>;
  referrer?: string;
}

/**
 * Response from tracking an event
 */
export interface TrackEventResponse {
  success: boolean;
  event_id?: string;
  error?: string;
}

/**
 * Query parameters for analytics
 */
export interface AnalyticsQuery {
  book_id?: string;
  book_ids?: string[];
  author_id?: string;
  event_types?: AnalyticsEventType[];
  period?: TimePeriod;
  start_date?: string | Date;
  end_date?: string | Date;
  group_by?: 'hour' | 'day' | 'week' | 'month';
  limit?: number;
  offset?: number;
}

/**
 * Geographic analytics data
 */
export interface GeoAnalytics {
  country: string;
  country_code: string;
  views: number;
  purchases: number;
  revenue: number;
  percentage: number;
}

/**
 * Device analytics data
 */
export interface DeviceAnalytics {
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  views: number;
  purchases: number;
  percentage: number;
}

/**
 * Referrer analytics data
 */
export interface ReferrerAnalytics {
  referrer: string;
  referrer_domain: string;
  views: number;
  purchases: number;
  conversion_rate: number;
}

/**
 * Real-time analytics snapshot
 */
export interface RealTimeAnalytics {
  active_users: number;
  events_last_minute: number;
  events_last_hour: number;
  current_page_views: {
    book_id: string;
    book_title: string;
    active_viewers: number;
  }[];
  timestamp: string;
}

/**
 * Funnel analytics for conversion tracking
 */
export interface FunnelStep {
  name: string;
  event_type: AnalyticsEventType;
  count: number;
  conversion_rate: number;
  drop_off_rate: number;
}

export interface FunnelAnalytics {
  book_id: string;
  steps: FunnelStep[];
  overall_conversion_rate: number;
  period: TimePeriod;
}

/**
 * Cohort analysis data
 */
export interface CohortData {
  cohort_date: string;
  cohort_size: number;
  retention: {
    day: number;
    users: number;
    retention_rate: number;
  }[];
}

/**
 * A/B test analytics
 */
export interface ABTestAnalytics {
  test_id: string;
  test_name: string;
  variants: {
    name: string;
    views: number;
    conversions: number;
    conversion_rate: number;
    statistical_significance?: number;
  }[];
  winner?: string;
  status: 'running' | 'completed' | 'paused';
}

/**
 * Analytics Session (for compatibility with existing code)
 */
export interface AnalyticsSession {
  id: string;
  session_id: string;
  book_id: string;
  user_id?: string;
  device_id?: string;
  
  started_at: string;
  last_activity_at: string;
  ended_at?: string;
  
  total_events: number;
  total_duration: number;
  pages_viewed: number;
  chapters_read: number[];
  max_progress: number;
  
  device_type?: DeviceType;
  country_code?: string;
  city?: string;
  
  is_active: boolean;
  created_at: string;
}

/**
 * Date Range for analytics queries
 */
export interface DateRange {
  from?: Date;
  to?: Date;
}

/**
 * Heatmap data for engagement visualization
 */
export interface HeatmapData {
  chapter_number: number;
  chapter_title: string;
  views: number;
  completions: number;
  avg_time_spent: number;
  drop_off_rate: number;
  country_code?: string;
}

/**
 * Geography data for maps
 */
export interface GeographyData {
  country: string;
  country_name?: string;
  country_code: string;
  count: number;
  percentage: number;
  readers?: number;
  sessions?: number;
  avg_engagement?: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

/**
 * Overview stats for analytics dashboard
 */
export interface OverviewStats {
  totalViews: number;
  uniqueReaders: number;
  totalDownloads: number;
  completionRate: number;
  avgReadTime: number;
  revenue: number;
  countriesReached: number;
  growthRate: number;
}

/**
 * Live reader information
 */
export interface LiveReader extends AnalyticsSession {
  user?: {
    name?: string;
    email?: string;
    avatar_url?: string;
  };
  current_chapter?: string;
  reading_progress?: number;
  time_in_session?: number;
}

/**
 * Insight for AI-powered analytics
 */
export interface Insight {
  type: 'performance' | 'engagement' | 'recommendation' | 'prediction';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  icon: React.ReactNode;
}