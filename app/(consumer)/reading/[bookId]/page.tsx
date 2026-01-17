'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Book, ReadingProgress } from '@/types';

export default function ReadingPage({ params }: { params: { bookId: string } }) {
  const router = useRouter();
  const supabase = createClient();
  const [book, setBook] = useState<Book | null>(null);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(0);

  useEffect(() => {
    async function loadBook() {
      const { data: bookData } = await supabase
        .from('books')
        .select('*')
        .eq('id', params.bookId)
        .single();

      if (bookData) {
        setBook(bookData as Book);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: progressData } = await supabase
          .from('reading_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', params.bookId)
          .single();

        if (progressData) {
          setProgress(progressData as ReadingProgress);
          setCurrentPosition(progressData.current_position);
        }
      }

      setLoading(false);
    }

    loadBook();
  }, [params.bookId, supabase]);

  useEffect(() => {
    // Auto-save progress every 30 seconds
    const interval = setInterval(async () => {
      if (!progress) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('reading_progress')
        .upsert({
          id: progress.id,
          user_id: user.id,
          book_id: params.bookId,
          current_position: currentPosition,
          is_finished: false,
        });
    }, 30000);

    return () => clearInterval(interval);
  }, [currentPosition, progress, params.bookId, supabase]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Book not found</h1>
          <Button onClick={() => router.push('/books')}>Go back</Button>
        </div>
      </div>
    );
  }

  const progressPercentage = progress ? (progress.current_position / 100) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-muted border-b border-border p-4">
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
              <Button variant="ghost" size="icon">
                ⚙️
              </Button>
            </div>
          </div>
        </Container>
      </div>

      {/* Reading Content */}
      <Container className="py-8">
        <div className="max-w-4xl mx-auto">
          <div className="prose prose-invert max-w-none">
            <p className="text-lg leading-relaxed">
              Reading interface coming soon. This will display the book content based on the
              current position.
            </p>
            <p className="text-lg leading-relaxed mt-4">
              Current position: {currentPosition}%
            </p>
          </div>
        </div>
      </Container>

      {/* Bottom Controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-muted border-t border-border p-4">
        <Container>
          <div className="flex items-center justify-between max-w-4xl mx-auto">
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
