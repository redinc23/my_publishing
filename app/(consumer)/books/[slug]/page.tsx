import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BookCard } from '@/components/cards/BookCard';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { AudioPlayer } from '@/components/players/AudioPlayer';
import { VimeoPlayer } from '@/components/players/VimeoPlayer';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/server';
import { getMockBookBySlug, getMockBooks, shouldUseMocks } from '@/lib/utils/mock-data';
import type { Metadata } from 'next';
import type { BookFull, BookWithAuthor } from '@/types';

type RetailLink = {
  href: string;
  label: string;
};

function getAuthorName(book: BookFull): string {
  return book.author.profile?.full_name || book.author.pen_name || 'Unknown Author';
}

function hasHref(link: { href?: string | null; label: string }): link is RetailLink {
  return Boolean(link.href);
}

function getRetailLinks(book: BookFull): RetailLink[] {
  return [
    { href: book.amazon_url, label: 'Buy on Amazon' },
    { href: book.kindle_url, label: 'Buy on Kindle' },
    { href: book.apple_books_url, label: 'Apple Books' },
    { href: book.audible_url, label: 'Audible' },
    { href: book.barnes_noble_url, label: 'Barnes & Noble' },
    { href: book.google_play_books_url, label: 'Google Play Books' },
  ].filter(hasHref);
}

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

async function getSimilarBooks(
  genre: string | undefined,
  excludeId: string
): Promise<BookWithAuthor[]> {
  if (shouldUseMocks()) {
    return getMockBooks()
      .filter((book) => book.id !== excludeId && (!genre || book.genre === genre))
      .slice(0, 6);
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

  return (data as BookWithAuthor[]) || [];
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const book = await getBook(params.slug);

  if (!book) {
    return {
      title: 'Book Not Found',
    };
  }

  return {
    title: `${book.title} - MANGU`,
    description: book.description || `Read ${book.title} by ${getAuthorName(book)}`,
  };
}

export default async function BookDetailPage({ params }: { params: { slug: string } }) {
  const book = await getBook(params.slug);

  if (!book) {
    notFound();
  }

  const similarBooks = await getSimilarBooks(book.genre, book.id);
  const authorName = getAuthorName(book);
  const retailLinks = getRetailLinks(book);

  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="relative aspect-[2/3] max-w-sm mx-auto">
              {book.cover_url && (
                <Image
                  src={book.cover_url}
                  alt={book.title}
                  fill
                  className="object-cover rounded-lg"
                  priority
                />
              )}
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-4">{book.title}</h1>
              <p className="text-xl text-secondary mb-4">
                by{' '}
                <Link href={`/authors/${book.author.id}`} className="hover:text-primary">
                  {authorName}
                </Link>
              </p>
              <div className="flex items-center gap-4 mb-6">
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
              <p className="text-lg mb-6">{book.description}</p>
              <div className="flex gap-4 mb-6">
                <Button asChild size="lg">
                  <Link href={`/reading/${book.id}`}>Start Reading</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={`/checkout?book_id=${book.id}`}>Purchase</Link>
                </Button>
              </div>
              {retailLinks.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-secondary mb-2">Also available at</p>
                  <div className="flex flex-wrap gap-3">
                    {retailLinks.map((link) => (
                      <Button key={link.label} asChild variant="outline" size="sm">
                        <a href={link.href} target="_blank" rel="noopener noreferrer">
                          {link.label}
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-2xl font-bold">
                {book.discount_price ? (
                  <>
                    <span className="text-secondary line-through mr-2">${book.price}</span>
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

      <Section>
        <Container>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="audio">Audio Sample</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-6">
              {book.trailer_vimeo_id && (
                <div className="mb-8">
                  <VimeoPlayer videoId={book.trailer_vimeo_id} />
                </div>
              )}
              <div>
                <h3 className="text-2xl font-bold mb-4">About this book</h3>
                <p className="text-lg text-secondary whitespace-pre-line">{book.description}</p>
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

      {similarBooks.length > 0 && (
        <Section className="bg-muted">
          <Container>
            <h2 className="text-3xl font-bold mb-8">Similar Books</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
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
