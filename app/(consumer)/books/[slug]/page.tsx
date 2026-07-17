import { notFound } from 'next/navigation';
import {
  createPublicCatalogClient,
  PUBLIC_BOOK_SELECT,
  PUBLIC_BOOK_WITH_CONTENT_SELECT,
} from '@/lib/supabase/public-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookCard } from '@/components/cards/BookCard';
import { ReviewSection } from '@/components/books/ReviewSection';
import { VimeoPlayer } from '@/components/players/VimeoPlayer';
import { AudioPlayer } from '@/components/players/AudioPlayer';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { BookFull } from '@/types';

async function getBook(slug: string): Promise<BookFull | null> {
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select(PUBLIC_BOOK_WITH_CONTENT_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('content_type', 'book')
    .single();

  return data as BookFull | null;
}

async function getSimilarBooks(genre: string | undefined, excludeId: string) {
  const supabase = createPublicCatalogClient();
  let query = supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('content_type', 'book')
    .neq('id', excludeId);

  if (genre) {
    query = query.eq('genre', genre);
  }

  const { data } = await query.limit(6);

  return data || [];
}

async function getReviewData(bookId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reviews } = await admin
    .from('reviews')
    .select(
      `
      id,
      book_id,
      user_id,
      rating,
      title,
      content,
      is_spoiler,
      is_public,
      helpful_count,
      created_at,
      updated_at
    `
    )
    .eq('book_id', bookId)
    .eq('is_public', true)
    .order('helpful_count', { ascending: false })
    .order('created_at', { ascending: false });

  const userIds = Array.from(new Set((reviews || []).map((review) => review.user_id)));
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('user_id, full_name').in('user_id', userIds)
    : { data: [] };

  const profilesByUserId = new Map(
    (profiles || []).map((profile) => [
      profile.user_id,
      {
        id: profile.user_id,
        username: profile.full_name || 'Reader',
        full_name: profile.full_name || undefined,
      },
    ])
  );

  const normalizedReviews = (reviews || []).map((review) => ({
    ...review,
    user: profilesByUserId.get(review.user_id) || {
      id: review.user_id,
      username: 'Reader',
    },
  }));

  const totalReviews = normalizedReviews.length;
  const averageRating = totalReviews
    ? normalizedReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
    : 0;
  const ratingDistribution = normalizedReviews.reduce<Record<number, number>>((acc, review) => {
    acc[review.rating] = (acc[review.rating] || 0) + 1;
    return acc;
  }, {});

  return {
    reviews: normalizedReviews,
    averageRating,
    totalReviews,
    ratingDistribution,
    userReview: normalizedReviews.find((review) => review.user_id === user?.id),
    isAuthenticated: !!user,
  };
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
      `Read ${book.title} by ${book.author?.profile?.full_name || book.author?.pen_name || 'Unknown Author'}`,
  };
}

export default async function BookDetailPage({ params }: { params: { slug: string } }) {
  const book = await getBook(params.slug);

  if (!book) {
    notFound();
  }

  const similarBooks = await getSimilarBooks(book.genre, book.id);
  const reviewData = await getReviewData(book.id);

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
                  alt={`Cover of ${book.title}`}
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
                {book.author ? (
                  <Link href={`/authors/${book.author.id}`} className="hover:text-primary">
                    {book.author.profile?.full_name || book.author.pen_name || 'Unknown Author'}
                  </Link>
                ) : (
                  <span>Unknown Author</span>
                )}
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
            <TabsContent value="reviews" className="mt-6" id="reviews">
              <ReviewSection
                bookId={book.id}
                initialReviews={reviewData.reviews}
                averageRating={reviewData.averageRating}
                totalReviews={reviewData.totalReviews}
                ratingDistribution={reviewData.ratingDistribution}
                userReview={reviewData.userReview}
                isAuthenticated={reviewData.isAuthenticated}
              />
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
