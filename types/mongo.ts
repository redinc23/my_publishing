/**
 * MongoDB document types for Project Phoenix (WS2a.2).
 * Better Auth manages `user`, `account`, `session`, `verification` collections.
 */

import type { ObjectId } from 'mongodb';
import type { ManguRole } from '@/lib/auth/roles';

export type MongoId = ObjectId | string;

export type BookStatus = 'draft' | 'published' | 'archived';
export type BookVisibility = 'public' | 'private' | 'unlisted';
export type OrderStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Profile {
  _id?: ObjectId;
  auth_user_id: string;
  display_name: string;
  role: ManguRole;
  email?: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Author {
  _id?: ObjectId;
  profile_id: ObjectId | string;
  pen_name?: string;
  bio?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface Book {
  _id?: ObjectId;
  title: string;
  slug: string;
  description?: string;
  cover_url?: string;
  manuscript_url?: string;
  author_id: ObjectId | string;
  status: BookStatus;
  visibility?: BookVisibility;
  price?: number;
  currency?: string;
  genre?: string;
  tags?: string[];
  content_type?: 'book' | 'comic' | 'paper';
  avg_rating: number;
  review_count: number;
  total_reads?: number;
  is_featured?: boolean;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  book_id: ObjectId | string;
  unit_price: number;
  quantity?: number;
  title?: string;
  cover_url?: string;
}

export interface Order {
  _id?: ObjectId;
  user_id: ObjectId | string;
  order_number?: string;
  total_amount: number;
  currency: string;
  status: OrderStatus;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  order_items: OrderItem[];
  created_at: Date;
  updated_at: Date;
}

export interface Review {
  _id?: ObjectId;
  book_id: ObjectId | string;
  user_id: ObjectId | string;
  rating: number;
  title?: string;
  body?: string;
  is_verified_purchase?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ReadingProgress {
  _id?: ObjectId;
  user_id: ObjectId | string;
  book_id: ObjectId | string;
  current_position: number;
  is_finished?: boolean;
  finished_at?: Date;
  last_accessed: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface AuditLog {
  _id?: ObjectId;
  actor_id: string;
  action: string;
  target: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

/** Book row with joined author for catalog surfaces. */
export interface BookWithAuthor extends Book {
  author?: {
    _id?: ObjectId;
    pen_name?: string;
    profile?: Pick<Profile, 'display_name' | 'avatar_url'>;
  };
}

export interface OrderWithBooks extends Order {
  books?: Array<Pick<Book, '_id' | 'title' | 'cover_url' | 'slug' | 'author_id'>>;
}

export const MONGO_COLLECTIONS = {
  profiles: 'profiles',
  authors: 'authors',
  books: 'books',
  orders: 'orders',
  reviews: 'reviews',
  reading_progress: 'reading_progress',
  audit_logs: 'audit_logs',
} as const;
