/**
 * Phoenix WS2c dual-run entry points for book / review / profile mutations.
 * Existing Supabase actions remain the default path; Mongo helpers activate
 * when DATABASE_PROVIDER=mongodb.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getApiRequestUser, canMutateCatalog } from '@/lib/api/request-user';
import { isMongoPrimary } from '@/lib/db/provider';
import { slugifyTitle } from '@/lib/api/serialize-mongo';
import {
  mongoInsertBook,
  mongoInsertReview,
  mongoUpdateBook,
  mongoUpdateProfile,
} from '@/lib/actions/mongo-mutations';
import { createBook, updateBook } from '@/lib/actions/books';
import type { UpdateBookInput } from '@/types/books';

export async function dualCreateBook(input: {
  title: string;
  description?: string;
  genre?: string;
  price?: number;
  status?: 'draft' | 'published' | 'archived';
  tags?: string[];
}) {
  const user = await getApiRequestUser();
  if (!user) return { success: false as const, error: 'Unauthorized' };
  if (!canMutateCatalog(user.role)) return { success: false as const, error: 'Forbidden' };

  if (!isMongoPrimary()) {
    const legacy = await createBook({
      title: input.title,
      description: input.description,
      tags: input.tags,
    });
    return legacy;
  }

  const book = await mongoInsertBook({
    title: input.title,
    slug: slugifyTitle(input.title),
    author_id: user.id,
    description: input.description,
    genre: input.genre,
    price: input.price,
    status: input.status ?? 'draft',
    tags: input.tags,
  });

  revalidatePath('/books');
  revalidatePath('/dashboard');
  revalidatePath('/admin/books');
  return { success: true as const, data: book };
}

export async function dualUpdateBook(
  id: string,
  patch: {
    title?: string;
    description?: string;
    genre?: string;
    price?: number;
    status?: 'draft' | 'published' | 'archived';
    tags?: string[];
  }
) {
  const user = await getApiRequestUser();
  if (!user) return { success: false as const, error: 'Unauthorized' };
  if (!canMutateCatalog(user.role)) return { success: false as const, error: 'Forbidden' };

  if (!isMongoPrimary()) {
    return updateBook(id, patch as UpdateBookInput);
  }

  const updated = await mongoUpdateBook(id, {
    ...patch,
    slug: patch.title ? slugifyTitle(patch.title) : undefined,
  });
  if (!updated) return { success: false as const, error: 'Book not found' };

  revalidatePath('/books');
  revalidatePath(`/books/${updated.slug}`);
  revalidatePath('/admin/books');
  return { success: true as const, data: updated };
}

export async function dualCreateReview(input: {
  book_id: string;
  book_slug?: string;
  rating: number;
  title?: string;
  content?: string;
}) {
  const user = await getApiRequestUser();
  if (!user) return { success: false as const, error: 'Unauthorized' };
  if (input.rating < 1 || input.rating > 5) {
    return { success: false as const, error: 'Rating must be 1–5' };
  }

  if (!isMongoPrimary()) {
    return { success: false as const, error: 'Use legacy review API while on Supabase' };
  }

  const result = await mongoInsertReview({
    book_id: input.book_id,
    user_id: user.id,
    rating: input.rating,
    title: input.title,
    content: input.content,
  });

  revalidatePath('/books');
  if (input.book_slug) revalidatePath(`/books/${input.book_slug}`);
  return { success: true as const, ...result };
}

export async function dualUpdateProfile(input: {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}) {
  const user = await getApiRequestUser();
  if (!user) return { success: false as const, error: 'Unauthorized' };

  if (!isMongoPrimary()) {
    return { success: false as const, error: 'Use legacy profile forms while on Supabase' };
  }

  const profile = await mongoUpdateProfile(user.id, input);
  if (!profile) return { success: false as const, error: 'Profile not found' };

  revalidatePath('/dashboard');
  revalidatePath('/settings');
  return { success: true as const, data: profile };
}
