/**
 * Export Types
 * Comprehensive type definitions for data export functionality
 */

export type ExportType = 'analytics' | 'revenue' | 'readers' | 'orders';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ExportFormat = 'csv' | 'json' | 'excel';

/**
 * Export Job - Represents an async export task
 */
export interface ExportJob {
  id: string;
  user_id: string;
  type: ExportType;
  status: ExportStatus;
  parameters: ExportParameters;
  result_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

/**
 * Parameters for creating an export job
 */
export interface ExportParameters {
  book_id?: string;
  date_range?: ExportDateRange;
  format?: ExportFormat;
  include_headers?: boolean;
  filters?: ExportFilters;
}

/**
 * Date range for filtering exports
 */
export interface ExportDateRange {
  from?: Date | string;
  to?: Date | string;
}

/**
 * Optional filters for exports
 */
export interface ExportFilters {
  event_types?: string[];
  user_ids?: string[];
  status?: string[];
  min_amount?: number;
  max_amount?: number;
}

/**
 * Result of an export operation
 */
export interface ExportResult {
  success: boolean;
  data?: string | Buffer | ArrayBuffer;
  error?: string;
  format?: ExportFormat;
  filename?: string;
  mime_type?: string;
  byte_size?: number;
}

/**
 * Export progress tracking
 */
export interface ExportProgress {
  job_id: string;
  status: ExportStatus;
  progress_percent: number;
  rows_processed: number;
  total_rows: number;
  estimated_time_remaining?: number;
  current_step?: string;
}

/**
 * Request to create a new export
 */
export interface CreateExportRequest {
  type: ExportType;
  book_id?: string;
  date_range?: ExportDateRange;
  format?: ExportFormat;
}

/**
 * Response from export creation
 */
export interface CreateExportResponse {
  success: boolean;
  job?: ExportJob;
  error?: string;
}

/**
 * Analytics export specific data
 */
export interface AnalyticsExportRow {
  date: string;
  event_type: string;
  book_id: string;
  book_title: string;
  user_id?: string;
  session_id: string;
  event_data?: Record<string, unknown>;
  created_at: string;
}

/**
 * Revenue export specific data
 */
export interface RevenueExportRow {
  date: string;
  order_id: string;
  book_id: string;
  book_title: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  created_at: string;
}

/**
 * Readers export specific data
 */
export interface ReadersExportRow {
  user_id: string;
  email?: string;
  books_purchased: number;
  total_spent: number;
  first_purchase_at: string;
  last_purchase_at: string;
  favorite_genres?: string[];
}