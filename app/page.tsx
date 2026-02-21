import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Hero } from '@/components/layout/Hero';
import { BookCard } from '@/components/cards/BookCard';
import { VideoHero } from '@/components/players/VideoHero';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import Link from 'next/link';
import type { BookWithAuthor } from '@/types';
import { shouldUseMocks, getMockFeaturedBooks, getMockTrendingBooks } from '@/lib/utils/mock-data';

async function getFeaturedBooks(): Promise<BookWithAuthor[]> {
  // Use mock data if in mock mode
  if (shouldUseMocks()) {
    return getMockFeaturedBooks();
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('books')
      .select('*, author:authors!inner(*, profile:profiles!inner(*))')
      .eq('status', 'published')
      .eq('is_featured', true)
      .order('published_at', { ascending: false })
      .limit(6);

    // Fallback to mock data if query returns empty or error
    if (error || !data || data.length === 0) {
      if (error) {
        console.warn('Error fetching featured books, using mock data:', error.message);
      }
      return getMockFeaturedBooks();
    }

    return (data as BookWithAuthor[]) || [];
  } catch (error) {
    console.warn('Exception fetching featured books, using mock data:', error);
    return getMockFeaturedBooks();
  }
}

async function getTrendingBooks(): Promise<BookWithAuthor[]> {
  // Use mock data if in mock mode
  if (shouldUseMocks()) {
    return getMockTrendingBooks();
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('books')
      .select('*, author:authors!inner(*, profile:profiles!inner(*))')
      .eq('status', 'published')
      .order('total_reads', { ascending: false })
      .limit(10);

    // Fallback to mock data if query returns empty or error
    if (error || !data || data.length === 0) {
      if (error) {
        console.warn('Error fetching trending books, using mock data:', error.message);
      }
      return getMockTrendingBooks();
    }

    return (data as BookWithAuthor[]) || [];
  } catch (error) {
    console.warn('Exception fetching trending books, using mock data:', error);
    return getMockTrendingBooks();
  }
}

function BookGrid({ books }: { books: BookWithAuthor[] }) {
  if (books.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary">No books available at the moment.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const [featuredBooks, trendingBooks] = await Promise.all([
    getFeaturedBooks(),
    getTrendingBooks(),
  ]);
  const heroBook = featuredBooks[0] || trendingBooks[0];

  return (
    <>
      {/* Hero Section */}
      <Hero className="relative min-h-[80vh]">
        <VideoHero
          vimeoId={heroBook?.trailer_vimeo_id || null}
          fallbackImage={heroBook?.cover_url || undefined}
          title={heroBook?.title}
        />
        <div className="relative z-10 w-full">
          <Container>
            <div className="max-w-2xl pt-32 pb-16">
              {heroBook && (
                <>
                  <h1 className="text-5xl md:text-6xl font-bold mb-4 drop-shadow-lg">
                    {heroBook.title}
                  </h1>
                  <p className="text-xl mb-8 text-secondary drop-shadow">
                    by {heroBook.author.profile?.full_name || heroBook.author.pen_name || heroBook.author.full_name || 'Unknown Author'}
                  </p>
                  <div className="flex gap-4">
                    <Button asChild size="lg">
                      <Link href={`/books/${heroBook.slug}`}>Read Now</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link href={`/books/${heroBook.slug}`}>Learn More</Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Container>
        </div>
      </Hero>

      {/* Featured Books */}
      <Section>
        <Container>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Featured Books</h2>
            <Button asChild variant="ghost">
              <Link href="/books?featured=true">View All</Link>
            </Button>
          </div>
          <Suspense fallback={<LoadingSpinner />}>
            <BookGrid books={featuredBooks} />
          </Suspense>
        </Container>
      </Section>

      {/* Trending Books */}
      <Section className="bg-muted">
        <Container>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Trending Now</h2>
            <Button asChild variant="ghost">
              <Link href="/books?sort=trending">View All</Link>
            </Button>
          </div>
          <Suspense fallback={<LoadingSpinner />}>
            <BookGrid books={trendingBooks} />
          </Suspense>
        </Container>
      </Section>

      {/* CTA Section */}
      <Section>
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold mb-4">Start Your Reading Journey</h2>
            <p className="text-lg text-secondary mb-8">
              Discover thousands of books, connect with authors, and join a community of readers.
            </p>
            <div className="flex gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/books">Browse Books</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/discover">Discover</Link>
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
