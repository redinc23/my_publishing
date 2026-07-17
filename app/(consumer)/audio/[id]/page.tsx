import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createPublicCatalogClient, PUBLIC_BOOK_WITH_CONTENT_SELECT } from '@/lib/supabase/public-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { AudioPlayer } from '@/components/players/AudioPlayer';
import Image from 'next/image';
import type { BookFull } from '@/types';

async function getAudiobook(id: string): Promise<BookFull | null> {
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select(PUBLIC_BOOK_WITH_CONTENT_SELECT)
    .eq('id', id)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .single();

  if (!data) return null;

  // book_content is a one-to-many join so Supabase returns an array;
  // normalise to a single object.
  const contentRow = Array.isArray(data.content) ? data.content[0] : data.content;
  if (!contentRow?.audio_url) {
    return null;
  }

  return { ...data, content: contentRow } as BookFull;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const book = await getAudiobook(params.id);

  if (!book) {
    return {
      title: 'Audiobook Not Found',
      description: 'The requested audiobook could not be found on MANGU Publishers.',
    };
  }

  const authorName = book.author?.profile?.full_name || book.author?.pen_name || 'Unknown Author';

  return {
    title: `${book.title} - Audiobook`,
    description: book.description || `Listen to ${book.title} by ${authorName} on MANGU Publishers.`,
  };
}

export default async function AudiobookPage({ params }: { params: { id: string } }) {
  const book = await getAudiobook(params.id);

  if (!book || !book.content?.audio_url) {
    notFound();
  }

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 grid gap-8 md:grid-cols-2">
            {book.cover_url && (
              <div className="relative aspect-[2/3]">
                <Image
                  src={book.cover_url}
                  alt={`Cover of ${book.title}`}
                  fill
                  className="rounded-lg object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="mb-4 text-4xl font-bold">{book.title}</h1>
              <p className="mb-6 text-xl text-secondary">
                by {book.author?.profile?.full_name || book.author?.pen_name || 'Unknown Author'}
              </p>
              <p className="mb-6 text-lg">{book.description}</p>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-6">
            <AudioPlayer src={book.content.audio_url} title={book.title} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
