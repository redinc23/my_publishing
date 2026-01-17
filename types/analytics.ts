export type EventType = 'view' | 'read' | 'purchase' | 'download' | 'share';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface AnalyticsEvent {
  id: string;
  book_id: string;
  user_id?: string;
  session_id: string;
  device_id?: string;
  event_type: EventType;
  event_data?: Record<string, any>;
  
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
  
  country_code?: string;
  region?: string;
  city?: string;
  
  device_type?: DeviceType;
  browser?: string;
  os?: string;
  
  chapter_id?: string;
  chapter_number?: number;
  reading_progress?: number;
  time_spent?: number;
  scroll_depth?: number;
  
  created_at: string;
}

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
  
  is_active: boolean;
  engagement_score: number;
  bounce_rate: boolean;
  
  entry_page?: string;
  exit_page?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  
  device_type?: DeviceType;
  browser?: string;
  os?: string;
  country_code?: string;
  region?: string;
  city?: string;
  
  created_at: string;
  updated_at: string;
}

export interface BookStats {
  id: string;
  date: string;
  book_id: string;
  
  views: number;
  unique_views: number;
  
  unique_users: number;
  unique_sessions: number;
  total_read_time: number;
  avg_read_time: number;
  
  total_events: number;
  completions: number;
  completion_rate: number;
  avg_engagement_score: number;
  bounce_rate: number;
  
  purchases: number;
  downloads: number;
  shares: number;
  
  countries_reached: number;
  top_countries: Array<{ code: string; count: number }>;
  
  mobile_percentage: number;
  tablet_percentage: number;
  desktop_percentage: number;
  
  direct_traffic: number;
  referral_traffic: number;
  social_traffic: number;
  search_traffic: number;
  
  created_at: string;
  updated_at: string;
}

export interface HeatmapData {
  chapter_id: string;
  chapter_number: number;
  chapter_title: string;
  views: number;
  unique_readers: number;
  completions: number;
  drop_off_rate: number;
  avg_time_spent: number;
  engagement_score: number;
}

export interface GeographyData {
  country_code: string;
  country_name: string;
  readers: number;
  sessions: number;
  avg_engagement: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface LiveReader {
  id: string;
  session_id: string;
  book_id: string;
  user_id?: string;
  current_chapter?: string;
  current_chapter_number?: number;
  reading_progress?: number;
  time_in_session?: number;
  total_events: number;
  total_duration: number;
  is_active: boolean;
  last_activity_at: string;
  created_at: string;
  user?: {
    name?: string;
    email?: string;
    avatar_url?: string;
  };
}

export interface AnalyticsOverview {
  totalViews: number;
  uniqueReaders: number;
  totalDownloads: number;
  completionRate: number;
  avgReadTime: number;
  revenue: number;
  countriesReached: number;
  growthRate: number;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface DeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
}

export interface TrafficSource {
  source: string;
  count: number;
  percentage: number;
}

export interface ConversionFunnel {
  stage: string;
  count: number;
  percentage: number;
  dropOff: number;
}

export interface ReaderDemographics {
  age_groups: Record<string, number>;
  gender_distribution: Record<string, number>;
  top_genres: string[];
  reading_frequency: Record<string, number>;
}