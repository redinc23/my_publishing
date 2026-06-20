import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/layout/Container';
import { BookCard } from '@/components/cards/BookCard';
import { Skeleton } from '@/components/ui/skeleton';
import { getFeaturedBooks } from '@/lib/supabase/queries';
import type { BookWithAuthor } from '@/types';

export async function FeaturedBooksSection() {
  const { data: books } = await getFeaturedBooks(6);
  const featuredBooks = (books as BookWithAuthor[] | null) ?? [];

  return (
    <section className="py-16 bg-background">
      <Container>
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm font-medium tracking-widest uppercase text-primary mb-2">
              Editor&apos;s Picks
            </p>
            <h2 className="text-3xl font-bold">Featured Books</h2>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:flex gap-1">
            <Link href="/books">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {featuredBooks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No featured books yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {featuredBooks.map((book) => (
              <BookCard key={book.id} book={book} variant="compact" />
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-center sm:hidden">
          <Button asChild variant="outline" size="sm">
            <Link href="/books">
              View all books <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}

export function FeaturedBooksSkeleton() {
  return (
    <section className="py-16 bg-background">
      <Container>
        <div className="flex items-end justify-between mb-8">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[2/3] w-full mb-2 rounded-lg" />
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
