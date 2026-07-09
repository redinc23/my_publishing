import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMockBookBySlug, shouldUseMocks } from '@/lib/utils/mock-data';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookCard } from '@/components/cards/BookCard';
import { VimeoPlayer } from '@/components/players/VimeoPlayer';
import { AudioPlayer } from '@/components/players/AudioPlayer';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { BookFull } from '@/types';

async function getBook(slug: string): Promise<BookFull | null> {
  if (shouldUseMocks()) {
    return getMockBookBySlug(slug) as BookFull | null;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*)), content:book_content(*)')
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('content_type', 'book')
    .single();

  return data as BookFull | null;
}

async function getSimilarBooks(genre: string | undefined, excludeId: string) {
  if (shouldUseMocks()) {
    return [];
  }

  const supabase = await createClient();
  let query = supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*))')
    .eq('status', 'published')
    .eq('content_type', 'book')
    .neq('id', excludeId);

  if (genre) {
    query = query.eq('genre', genre);
  }

  const { data } = await query.limit(6);

  return data || [];
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const book = await getBook(params.slug);

  if (!book) {
    return {
      title: 'Book Not Found',
    };
  }

  return {
    title: `${book.title} - MANGU`,
    description:
      book.description ||
      `Read ${book.title} by ${book.author.profile?.full_name || book.author.pen_name || 'Unknown Author'}`,
  };
}

export default async function BookDetailPage({ params }: { params: { slug: string } }) {
  const book = await getBook(params.slug);

  if (!book) {
    notFound();
  }

  const similarBooks = await getSimilarBooks(book.genre, book.id);

  return (
    <div>
      {/* Hero Section */}
      <Section className="bg-muted">
        <Container>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="relative mx-auto aspect-[2/3] max-w-sm">
              {book.cover_url && (
                <Image
                  src={book.cover_url}
                  alt={book.title}
                  fill
                  className="rounded-lg object-cover"
                  priority
                />
              )}
            </div>
            <div>
              <h1 className="mb-4 text-4xl font-bold">{book.title}</h1>
              <p className="mb-4 text-xl text-secondary">
                by{' '}
                <Link href={`/authors/${book.author.id}`} className="hover:text-primary">
                  {book.author.profile?.full_name || book.author.pen_name || 'Unknown Author'}
                </Link>
              </p>
              <div className="mb-6 flex items-center gap-4">
                {book.average_rating && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      <span>{book.average_rating.toFixed(1)}</span>
                    </div>
                    <span className="text-secondary">•</span>
                  </>
                )}
                <span className="text-secondary">{book.total_reads || 0} reads</span>
              </div>
              <p className="mb-6 text-lg">{book.description}</p>
              <div className="mb-6 flex gap-4">
                <Button asChild size="lg">
                  <Link href={`/reading/${book.id}`}>Start Reading</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={`/checkout?book_id=${book.id}`}>Purchase</Link>
                </Button>
              </div>
              {(book.amazon_url ||
                book.kindle_url ||
                book.apple_books_url ||
                book.audible_url ||
                book.barnes_noble_url ||
                book.google_play_books_url) && (
                <div className="mb-6">
                  <p className="mb-2 text-sm font-medium text-secondary">Also available at</p>
                  <div className="flex flex-wrap gap-3">
                    {book.amazon_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={book.amazon_url} target="_blank" rel="noopener noreferrer">
                          Buy on Amazon
                        </a>
                      </Button>
                    )}
                    {book.kindle_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={book.kindle_url} target="_blank" rel="noopener noreferrer">
                          Buy on Kindle
                        </a>
                      </Button>
                    )}
                    {book.apple_books_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={book.apple_books_url} target="_blank" rel="noopener noreferrer">
                          Apple Books
                        </a>
                      </Button>
                    )}
                    {book.audible_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={book.audible_url} target="_blank" rel="noopener noreferrer">
                          Audible
                        </a>
                      </Button>
                    )}
                    {book.barnes_noble_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={book.barnes_noble_url} target="_blank" rel="noopener noreferrer">
                          Barnes &amp; Noble
                        </a>
                      </Button>
                    )}
                    {book.google_play_books_url && (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={book.google_play_books_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Google Play Books
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="text-2xl font-bold">
                {book.discount_price ? (
                  <>
                    <span className="mr-2 text-secondary line-through">${book.price}</span>
                    <span className="text-primary">${book.discount_price}</span>
                  </>
                ) : (
                  <span>${book.price}</span>
                )}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Tabs Section */}
      <Section>
        <Container>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="audio">Audio Sample</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-6">
              {(book as BookFull).trailer_vimeo_id && (
                <div className="mb-8">
                  <VimeoPlayer videoId={(book as BookFull).trailer_vimeo_id!} />
                </div>
              )}
              <div>
                <h3 className="mb-4 text-2xl font-bold">About this book</h3>
                <p className="whitespace-pre-line text-lg text-secondary">{book.description}</p>
              </div>
            </TabsContent>
            <TabsContent value="audio" className="mt-6">
              {book.content?.audio_url ? (
                <AudioPlayer src={book.content.audio_url} title="Audio Sample" />
              ) : (
                <p className="text-secondary">No audio sample available.</p>
              )}
            </TabsContent>
            <TabsContent value="reviews" className="mt-6">
              <p className="text-secondary">Reviews coming soon.</p>
            </TabsContent>
          </Tabs>
        </Container>
      </Section>

      {/* Similar Books */}
      {similarBooks.length > 0 && (
        <Section className="bg-muted">
          <Container>
            <h2 className="mb-8 text-3xl font-bold">Similar Books</h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {similarBooks.map((similarBook) => (
                <BookCard key={similarBook.id} book={similarBook} />
              ))}
            </div>
          </Container>
        </Section>
      )}
    </div>
  );
}
