// PERF-PHASE2-1
import { BookCard } from '@/components/cards/BookCard';
import type { BookWithAuthor } from '@/types';

export function BookListItem({ book }: { book: BookWithAuthor }) {
  return <BookCard book={book} />;
}
