import { notFound } from 'next/navigation';
import { createPublicCatalogClient, PUBLIC_BOOK_SELECT, PUBLIC_BOOK_WITH_CONTENT_SELECT } from '@/lib/supabase/public-queries';
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

async function getPaper(slug: string): Promise<BookFull | null> {
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select(PUBLIC_BOOK_WITH_CONTENT_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('content_type', 'paper')
    .single();
  return data as BookFull | null;
}

async function getSimilarPapers(excludeId: string) {
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select(PUBLIC_BOOK_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('content_type', 'paper')
    .neq('id', excludeId)
    .limit(6);
  return data || [];
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const paper = await getPaper(params.slug);
  if (!paper) return { title: 'Paper Not Found - MANGU' };
  return {
    title: `${paper.title} - MANGU Papers`,
    description: paper.description || `Read ${paper.title}`,
  };
}

export default async function PaperDetailPage({ params }: { params: { slug: string } }) {
  const paper = await getPaper(params.slug);
  if (!paper) notFound();
  const similarPapers = await getSimilarPapers(paper.id);

  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="relative mx-auto aspect-[2/3] max-w-sm">
              {paper.cover_url && (
                <Image
                  src={paper.cover_url}
                  alt={`Cover of ${paper.title}`}
                  fill
                  className="rounded-lg object-cover"
                  priority
                />
              )}
            </div>
            <div>
              <h1 className="mb-4 text-4xl font-bold">{paper.title}</h1>
              <p className="mb-4 text-xl text-muted-foreground">
                by{' '}
                {paper.author ? (
                  <Link href={`/authors/${paper.author.id}`} className="hover:text-primary">
                    {paper.author.profile?.full_name || paper.author.pen_name || 'Unknown Author'}
                  </Link>
                ) : (
                  <span>Unknown Author</span>
                )}
              </p>
              <p className="mb-6 text-lg">{paper.description}</p>
              <div className="mb-6 flex gap-4">
                <Button asChild size="lg">
                  <Link href={`/reading/${paper.id}`}>Read Now</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={`/checkout?book_id=${paper.id}`}>Purchase</Link>
                </Button>
              </div>
              <div className="text-2xl font-bold">
                {paper.discount_price ? (
                  <>
                    <span className="mr-2 text-muted-foreground line-through">${paper.price}</span>
                    <span className="text-primary">${paper.discount_price}</span>
                  </>
                ) : (
                  <span>${paper.price}</span>
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
                <h3 className="mb-4 text-2xl font-bold">About this paper</h3>
                <p className="whitespace-pre-line text-lg text-muted-foreground">
                  {paper.description}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="audio" className="mt-6">
              {paper.content?.audio_url ? (
                <AudioPlayer src={paper.content.audio_url} title="Audio Sample" />
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
      {similarPapers.length > 0 && (
        <Section className="bg-muted">
          <Container>
            <h2 className="mb-8 text-3xl font-bold">Similar Papers</h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {similarPapers.map((b) => (
                <BookCard key={b.id} book={b} href={`/papers/${b.slug}`} />
              ))}
            </div>
          </Container>
        </Section>
      )}
    </div>
  );
}
