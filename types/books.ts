import { z } from 'zod';

export type BookStatus = 'draft' | 'published' | 'archived';

// Zod schemas for validation
export const BookStatusSchema = z.enum(['draft', 'published', 'archived']);
export const LanguageSchema = z.string().regex(/^[a-z]{2,3}$/);
export const ISBNSchema = z.string().regex(/^(?:\d{9}[\dX]|\d{13})$/);

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  author_id: string;
  author_name: string;
  
  isbn?: string;
  language: string;
  page_count?: number;
  word_count?: number;
  
  status: BookStatus;
  published_at?: string;
  
  cover_url?: string;
  epub_url?: string;
  manuscript_url?: string;
  
  view_count: number;
  download_count: number;
  average_rating: number;
  review_count: number;
  
  // Metadata
  metadata?: BookMetadata;
  tags?: string[];
  categories?: string[];
  
  // SEO
  slug: string;
  seo_title?: string;
  seo_description?: string;
  
  // Soft delete
  deleted_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface BookMetadata {
  chapters?: number;
  reading_time_minutes?: number;
  maturity_rating?: 'G' | 'PG' | 'PG-13' | 'R' | 'NC-17';
  content_warnings?: string[];
  accessibility_features?: string[];
}

export interface CreateBookInput {
  title: string;
  subtitle?: string;
  description?: string;
  genre: string;
  language?: string;
  isbn?: string;
  categories?: string[];
  tags?: string[];
  metadata?: Partial<BookMetadata>;
  cover_url?: string;
  epub_url?: string;
  manuscript_url?: string;
}

export interface UpdateBookInput extends Partial<CreateBookInput> {
  status?: BookStatus;
  cover_url?: string;
  epub_url?: string;
  manuscript_url?: string;
  page_count?: number;
  word_count?: number;
  slug?: string;
  seo_title?: string;
  seo_description?: string;
}

export interface BookStats {
  total_views: number;
  total_downloads: number;
  average_rating: number;
  total_reviews: number;
  monthly_trends: {
    month: string;
    views: number;
    downloads: number;
  }[];
}

export interface BookSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  author_name: string;
  cover_url?: string;
  average_rating: number;
  relevance: number;
  match_snippet: string;
}

// Validation schemas
export const CreateBookSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  genre: z.string().min(1).max(100),
  language: LanguageSchema.default('en'),
  isbn: ISBNSchema.optional(),
  categories: z.array(z.string()).max(10).optional(),
  tags: z.array(z.string()).max(20).optional(),
  metadata: z.object({
    chapters: z.number().int().positive().optional(),
    reading_time_minutes: z.number().int().positive().optional(),
    maturity_rating: z.enum(['G', 'PG', 'PG-13', 'R', 'NC-17']).optional(),
    content_warnings: z.array(z.string()).optional(),
    accessibility_features: z.array(z.string()).optional(),
  }).optional(),
});

export const UpdateBookSchema = CreateBookSchema.partial().extend({
  status: BookStatusSchema.optional(),
  cover_url: z.string().url().optional(),
  epub_url: z.string().url().optional(),
  manuscript_url: z.string().url().optional(),
  page_count: z.number().int().positive().optional(),
  word_count: z.number().int().positive().optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  seo_title: z.string().max(60).optional(),
  seo_description: z.string().max(160).optional(),
});
