// PERF-PHASE2-6 — Lean client island for reading interactivity
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { saveReadingProgress } from './actions';
import type { Book, ReadingProgress } from '@/types';

export type ReadingAssets = {
  epubUrl: string | null;
  pdfUrl: string | null;
  audioUrl: string | null;
};

interface ReadingClientProps {
  book: Book;
  initialProgress: ReadingProgress | null;
  assets: ReadingAssets;
}

export default function ReadingClient({ book, initialProgress, assets }: ReadingClientProps) {
  const router = useRouter();
  const [currentPosition, setCurrentPosition] = useState(initialProgress?.current_position ?? 0);
  const lastSaved = useRef(currentPosition);

  // PERF-PHASE2-6 — Debounced autosave via server action, only sends changed fields
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentPosition !== lastSaved.current) {
        lastSaved.current = currentPosition;
        saveReadingProgress(book.id, currentPosition);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentPosition, book.id]);

  const progressPercentage = currentPosition;
  const hasFile = Boolean(assets.epubUrl || assets.pdfUrl);
  const bookHref = book.slug ? `/books/${book.slug}` : '/library';

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b border-border bg-muted p-4">
        <Container>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.back()}>
                ← Back
              </Button>
              <h1 className="text-lg font-semibold">{book.title}</h1>
            </div>
            <div className="flex items-center gap-4">
              <ProgressBar value={progressPercentage} showLabel />
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Your reading progress</h2>
            <p className="mt-2 text-secondary">
              Progress autosaves about every 30 seconds while you are on this page. Use Previous /
              Next to update your place.
            </p>
            <p className="mt-4 text-lg" aria-live="polite">
              Current position: {currentPosition}%
            </p>
          </div>

          {hasFile ? (
            <div className="space-y-3 border-t border-border pt-6">
              <h2 className="text-xl font-semibold tracking-tight">Open your copy</h2>
              <p className="text-secondary">
                In-browser paging for EPUB/PDF is not available yet. Open the file you purchased:
              </p>
              <div className="flex flex-wrap gap-3">
                {assets.pdfUrl ? (
                  <Button asChild>
                    <a href={assets.pdfUrl} target="_blank" rel="noopener noreferrer">
                      Open PDF
                    </a>
                  </Button>
                ) : null}
                {assets.epubUrl ? (
                  <Button asChild variant="outline">
                    <a href={assets.epubUrl} target="_blank" rel="noopener noreferrer">
                      Open EPUB
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-6">
              <h2 className="text-xl font-semibold tracking-tight">Reader content</h2>
              <p className="text-secondary">
                The full in-browser reader is not available for this title yet. Your purchase and
                progress are saved — return from your library when a file or reader becomes
                available.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link href="/library">Back to library</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href={bookHref}>View book page</Link>
                </Button>
              </div>
            </div>
          )}

          {assets.audioUrl ? (
            <div className="space-y-3 border-t border-border pt-6">
              <h2 className="text-xl font-semibold tracking-tight">Listen instead</h2>
              <p className="text-secondary">This title has an audio edition you can play now.</p>
              <Button asChild variant="outline">
                <Link href={`/audio/${book.id}`}>Open audio player</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </Container>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-muted p-4">
        <Container>
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentPosition(Math.max(0, currentPosition - 1))}
            >
              ← Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPosition(Math.min(100, currentPosition + 1))}
            >
              Next →
            </Button>
          </div>
        </Container>
      </div>
    </div>
  );
}
