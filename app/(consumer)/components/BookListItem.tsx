// PERF-PHASE2-1
import { BookCard } from '@/components/cards/BookCard';
import type { BookWithAuthor } from '@/types';

function buildHref(book: BookWithAuthor): string {
  if (book.content_type === 'comic') return `/comics/${book.slug}`;
  if (book.content_type === 'paper') return `/papers/${book.slug}`;
  return `/books/${book.slug}`;
}

export function BookListItem({ book }: { book: BookWithAuthor }) {
  return <BookCard book={book} href={buildHref(book)} />;
}
