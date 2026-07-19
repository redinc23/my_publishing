import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { Clock, ListMusic, Mic } from 'lucide-react';
import {
  createPublicCatalogClient,
  PUBLIC_BOOK_WITH_CONTENT_SELECT,
} from '@/lib/supabase/public-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { AudioPlayer } from '@/components/players/AudioPlayer';
import { parseChapters } from '@/components/audio/parse-chapters';
import { formatDurationLong } from '@/components/audio/format';
import type { AudioChapter } from '@/components/audio/types';
import type { BookFull } from '@/types';

interface AudiobookData {
  book: BookFull;
  audioUrl: string;
  chapters: AudioChapter[];
  narrator?: string;
  durationSec?: number;
}

async function getAudiobook(id: string): Promise<AudiobookData | null> {
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
  const contentRow = (Array.isArray(data.content) ? data.content[0] : data.content) as
    | Record<string, unknown>
    | undefined;
  if (!contentRow || typeof contentRow.audio_url !== 'string' || !contentRow.audio_url) {
    return null;
  }

  const chapters = parseChapters(contentRow.toc);

  // narrator / duration are not enforced schema columns — pick them up
  // defensively so the page upgrades automatically when they appear.
  const narrator =
    typeof contentRow.narrator === 'string' && contentRow.narrator.trim() !== ''
      ? contentRow.narrator
      : undefined;

  let durationSec: number | undefined;
  for (const key of ['audio_duration', 'duration_seconds', 'duration']) {
    const value = contentRow[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      durationSec = value;
      break;
    }
  }
  if (durationSec === undefined) {
    const last = chapters[chapters.length - 1];
    if (last?.end) durationSec = last.end;
  }

  return {
    book: { ...data, content: contentRow } as unknown as BookFull,
    audioUrl: contentRow.audio_url,
    chapters,
    narrator,
    durationSec,
  };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const data = await getAudiobook(params.id);

  if (!data) {
    return {
      title: 'Audiobook Not Found',
      description: 'The requested audiobook could not be found on MANGU Publishers.',
    };
  }

  const { book } = data;
  const authorName = book.author?.profile?.full_name || book.author?.pen_name || 'Unknown Author';

  return {
    title: `${book.title} - Audiobook`,
    description:
      book.description || `Listen to ${book.title} by ${authorName} on MANGU Publishers.`,
  };
}

export default async function AudiobookPage({ params }: { params: { id: string } }) {
  const data = await getAudiobook(params.id);

  if (!data) {
    notFound();
  }

  const { book, audioUrl, chapters, narrator, durationSec } = data;
  const authorName =
    book.author?.profile?.full_name || book.author?.pen_name || 'Unknown Author';
  const durationLabel = durationSec ? formatDurationLong(durationSec) : '';

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
              <p className="mb-4 text-xl text-secondary">by {authorName}</p>
              {(narrator || durationLabel || chapters.length > 0) && (
                <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary">
                  {narrator && (
                    <span className="flex items-center gap-1.5">
                      <Mic className="h-4 w-4" /> Narrated by {narrator}
                    </span>
                  )}
                  {durationLabel && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> {durationLabel}
                    </span>
                  )}
                  {chapters.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <ListMusic className="h-4 w-4" /> {chapters.length} chapters
                    </span>
                  )}
                </div>
              )}
              <p className="mb-6 text-lg">{book.description}</p>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-6">
            <AudioPlayer
              src={audioUrl}
              title={book.title}
              bookId={book.id}
              author={authorName}
              narrator={narrator}
              coverUrl={book.cover_url}
              chapters={chapters}
              autoLoad
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
