import Link from 'next/link';
import { getFeaturedBooks } from '@/lib/supabase/queries';
import { BookCard } from '@/components/cards/BookCard';
import { Container } from '@/components/layout/Container';
import { ChevronRight, BookOpen } from 'lucide-react';

export async function FeaturedBooksSection() {
  const { data: books, error } = await getFeaturedBooks(8);

  if (error || !books || books.length === 0) {
    return (
      <section className="py-16 bg-gradient-to-b from-background to-muted/20">
        <Container>
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Featured Books</h2>
            <p className="text-muted-foreground">
              No featured books available at the moment. Check back soon!
            </p>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/20">
      <Container>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight">Featured Books</h2>
          <Link
            href="/books"
            className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View All
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        <div className="relative group">
          {/* Fade indicators on edges */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/50 to-transparent z-10 pointer-events-none sm:hidden" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/50 to-transparent z-10 pointer-events-none sm:hidden" />

          <div
            className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {books.map((book) => (
              <div
                key={book.id}
                className="flex-shrink-0 w-[160px] sm:w-[180px] md:w-[200px]"
              >
                <BookCard book={book} variant="compact" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
