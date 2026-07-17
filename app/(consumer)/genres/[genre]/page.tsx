import type { Metadata } from 'next';
import { createPublicCatalogClient, PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import type { BookWithAuthor } from '@/types';

async function getBooksByGenre(genre: string): Promise<BookWithAuthor[]> {
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('genre', genre)
    .order('published_at', { ascending: false });

  return (data as BookWithAuthor[]) || [];
}

export function generateMetadata({ params }: { params: { genre: string } }): Metadata {
  const genre = decodeURIComponent(params.genre);

  return {
    title: `${genre} Books`,
    description: `Browse ${genre} books, comics, audiobooks, and papers on MANGU Publishers.`,
  };
}

export default async function GenrePage({ params }: { params: { genre: string } }) {
  const genre = decodeURIComponent(params.genre);
  const books = await getBooksByGenre(genre);

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold capitalize">{genre}</h1>
        {books.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-secondary">No books found in this genre.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
