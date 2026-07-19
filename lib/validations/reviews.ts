/**
 * Validation schemas for the public reviews API (/api/reviews/*).
 */

import { z } from 'zod';

export const REVIEW_SORTS = ['helpful', 'recent', 'highest', 'lowest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

/** GET /api/reviews?bookId=&sort=&page=&limit= */
export const ReviewsQuerySchema = z.object({
  bookId: z.string().uuid({ message: 'Invalid book ID' }),
  sort: z.enum(REVIEW_SORTS).default('helpful'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** POST /api/reviews — create or update the caller's review for a book. */
export const CreateReviewSchema = z.object({
  book_id: z.string().uuid({ message: 'Invalid book ID' }),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  title: z
    .string()
    .max(100, 'Title must be 100 characters or fewer')
    .transform((val) => val.replace(/<[^>]*>/g, '').trim())
    .optional(),
  content: z
    .string({ required_error: 'Review content is required' })
    .min(10, 'Review must be at least 10 characters')
    .max(5000, 'Review must be 5000 characters or fewer')
    .transform((val) => val.trim()),
  is_spoiler: z.boolean().default(false),
});

/**
 * POST /api/reviews/[id]/helpful
 * helpful=true/false casts/replaces a vote; helpful=null removes the vote.
 */
export const HelpfulVoteSchema = z.object({
  helpful: z.boolean().nullable(),
});

/** Author reply body (server action + any future route). */
export const AuthorReplySchema = z.object({
  reply: z
    .string({ required_error: 'Reply is required' })
    .min(1, 'Reply cannot be empty')
    .max(2000, 'Reply must be 2000 characters or fewer')
    .transform((val) => val.trim()),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type HelpfulVoteInput = z.infer<typeof HelpfulVoteSchema>;
