/**
 * Mongo book mutations for API routes (Phoenix WS2b).
 * Server actions (2c.1) will reuse these helpers later.
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db } from 'mongodb';
import { getDb } from '@/lib/mongo';
import type { Book, BookStatus, BookVisibility } from '@/types/mongo';

export type CreateMongoBookInput = {
  title: string;
  description?: string;
  authorId: string;
  status?: BookStatus;
  visibility?: BookVisibility;
  price?: number;
  currency?: string;
  genre?: string;
  tags?: string[];
  cover_url?: string | null;
  manuscript_url?: string | null;
  slug?: string;
};

export type UpdateMongoBookInput = Partial<{
  title: string;
  description: string;
  status: BookStatus;
  visibility: BookVisibility;
  price: number;
  currency: string;
  genre: string;
  tags: string[];
  cover_url: string | null;
  manuscript_url: string | null;
  slug: string;
}>;

function coerceId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Ensure slug uniqueness by appending -2, -3, … when needed.
 */
export async function ensureUniqueBookSlug(
  baseSlug: string,
  db?: Db,
  excludeId?: string
): Promise<string> {
  const database = await resolveDb(db);
  const books = database.collection('books');
  let candidate = baseSlug || 'book';
  let n = 1;

  for (;;) {
    const filter: Record<string, unknown> = { slug: candidate };
    if (excludeId) {
      filter._id = { $ne: coerceId(excludeId) };
    }
    const existing = await books.findOne(filter, { projection: { _id: 1 } });
    if (!existing) return candidate;
    n += 1;
    candidate = `${baseSlug}-${n}`;
  }
}

export async function insertBook(
  input: CreateMongoBookInput,
  db?: Db
): Promise<Book> {
  const database = await resolveDb(db);
  const now = new Date();
  const baseSlug = input.slug?.trim() || slugifyTitle(input.title);
  const slug = await ensureUniqueBookSlug(baseSlug, database);

  const doc: Omit<Book, '_id'> & { _id?: ObjectId } = {
    title: input.title.trim(),
    slug,
    description: input.description?.trim(),
    cover_url: input.cover_url ?? null,
    manuscript_url: input.manuscript_url ?? null,
    author_id: coerceId(input.authorId),
    status: input.status ?? 'draft',
    visibility: input.visibility ?? 'private',
    price: input.price,
    currency: input.currency ?? 'usd',
    genre: input.genre,
    tags: input.tags ?? [],
    avg_rating: 0,
    review_count: 0,
    content_type: 'book',
    published_at: input.status === 'published' ? now : null,
    created_at: now,
    updated_at: now,
  };

  const result = await database.collection('books').insertOne(doc);
  return { ...doc, _id: result.insertedId } as Book;
}

export async function updateBookById(
  id: string,
  patch: UpdateMongoBookInput,
  db?: Db
): Promise<Book | null> {
  const database = await resolveDb(db);
  const books = database.collection('books');
  const _id = coerceId(id);

  const existing = await books.findOne({ _id });
  if (!existing) return null;

  const $set: Record<string, unknown> = { updated_at: new Date() };

  if (patch.title !== undefined) $set.title = patch.title.trim();
  if (patch.description !== undefined) $set.description = patch.description.trim();
  if (patch.status !== undefined) {
    $set.status = patch.status;
    if (patch.status === 'published' && !existing.published_at) {
      $set.published_at = new Date();
    }
  }
  if (patch.visibility !== undefined) $set.visibility = patch.visibility;
  if (patch.price !== undefined) $set.price = patch.price;
  if (patch.currency !== undefined) $set.currency = patch.currency;
  if (patch.genre !== undefined) $set.genre = patch.genre;
  if (patch.tags !== undefined) $set.tags = patch.tags;
  if (patch.cover_url !== undefined) $set.cover_url = patch.cover_url;
  if (patch.manuscript_url !== undefined) $set.manuscript_url = patch.manuscript_url;

  if (patch.slug !== undefined || patch.title !== undefined) {
    const base =
      patch.slug?.trim() ||
      (patch.title !== undefined ? slugifyTitle(patch.title) : undefined);
    if (base) {
      $set.slug = await ensureUniqueBookSlug(base, database, id);
    }
  }

  await books.updateOne({ _id }, { $set });
  const updated = await books.findOne({ _id });
  return (updated as Book | null) ?? null;
}
