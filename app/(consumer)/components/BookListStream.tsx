// PERF-PHASE2-1
import { getBooksPage } from '@/lib/supabase/queries';
import { BookListItem } from './BookListItem';

interface BookListStreamProps {
  contentType: string;
  searchParams: {
    q?: string;
    genre?: string;
    sort?: string;
    page?: string;
  };
  emptyMessage?: string;
}

export async function BookListStream({
  contentType,
  searchParams,
  emptyMessage,
}: BookListStreamProps) {
  const books = await getBooksPage({
    contentType,
    q: searchParams.q,
    genre: searchParams.genre,
    sort: searchParams.sort,
    page: searchParams.page,
  });

  if (books.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          {emptyMessage || 'No items found. Try adjusting your filters.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
      {books.map((book) => (
        <BookListItem key={book.id} book={book} />
      ))}
    </div>
  );
}
