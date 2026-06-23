// PERF-PHASE2-1
import { Suspense } from 'react';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookFilters } from '../books/BookFilters';
import { BookListStream } from '../components/BookListStream';
import { BooksSkeleton } from '../components/BooksSkeleton';

interface ComicsPageProps {
  searchParams: { q?: string; genre?: string; sort?: string; page?: string };
}

export default async function ComicsPage({ searchParams }: ComicsPageProps) {
  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-8">Browse Comic Books</h1>
        <BookFilters />
        <Suspense fallback={<BooksSkeleton />}>
          <BookListStream
            contentType="comic"
            searchParams={searchParams}
            emptyMessage="No comics found. Try adjusting your filters."
          />
        </Suspense>
      </Container>
    </Section>
  );
}
