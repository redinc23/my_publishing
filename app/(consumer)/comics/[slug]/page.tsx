import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookCard } from '@/components/cards/BookCard';
import { AudioPlayer } from '@/components/players/AudioPlayer';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { BookFull } from '@/types';

async function getComic(slug: string): Promise<BookFull | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*)), content:book_content(*)')
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('content_type', 'comic')
    .single();
  return data as BookFull | null;
}

async function getSimilarComics(excludeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*))')
    .eq('status', 'published')
    .eq('content_type', 'comic')
    .neq('id', excludeId)
    .limit(6);
  return data || [];
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const comic = await getComic(params.slug);
  if (!comic) return { title: 'Comic Not Found - MANGU' };
  return {
    title: `${comic.title} - MANGU Comics`,
    description: comic.description || `Read ${comic.title}`,
  };
}

export default async function ComicDetailPage({ params }: { params: { slug: string } }) {
  const comic = await getComic(params.slug);
  if (!comic) notFound();
  const similarComics = await getSimilarComics(comic.id);

  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="relative mx-auto aspect-[2/3] max-w-sm">
              {comic.cover_url && (
                <Image
                  src={comic.cover_url}
                  alt={comic.title}
                  fill
                  className="rounded-lg object-cover"
                  priority
                />
              )}
            </div>
            <div>
              <h1 className="mb-4 text-4xl font-bold">{comic.title}</h1>
              <p className="mb-4 text-xl text-muted-foreground">
                by{' '}
                <Link href={`/authors/${comic.author.id}`} className="hover:text-primary">
                  {comic.author.profile?.full_name || comic.author.pen_name || 'Unknown Author'}
                </Link>
              </p>
              <p className="mb-6 text-lg">{comic.description}</p>
              <div className="mb-6 flex gap-4">
                <Button asChild size="lg">
                  <Link href={`/reading/${comic.id}`}>Read Now</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={`/checkout?book_id=${comic.id}`}>Purchase</Link>
                </Button>
              </div>
              <div className="text-2xl font-bold">
                {comic.discount_price ? (
                  <>
                    <span className="mr-2 text-muted-foreground line-through">${comic.price}</span>
                    <span className="text-primary">${comic.discount_price}</span>
                  </>
                ) : (
                  <span>${comic.price}</span>
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
              <div>
                <h3 className="mb-4 text-2xl font-bold">About this comic</h3>
                <p className="whitespace-pre-line text-lg text-muted-foreground">
                  {comic.description}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="audio" className="mt-6">
              {comic.content?.audio_url ? (
                <AudioPlayer src={comic.content.audio_url} title="Audio Sample" />
              ) : (
                <p className="text-muted-foreground">No audio sample available.</p>
              )}
            </TabsContent>
            <TabsContent value="reviews" className="mt-6">
              <p className="text-muted-foreground">Reviews coming soon.</p>
            </TabsContent>
          </Tabs>
        </Container>
      </Section>
      {similarComics.length > 0 && (
        <Section className="bg-muted">
          <Container>
            <h2 className="mb-8 text-3xl font-bold">Similar Comics</h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {similarComics.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          </Container>
        </Section>
      )}
    </div>
  );
}
