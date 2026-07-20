/**
 * Dual-run catalog page query (Phoenix WS2d).
 * Default: existing Supabase getBooksPage. Mongo: getBooks/searchBooks mapped
 * to the consumer BookWithAuthor shape expected by BookListItem / BookCard.
 */

import { cache } from 'react';
import { isMongoPrimary } from '@/lib/db/provider';
import { getBooks, searchBooks } from '@/lib/mongo-queries';
import { getBooksPage as getBooksPageSupabase } from '@/lib/supabase/queries';
import type { BookWithAuthor } from '@/types';
import type { BookWithAuthor as MongoBookWithAuthor } from '@/types/mongo';

export type BooksPageParams = {
  contentType: string;
  q?: string;
  genre?: string;
  sort?: string;
  page?: string;
};

function mapMongoBook(book: MongoBookWithAuthor): BookWithAuthor {
  const author = book.author;
  return {
    id: String(book._id),
    title: book.title,
    slug: book.slug,
    description: book.description ?? undefined,
    cover_url: book.cover_url ?? undefined,
    author_id: String(book.author_id),
    status: book.status,
    visibility: (book.visibility ?? 'public') as BookWithAuthor['visibility'],
    price: book.price ?? 0,
    genre: book.genre ?? undefined,
    content_type: book.content_type ?? 'book',
    average_rating: book.avg_rating ?? 0,
    published_at:
      book.published_at instanceof Date
        ? book.published_at.toISOString()
        : book.published_at
          ? String(book.published_at)
          : undefined,
    created_at:
      book.created_at instanceof Date ? book.created_at.toISOString() : String(book.created_at),
    updated_at:
      book.updated_at instanceof Date ? book.updated_at.toISOString() : String(book.updated_at),
    author: {
      id: author ? String(author._id) : '',
      full_name: author?.pen_name,
      pen_name: author?.pen_name,
    },
  };
}

async function getBooksPageMongo(params: BooksPageParams): Promise<BookWithAuthor[]> {
  const pageIndex = Math.max(0, parseInt(params.page || '0', 10) || 0);
  const page = pageIndex + 1; // mongo helpers are 1-based
  const perPage = 20;

  if (params.q?.trim()) {
    const result = await searchBooks(params.q.trim(), {
      status: 'published',
      page,
      perPage,
    });
    return result.items
      .filter((b) => !params.contentType || (b.content_type ?? 'book') === params.contentType)
      .filter((b) => !params.genre || b.genre === params.genre)
      .map(mapMongoBook);
  }

  const result = await getBooks(
    {
      status: 'published',
      genre: params.genre,
    },
    { page, perPage }
  );

  return result.items
    .filter((b) => !params.contentType || (b.content_type ?? 'book') === params.contentType)
    .map(mapMongoBook);
}

/** Uncached dual-run implementation (unit-testable). */
export async function getCatalogBooksPageUncached(
  params: BooksPageParams
): Promise<BookWithAuthor[]> {
  if (isMongoPrimary()) {
    return getBooksPageMongo(params);
  }
  return getBooksPageSupabase(params);
}

/**
 * Cached entry used by consumer list streams.
 */
export const getCatalogBooksPage = cache(getCatalogBooksPageUncached);
