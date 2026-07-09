// PERF-PHASE2-1
/* eslint-disable */
import { Suspense } from 'react';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookFilters } from './BookFilters';
import { BookListStream } from '../components/BookListStream';
import { BooksSkeleton } from '../components/BooksSkeleton';

interface BooksPageProps {
  searchParams: {
    q?: string;
    genre?: string;
    sort?: string;
    page?: string;
  };
}

export default async function BooksPage({ searchParams }: BooksPageProps) {
  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Browse Books</h1>
        <BookFilters />
        <Suspense fallback={<BooksSkeleton />}>
          <BookListStream
            contentType="book"
            searchParams={searchParams}
            emptyMessage="No books found. Try adjusting your filters."
          />
        </Suspense>
      </Container>
    </Section>
  );
}
