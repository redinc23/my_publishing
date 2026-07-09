// PERF-PHASE2-1
import { Suspense } from 'react';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookFilters } from '../books/BookFilters';
import { BookListStream } from '../components/BookListStream';
import { BooksSkeleton } from '../components/BooksSkeleton';

interface PapersPageProps {
  searchParams: { q?: string; genre?: string; sort?: string; page?: string };
}

export default async function PapersPage({ searchParams }: PapersPageProps) {
  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Browse Papers</h1>
        <BookFilters />
        <Suspense fallback={<BooksSkeleton />}>
          <BookListStream
            contentType="paper"
            searchParams={searchParams}
            emptyMessage="No papers found. Try adjusting your filters."
          />
        </Suspense>
      </Container>
    </Section>
  );
}
