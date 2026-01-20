/**
 * Validation Schemas
 * Comprehensive Zod schemas for all input validation
 */

import { z } from 'zod';

// ============================================
// PRIMITIVE SCHEMAS
// ============================================

/** UUID validation */
export const UUIDSchema = z.string().uuid({ message: 'Invalid UUID format' });

/** Email validation */
export const EmailSchema = z.string().email({ message: 'Invalid email address' });

/** URL validation */
export const URLSchema = z.string().url({ message: 'Invalid URL format' });

/** Slug validation (lowercase, hyphens, alphanumeric) */
export const SlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(100, 'Slug must be less than 100 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

/** Safe string (no XSS) */
export const SafeStringSchema = z
  .string()
  .transform((val) => val.replace(/<[^>]*>/g, '').trim());

/** Positive integer */
export const PositiveIntSchema = z.number().int().positive();

/** Non-negative number */
export const NonNegativeNumberSchema = z.number().min(0);

/** Currency code (ISO 4217) */
export const CurrencyCodeSchema = z.string().length(3).toUpperCase();

// ============================================
// BOOK SCHEMAS
// ============================================

export const BookIdSchema = z.string().uuid({ message: 'Invalid book ID' });

export const BookStatusSchema = z.enum(['draft', 'published', 'archived'], {
  errorMap: () => ({ message: 'Status must be draft, published, or archived' }),
});

export const BookVisibilitySchema = z.enum(['public', 'private', 'unlisted'], {
  errorMap: () => ({ message: 'Visibility must be public, private, or unlisted' }),
});

export const CreateBookSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .transform((val) => val.trim()),
  description: z
    .string()
    .max(5000, 'Description must be less than 5000 characters')
    .optional()
    .transform((val) => val?.trim()),
  slug: SlugSchema.optional(),
  price: z
    .number()
    .min(0, 'Price cannot be negative')
    .max(10000, 'Price cannot exceed 10000')
    .default(0),
  currency: CurrencyCodeSchema.default('USD'),
  genre: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  visibility: BookVisibilitySchema.default('private'),
});

export const UpdateBookSchema = CreateBookSchema.partial().extend({
  status: BookStatusSchema.optional(),
});

// ============================================
// DATE & TIME SCHEMAS
// ============================================

export const DateRangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return data.from <= data.to;
      }
      return true;
    },
    { message: 'From date must be before or equal to to date' }
  )
  .refine(
    (data) => {
      if (data.from) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return data.from >= oneYearAgo;
      }
      return true;
    },
    { message: 'From date cannot be more than 1 year in the past' }
  );

export const TimePeriodSchema = z.enum(['hour', 'day', 'week', 'month', 'year', 'all']);

// ============================================
// EXPORT SCHEMAS
// ============================================

export const ExportFormatSchema = z.enum(['csv', 'json', 'excel'], {
  errorMap: () => ({ message: 'Format must be csv, json, or excel' }),
});

export const ExportTypeSchema = z.enum(['analytics', 'revenue', 'readers', 'orders']);

export const CreateExportSchema = z.object({
  type: ExportTypeSchema,
  book_id: BookIdSchema.optional(),
  date_range: DateRangeSchema.optional(),
  format: ExportFormatSchema.default('csv'),
});

// ============================================
// ANALYTICS SCHEMAS
// ============================================

export const AnalyticsEventTypeSchema = z.enum([
  'view',
  'read',
  'purchase',
  'download',
  'share',
  'bookmark',
  'review',
  'search',
  'click',
]);

export const AnalyticsEventSchema = z.object({
  book_id: BookIdSchema,
  event_type: AnalyticsEventTypeSchema,
  session_id: z
    .string()
    .min(10, 'Session ID must be at least 10 characters')
    .max(100, 'Session ID must be less than 100 characters'),
  event_data: z.record(z.unknown()).optional(),
  referrer: URLSchema.optional().or(z.literal('')),
});

export const AnalyticsQuerySchema = z.object({
  book_id: BookIdSchema.optional(),
  book_ids: z.array(BookIdSchema).max(50).optional(),
  event_types: z.array(AnalyticsEventTypeSchema).optional(),
  period: TimePeriodSchema.default('day'),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  group_by: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

// ============================================
// RECOMMENDATION SCHEMAS
// ============================================

export const RecommendRequestSchema = z.object({
  user_id: UUIDSchema.optional(),
  limit: z.number().int().min(1).max(50).default(10),
  genre: z.string().max(50).optional(),
  exclude_book_ids: z.array(BookIdSchema).max(100).default([]),
  include_nsfw: z.boolean().default(false),
});

// ============================================
// USER & AUTH SCHEMAS
// ============================================

export const UserIdSchema = z.string().uuid({ message: 'Invalid user ID' });

export const ProfileUpdateSchema = z.object({
  full_name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  bio: z.string().max(1000, 'Bio must be less than 1000 characters').optional(),
  website: URLSchema.optional().or(z.literal('')),
  twitter_handle: z
    .string()
    .max(15)
    .regex(/^[a-zA-Z0-9_]*$/, 'Invalid Twitter handle')
    .optional()
    .or(z.literal('')),
});

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be less than 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const SignUpSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  full_name: z.string().min(1).max(100).optional(),
});

export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});

// ============================================
// ORDER & PAYMENT SCHEMAS
// ============================================

export const OrderStatusSchema = z.enum(['pending', 'completed', 'failed', 'refunded']);

export const CreateOrderSchema = z.object({
  book_id: BookIdSchema,
  coupon_code: z.string().max(50).optional(),
});

export const RefundRequestSchema = z.object({
  order_id: UUIDSchema,
  reason: z
    .string()
    .min(10, 'Please provide a reason for the refund')
    .max(1000, 'Reason must be less than 1000 characters'),
});

// ============================================
// REVIEW SCHEMAS
// ============================================

export const CreateReviewSchema = z.object({
  book_id: BookIdSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  content: z.string().max(5000).optional(),
});

export const UpdateReviewSchema = CreateReviewSchema.partial().omit({ book_id: true });

// ============================================
// PAGINATION SCHEMAS
// ============================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().max(50).optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================
// SEARCH SCHEMAS
// ============================================

export const SearchQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(200, 'Search query must be less than 200 characters')
    .transform((val) => val.trim()),
  filters: z
    .object({
      genre: z.string().optional(),
      min_price: z.number().min(0).optional(),
      max_price: z.number().max(10000).optional(),
      min_rating: z.number().min(1).max(5).optional(),
      author_id: UUIDSchema.optional(),
    })
    .optional(),
  ...PaginationSchema.shape,
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate input and return typed result or throw
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Validate input and return safe result
 */
export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Format Zod errors into user-friendly messages
 */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.errors.map((err) => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
}

/**
 * Get first error message from Zod error
 */
export function getFirstError(error: z.ZodError): string {
  const firstError = error.errors[0];
  if (!firstError) return 'Validation error';
  const path = firstError.path.join('.');
  return path ? `${path}: ${firstError.message}` : firstError.message;
}