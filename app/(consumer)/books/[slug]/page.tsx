import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*)), content:book_content(*)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  return data as BookFull | null;
}

async function getSimilarBooks(genre: string, excludeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*))')
    .eq('status', 'published')
    .eq('genre', genre)
    .neq('id', excludeId)
    .limit(6);

  return data || [];
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
    description: book.description || `Read ${book.title} by ${book.author.profile.full_name || book.author.pen_name}`,
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
                  {book.author.profile.full_name || book.author.pen_name}
                </Link>
              </p>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">★</span>
                  <span>{book.average_rating.toFixed(1)}</span>
                </div>
                <span className="text-secondary">•</span>
                <span className="text-secondary">{book.total_reads} reads</span>
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

      {/* Similar Books */}
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
