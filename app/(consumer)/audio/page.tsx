import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import type { BookWithAuthor } from '@/types';

async function getAudiobooks(): Promise<BookWithAuthor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*)), content:book_content(*)')
    .eq('status', 'published')
    .not('content.audio_url', 'is', null);

  return (data as BookWithAuthor[]) || [];
}

export default async function AudioPage() {
  const books = await getAudiobooks();

  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-8">Audiobooks</h1>
        {books.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-secondary">No audiobooks available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
