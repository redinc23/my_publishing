import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import { BookFilters } from './BookFilters';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Skeleton } from '@/components/ui/skeleton';
import type { BookWithAuthor } from '@/types';

interface BooksPageProps {
  searchParams: {
    q?: string;
    genre?: string;
    sort?: string;
    page?: string;
  };
}

async function getBooks(searchParams: BooksPageProps['searchParams']) {
  const supabase = await createClient();
  let query = supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*))')
    .eq('status', 'published');

  // Search
  if (searchParams.q) {
    query = query.textSearch('title', searchParams.q, {
      type: 'websearch',
    });
  }

  // Genre filter
  if (searchParams.genre) {
    query = query.eq('genre', searchParams.genre);
  }

  // Sort
  const sort = searchParams.sort || 'published_at';
  const ascending = sort === 'price' || sort === 'title';
  query = query.order(sort, { ascending });

  // Pagination
  const page = parseInt(searchParams.page || '0');
  const pageSize = 20;
  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data } = await query;
  return (data as BookWithAuthor[]) || [];
}

function BookGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-1" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default async function BooksPage({ searchParams }: BooksPageProps) {
  const books = await getBooks(searchParams);

  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-8">Browse Books</h1>
        <BookFilters />
        <Suspense fallback={<BookGridSkeleton />}>
          {books.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-secondary">No books found. Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 mt-8">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </Suspense>
      </Container>
    </Section>
  );
}
