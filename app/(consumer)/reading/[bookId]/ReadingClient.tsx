// PERF-PHASE2-6 — Lean client island for reading interactivity
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { saveReadingProgress } from './actions';
import type { Book, ReadingProgress } from '@/types';

interface ReadingClientProps {
  book: Book;
  initialProgress: ReadingProgress | null;
}

export default function ReadingClient({ book, initialProgress }: ReadingClientProps) {
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

  const progressPercentage = initialProgress ? (currentPosition / 100) * 100 : 0;

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
        <div className="mx-auto max-w-4xl">
          <div className="prose prose-invert max-w-none">
            <p className="text-lg leading-relaxed">
              Reading interface coming soon. This will display the book content based on the current
              position.
            </p>
            <p className="mt-4 text-lg leading-relaxed">Current position: {currentPosition}%</p>
          </div>
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
