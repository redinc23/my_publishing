/**
 * MongoDB document types for Project Phoenix (WS2a / Task 2a.2).
 *
 * These model Atlas collections after cutover. Field names match the Phoenix
 * contract (snake_case) and the Phase 11 transform output.
 *
 * Roles: reader | author | partner | admin (never "editor" — Phoenix v4.0.1).
 */

import type { ObjectId } from 'mongodb';

/** Canonical app roles after Better Auth cutover. */
export type MongoRole = 'reader' | 'author' | 'partner' | 'admin';

export type MongoBookStatus = 'draft' | 'published' | 'archived';
export type MongoBookVisibility = 'public' | 'private' | 'unlisted';
export type MongoOrderStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface MongoTimestamps {
  created_at: Date;
  updated_at: Date;
}

/**
 * Application profile linked to a Better Auth user id.
 * Collection: `profiles`
 */
export interface Profile extends MongoTimestamps {
  _id?: ObjectId;
  auth_user_id: string;
  display_name: string;
  role: MongoRole;
  email?: string;
  bio?: string;
  avatar_url?: string;
  website?: string;
  stripe_customer_id?: string;
}

/**
 * Author record (may map 1:1 to a profile).
 * Collection: `authors`
 */
export interface Author extends MongoTimestamps {
  _id?: ObjectId;
  profile_id: ObjectId | string;
  pen_name: string;
  bio?: string | null;
  photo_url?: string | null;
  is_verified?: boolean;
  total_books?: number;
  royalty_rate?: number;
}

/**
 * Catalog book document.
 * Collection: `books`
 */
export interface Book extends MongoTimestamps {
  _id?: ObjectId;
  title: string;
  slug: string;
  description?: string;
  cover_url?: string | null;
  manuscript_url?: string | null;
  author_id: ObjectId | string;
  status: MongoBookStatus;
  visibility?: MongoBookVisibility;
  price?: number;
  currency?: string;
  genre?: string;
  tags?: string[];
  avg_rating: number;
  review_count: number;
  published_at?: Date | null;
}

/** Book row after `$lookup` on authors (getBooks / getBookBySlug). */
export interface BookWithAuthor extends Book {
  author?: Pick<Author, '_id' | 'pen_name' | 'photo_url' | 'bio'> | null;
}

/**
 * Embedded line item on an order (Phoenix: flattened into orders).
 */
export interface OrderItem {
  book_id: ObjectId | string;
  title?: string;
  quantity: number;
  unit_amount: number;
  currency?: string;
}

/**
 * Purchase order with embedded items.
 * Collection: `orders`
 * Idempotency key: `stripe_payment_intent_id` (unique sparse).
 */
export interface Order extends MongoTimestamps {
  _id?: ObjectId;
  user_id: string;
  status: MongoOrderStatus;
  amount: number;
  currency: string;
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  order_items: OrderItem[];
  refund_reason?: string | null;
}

/**
 * Book review driving avg_rating / review_count aggregates.
 * Collection: `reviews`
 */
export interface Review extends MongoTimestamps {
  _id?: ObjectId;
  book_id: ObjectId | string;
  user_id: string;
  rating: number;
  title?: string;
  content?: string;
  helpful_count?: number;
  verified_purchase?: boolean;
}

/**
 * Per-user reading position.
 * Collection: `reading_progress`
 */
export interface ReadingProgress extends MongoTimestamps {
  _id?: ObjectId;
  user_id: string;
  book_id: ObjectId | string;
  position?: number;
  percentage?: number;
  chapter_id?: string | null;
  last_read_at?: Date;
}

/**
 * Admin / security audit trail.
 * Collection: `audit_logs`
 */
export interface AuditLog {
  _id?: ObjectId;
  actor_id: string;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

/** Pagination input shared by list/search helpers. */
export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
