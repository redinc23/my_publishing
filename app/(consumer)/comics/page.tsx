// PERF-PHASE2-1
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookFilters } from '../books/BookFilters';
import { BookListStream } from '../components/BookListStream';
import { BooksSkeleton } from '../components/BooksSkeleton';
export const metadata: Metadata = {
  title: 'Comic Books',
  description: 'Discover comic books and illustrated stories available on MANGU Publishers.',
};

interface ComicsPageProps {
  searchParams: { q?: string; genre?: string; sort?: string; page?: string };
}

export default async function ComicsPage({ searchParams }: ComicsPageProps) {
  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Browse Comic Books</h1>
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
