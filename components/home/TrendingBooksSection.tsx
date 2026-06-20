import { getTrendingBooks } from '@/lib/supabase/queries';
import { BookCard } from '@/components/cards/BookCard';
import { Container } from '@/components/layout/Container';
import { TrendingUp, BookOpen } from 'lucide-react';

export async function TrendingBooksSection() {
  const { data: books, error } = await getTrendingBooks(10);

  if (error || !books || books.length === 0) {
    return (
      <section className="py-16 bg-muted/10 border-y border-border/50">
        <Container>
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Trending Now</h2>
            <p className="text-muted-foreground">
              No trending books available at the moment. Check back soon!
            </p>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="py-16 bg-muted/10 border-y border-border/50">
      <Container>
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight">Trending Now</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {books.map((book) => (
            <BookCard key={book.id} book={book} variant="default" />
          ))}
        </div>
      </Container>
    </section>
  );
}
