import type { Metadata } from 'next';
import { createPublicCatalogClient, PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import type { BookWithAuthor } from '@/types';
export const metadata: Metadata = {
  title: 'Audiobooks',
  description: 'Listen to audiobooks and audio editions from MANGU Publishers authors.',
};

async function getAudiobooks(): Promise<BookWithAuthor[]> {
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select(`${PUBLIC_BOOK_SELECT}, content:book_content!inner(*)`)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .not('content.audio_url', 'is', null);

  return (data as BookWithAuthor[]) || [];
}

export default async function AudioPage() {
  const books = await getAudiobooks();

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Audiobooks</h1>
        {books.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-secondary">No audiobooks available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {books.map((book) => (
              <BookCard key={book.id} book={book} href={`/audio/${book.id}`} />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
