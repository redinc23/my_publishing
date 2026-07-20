#!/usr/bin/env tsx
/**
 * Ensure core MANGU collections + indexes exist on Atlas.
 * Safe to re-run. Usage: npm run db:mongo:indexes
 *
 * Phoenix contract: orders embed `order_items[]`; unique sparse index on
 * `stripe_payment_intent_id` for webhook idempotency. Text index on books
 * powers `searchBooks`.
 */

import { loadDotEnvLocal } from './lib/env-file';
import { getDb, isMongoConfigured, __resetMongoClientForTests } from '../lib/mongodb';

async function main(): Promise<void> {
  loadDotEnvLocal();
  __resetMongoClientForTests();

  if (!isMongoConfigured()) {
    console.error('MONGODB_URI not set. Run: npm run db:atlas:bootstrap');
    process.exit(1);
  }

  const db = await getDb();
  console.log(`Ensuring indexes on db="${db.databaseName}"…`);

  await db.collection('profiles').createIndexes([
    { key: { auth_user_id: 1 }, unique: true, name: 'profiles_auth_user_id_uq' },
    { key: { email: 1 }, unique: true, sparse: true, name: 'profiles_email_uq' },
    { key: { role: 1 }, name: 'profiles_role' },
  ]);

  await db.collection('authors').createIndexes([
    { key: { profile_id: 1 }, unique: true, name: 'authors_profile_id_uq' },
    { key: { pen_name: 1 }, name: 'authors_pen_name' },
  ]);

  await db.collection('books').createIndexes([
    { key: { slug: 1 }, unique: true, name: 'books_slug_uq' },
    { key: { status: 1, visibility: 1 }, name: 'books_status_visibility' },
    { key: { author_id: 1 }, name: 'books_author_id' },
    { key: { created_at: -1 }, name: 'books_created_at' },
    {
      key: { title: 'text', description: 'text', tags: 'text' },
      name: 'books_text_search',
      weights: { title: 10, tags: 5, description: 1 },
    },
  ]);

  await db.collection('orders').createIndexes([
    {
      key: { stripe_payment_intent_id: 1 },
      unique: true,
      sparse: true,
      name: 'orders_stripe_payment_intent_uq',
    },
    {
      key: { stripe_session_id: 1 },
      unique: true,
      sparse: true,
      name: 'orders_stripe_session_uq',
    },
    { key: { user_id: 1, created_at: -1 }, name: 'orders_user_created' },
  ]);

  await db.collection('reviews').createIndexes([
    { key: { book_id: 1, user_id: 1 }, unique: true, name: 'reviews_book_user_uq' },
    { key: { book_id: 1 }, name: 'reviews_book_id' },
  ]);

  await db.collection('reading_progress').createIndexes([
    { key: { user_id: 1, book_id: 1 }, unique: true, name: 'reading_progress_user_book_uq' },
  ]);

  await db.collection('audit_logs').createIndexes([
    { key: { created_at: -1 }, name: 'audit_logs_created_at' },
    { key: { actor_id: 1, created_at: -1 }, name: 'audit_logs_actor_created' },
  ]);

  console.log(
    '✓ profiles, authors, books (+text), orders (stripe_payment_intent_id), reviews, reading_progress, audit_logs'
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
