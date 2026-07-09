import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { AudioPlayer } from '@/components/players/AudioPlayer';
import Image from 'next/image';
import type { BookFull } from '@/types';

async function getAudiobook(id: string): Promise<BookFull | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*)), content:book_content(*)')
    .eq('id', id)
    .eq('status', 'published')
    .single();

  if (!data || !data.content?.audio_url) {
    return null;
  }

  return data as BookFull;
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
                  alt={book.title}
                  fill
                  className="rounded-lg object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="mb-4 text-4xl font-bold">{book.title}</h1>
              <p className="mb-6 text-xl text-secondary">
                by {book.author.profile?.full_name || book.author.pen_name || 'Unknown Author'}
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
