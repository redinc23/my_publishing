import type { Metadata } from 'next';
import { Headphones } from 'lucide-react';
import { createPublicCatalogClient, PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { AudioCatalogCard } from '@/components/audio/AudioCatalogCard';
import { parseChapters } from '@/components/audio/parse-chapters';
import type { BookWithAuthor } from '@/types';

export const metadata: Metadata = {
  title: 'Audiobooks',
  description: 'Listen to audiobooks and audio editions from MANGU Publishers authors.',
};

interface AudiobookEntry {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  audioUrl: string;
  narrator?: string;
  durationSec?: number;
}

/**
 * book_content has no enforced narrator/duration columns today — read them
 * defensively so the rail lights up automatically if/when they exist
 * (content.narrator, content.audio_duration, or time-coded toc chapters).
 */
function toEntry(book: BookWithAuthor): AudiobookEntry | null {
  const contentRows = (book as unknown as { content?: unknown }).content;
  const rows = Array.isArray(contentRows) ? contentRows : contentRows ? [contentRows] : [];
  const row = rows.find(
    (r): r is Record<string, unknown> =>
      !!r && typeof r === 'object' && typeof (r as Record<string, unknown>).audio_url === 'string'
  );
  if (!row) return null;

  const narrator =
    (typeof row.narrator === 'string' && row.narrator) ||
    (typeof (book as unknown as Record<string, unknown>).narrator === 'string'
      ? ((book as unknown as Record<string, unknown>).narrator as string)
      : undefined);

  let durationSec: number | undefined;
  for (const key of ['audio_duration', 'duration_seconds', 'duration']) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      durationSec = value;
      break;
    }
  }
  if (durationSec === undefined) {
    const chapters = parseChapters(row.toc);
    const last = chapters[chapters.length - 1];
    if (last?.end) durationSec = last.end;
  }

  const author =
    book.author?.profile?.full_name || book.author?.pen_name || 'Unknown Author';

  return {
    id: book.id,
    title: book.title,
    author,
    coverUrl: book.cover_url,
    audioUrl: row.audio_url as string,
    narrator: narrator || undefined,
    durationSec,
  };
}

async function getAudiobooks(): Promise<AudiobookEntry[]> {
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select(`${PUBLIC_BOOK_SELECT}, content:book_content!inner(*)`)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .not('content.audio_url', 'is', null);

  return ((data as BookWithAuthor[]) || [])
    .map(toEntry)
    .filter((entry): entry is AudiobookEntry => entry !== null);
}

export default async function AudioPage() {
  const books = await getAudiobooks();

  return (
    <Section>
      <Container>
        <div className="mb-8 flex items-center gap-3">
          <Headphones className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Audiobooks</h1>
            <p className="mt-1 text-secondary">
              Press play instantly — your place is saved automatically.
            </p>
          </div>
        </div>
        {books.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-secondary">No audiobooks available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {books.map((book) => (
              <AudioCatalogCard
                key={book.id}
                id={book.id}
                title={book.title}
                author={book.author}
                coverUrl={book.coverUrl}
                audioUrl={book.audioUrl}
                narrator={book.narrator}
                durationSec={book.durationSec}
              />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
