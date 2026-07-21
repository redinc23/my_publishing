/**
 * Mongo book mutations for Phoenix WS2c server actions / WS2b API.
 */

import '@/lib/server-only-guard';

import { ObjectId, type Db, type Document, type Filter } from 'mongodb';
import { getDb } from '@/lib/mongo';
import type { Book, BookStatus } from '@/types/mongo';

function coerceId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

/** Driver Filter typings assume ObjectId-only `_id`. */
function asIdFilter(filter: Document): Filter<Document> {
  return filter as unknown as Filter<Document>;
}

async function resolveDb(db?: Db): Promise<Db> {
  return db ?? getDb();
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export type CreateMongoBookInput = {
  title: string;
  description?: string;
  cover_url?: string | null;
  manuscript_url?: string | null;
  author_id: string;
  genre?: string;
  tags?: string[];
  price?: number;
  currency?: string;
  status?: BookStatus;
  slug?: string;
};

export type UpdateMongoBookInput = Partial<{
  title: string;
  description: string;
  cover_url: string | null;
  manuscript_url: string | null;
  genre: string;
  tags: string[];
  price: number;
  currency: string;
  status: BookStatus;
  slug: string;
  visibility: Book['visibility'];
}>;

export async function createBookMongo(
  input: CreateMongoBookInput,
  db?: Db
): Promise<{ book: Book } | { error: string; code: string }> {
  const database = await resolveDb(db);
  const title = input.title.trim();
  if (!title) {
    return { error: 'title is required', code: 'VALIDATION' };
  }

  const slug = (input.slug?.trim() || slugifyTitle(title)).slice(0, 120);
  if (!slug) {
    return { error: 'Could not derive slug from title', code: 'VALIDATION' };
  }

  const existing = await database.collection('books').findOne({ slug }, { projection: { _id: 1 } });
  if (existing) {
    return { error: 'A book with this slug already exists', code: 'DUPLICATE_SLUG' };
  }

  const now = new Date();
  const doc = {
    title,
    slug,
    description: input.description,
    cover_url: input.cover_url ?? null,
    manuscript_url: input.manuscript_url ?? null,
    author_id: coerceId(input.author_id),
    status: input.status ?? ('draft' as BookStatus),
    visibility: 'private' as const,
    price: input.price,
    currency: input.currency ?? 'USD',
    genre: input.genre,
    tags: input.tags ?? [],
    avg_rating: 0,
    review_count: 0,
    created_at: now,
    updated_at: now,
  };

  const result = await database.collection('books').insertOne(doc);
  return { book: { ...doc, _id: result.insertedId } as Book };
}

export async function updateBookMongo(
  id: string,
  patch: UpdateMongoBookInput,
  db?: Db
): Promise<{ book: Book } | { error: string; code: string }> {
  const database = await resolveDb(db);
  const _id = coerceId(id);

  if (patch.slug) {
    const clash = await database
      .collection('books')
      .findOne(asIdFilter({ slug: patch.slug, _id: { $ne: _id } }), { projection: { _id: 1 } });
    if (clash) {
      return { error: 'A book with this slug already exists', code: 'DUPLICATE_SLUG' };
    }
  }

  const $set: Document = { updated_at: new Date() };
  for (const key of [
    'title',
    'description',
    'cover_url',
    'manuscript_url',
    'genre',
    'tags',
    'price',
    'currency',
    'status',
    'slug',
    'visibility',
  ] as const) {
    if (patch[key] !== undefined) {
      $set[key] = patch[key];
    }
  }

  const result = await database
    .collection('books')
    .findOneAndUpdate(asIdFilter({ _id }), { $set }, { returnDocument: 'after' });

  const book = result as unknown as Book | null;
  if (!book?._id) {
    return { error: 'Book not found', code: 'NOT_FOUND' };
  }

  return { book };
}
