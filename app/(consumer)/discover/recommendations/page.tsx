import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createPublicCatalogClient, PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { BookWithAuthor } from '@/types';
export const metadata: Metadata = {
  title: 'Recommended Books',
  description: 'Explore personalized and trending book recommendations from MANGU Publishers.',
};

async function getRecommendations() {
  // For now, return trending books
  // In production, this would call the resonance API
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('total_reads', { ascending: false })
    .limit(12);

  return (data as BookWithAuthor[]) || [];
}

export default async function RecommendationsPage() {
  const books = await getRecommendations();

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Recommended for You</h1>
        <Suspense fallback={<LoadingSpinner />}>
          {books.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-secondary">No recommendations available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
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
