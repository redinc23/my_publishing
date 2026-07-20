/**
 * MongoDB document types for Project Phoenix (WS2a).
 *
 * Distinct from the legacy Supabase-shaped types in `types/index.ts`.
 * Prefer importing from `@/types/mongo` (or `Mongo*` aliases from `@/types`).
 *
 * Roles: reader | author | partner | admin (no `editor` — Phoenix v4.0.1).
 */

import type { ObjectId } from 'mongodb';

export type ManguRole = 'reader' | 'author' | 'partner' | 'admin';

export type BookStatus = 'draft' | 'published' | 'archived';
export type BookVisibility = 'public' | 'private' | 'unlisted';
export type OrderStatus = 'pending' | 'completed' | 'failed' | 'refunded';

/** Profile document in `profiles` (created by Better Auth user.create hook). */
export interface Profile {
  _id: ObjectId;
  auth_user_id: string;
  display_name: string;
  role: ManguRole;
  email?: string;
  bio?: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Author {
  _id: ObjectId;
  profile_id: ObjectId | string;
  pen_name: string;
  bio?: string | null;
  photo_url?: string | null;
  is_verified: boolean;
  total_books: number;
  royalty_rate?: number;
  created_at: Date;
  updated_at: Date;
}

export interface Book {
  _id: ObjectId;
  title: string;
  slug: string;
  description?: string;
  cover_url?: string | null;
  manuscript_url?: string | null;
  author_id: ObjectId | string;
  status: BookStatus;
  visibility?: BookVisibility;
  price?: number;
  /** Optional sale price used by checkout when lower than `price`. */
  discount_price?: number | null;
  currency?: string;
  genre?: string;
  tags?: string[];
  avg_rating: number;
  review_count: number;
  content_type?: 'book' | 'comic' | 'paper';
  published_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Book row after `$lookup` on authors (0–1 author). */
export interface BookWithAuthor extends Book {
  author?: Author | null;
}

export interface OrderItem {
  book_id: ObjectId | string;
  title: string;
  quantity: number;
  unit_amount: number;
  currency: string;
}

/**
 * Order with embedded line items (Phoenix flatten — not a separate collection).
 * Unique sparse index on `stripe_payment_intent_id` for webhook idempotency.
 */
export interface Order {
  _id: ObjectId;
  user_id: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  order_items: OrderItem[];
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  refund_reason?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Review {
  _id: ObjectId;
  book_id: ObjectId | string;
  user_id: string;
  rating: number;
  title?: string;
  content?: string;
  helpful_count: number;
  verified_purchase: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ReadingProgress {
  _id: ObjectId;
  user_id: string;
  book_id: ObjectId | string;
  current_position: number;
  is_finished: boolean;
  rating?: number | null;
  finished_at?: Date | null;
  last_accessed?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AuditLog {
  _id: ObjectId;
  actor_id: string;
  action: string;
  target: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

/** Shared pagination for query helpers (default page size 20). */
export interface MongoPagination {
  page?: number;
  perPage?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
