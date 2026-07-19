/**
 * Reader Engagement validation schemas
 * bookmarks / highlights+notes / wishlist / author follows
 */

import { z } from 'zod';

const uuid = (field: string) => z.string().uuid(`${field} must be a valid UUID`);

// ============================================
// SHARED
// ============================================

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'] as const;
export const HighlightColorSchema = z.enum(HIGHLIGHT_COLORS);

const locatorSchema = (field: string) =>
  z
    .string({ required_error: `${field} is required` })
    .min(1, `${field} is required`)
    .max(2048, `${field} is too long`);

// ============================================
// BOOKMARKS
// ============================================

export const CreateBookmarkSchema = z
  .object({
    book_id: uuid('book_id'),
    position: locatorSchema('position'),
    label: z.string().max(200, 'label must be 200 characters or fewer').trim().optional(),
  })
  .strict();

export const DeleteBookmarkSchema = z
  .object({
    id: uuid('id'),
  })
  .strict();

export const ListBookmarksQuerySchema = z
  .object({
    book_id: uuid('book_id').optional(),
  })
  .strict();

// ============================================
// HIGHLIGHTS
// ============================================

export const CreateHighlightSchema = z
  .object({
    book_id: uuid('book_id'),
    selected_text: z
      .string({ required_error: 'selected_text is required' })
      .min(1, 'selected_text is required')
      .max(8000, 'selected_text must be 8000 characters or fewer'),
    position: z.string().max(2048, 'position is too long').optional(),
    color: HighlightColorSchema.default('yellow'),
    note: z.string().max(5000, 'note must be 5000 characters or fewer').optional(),
  })
  .strict();

export const UpdateHighlightSchema = z
  .object({
    id: uuid('id'),
    color: HighlightColorSchema.optional(),
    note: z.string().max(5000, 'note must be 5000 characters or fewer').nullable().optional(),
  })
  .strict()
  .refine(
    (v: { color?: HighlightColor; note?: string | null }) =>
      v.color !== undefined || v.note !== undefined,
    {
      message: 'Provide at least one field to update (color or note)',
    }
  );

export const DeleteHighlightSchema = z
  .object({
    id: uuid('id'),
  })
  .strict();

export const ListHighlightsQuerySchema = z
  .object({
    book_id: uuid('book_id').optional(),
    /** 'true' → only highlights that have a note attached */
    with_notes: z.enum(['true', 'false']).optional(),
  })
  .strict();

// ============================================
// WISHLIST
// ============================================

export const WishlistMutationSchema = z
  .object({
    book_id: uuid('book_id'),
  })
  .strict();

export const WishlistQuerySchema = z
  .object({
    book_id: uuid('book_id').optional(),
  })
  .strict();

// ============================================
// AUTHOR FOLLOWS
// ============================================

export const AuthorFollowMutationSchema = z
  .object({
    author_id: uuid('author_id'),
  })
  .strict();

export const AuthorFollowQuerySchema = z
  .object({
    author_id: uuid('author_id').optional(),
  })
  .strict();

// ============================================
// INFERRED TYPES
// ============================================

export type CreateBookmarkInput = z.infer<typeof CreateBookmarkSchema>;
export type CreateHighlightInput = z.infer<typeof CreateHighlightSchema>;
export type UpdateHighlightInput = z.infer<typeof UpdateHighlightSchema>;
export type WishlistMutationInput = z.infer<typeof WishlistMutationSchema>;
export type AuthorFollowMutationInput = z.infer<typeof AuthorFollowMutationSchema>;
export type HighlightColor = z.infer<typeof HighlightColorSchema>;
