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

export const dynamic = 'force-dynamic';

async function getPaper(slug: string): Promise<BookFull | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*)), content:book_content(*)')
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('content_type', 'paper')
    .single();
  return data as BookFull | null;
}

async function getSimilarPapers(excludeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*))')
    .eq('status', 'published')
    .eq('content_type', 'paper')
    .neq('id', excludeId)
    .limit(6);
  return data || [];
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
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
          <div className="grid md:grid-cols-2 gap-8">
            <div className="relative aspect-[2/3] max-w-sm mx-auto">
              {paper.cover_url && (
                <Image src={paper.cover_url} alt={paper.title} fill className="object-cover rounded-lg" priority />
              )}
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-4">{paper.title}</h1>
              <p className="text-xl text-muted-foreground mb-4">
                by <Link href={`/authors/${paper.author.id}`} className="hover:text-primary">
                  {paper.author.profile?.full_name || paper.author.pen_name || 'Unknown Author'}
                </Link>
              </p>
              <p className="text-lg mb-6">{paper.description}</p>
              <div className="flex gap-4 mb-6">
                <Button asChild size="lg"><Link href={`/reading/${paper.id}`}>Read Now</Link></Button>
                <Button asChild variant="outline" size="lg"><Link href={`/checkout?book_id=${paper.id}`}>Purchase</Link></Button>
              </div>
              <div className="text-2xl font-bold">
                {paper.discount_price ? (
                  <><span className="text-muted-foreground line-through mr-2">${paper.price}</span><span className="text-primary">${paper.discount_price}</span></>
                ) : (<span>${paper.price}</span>)}
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
                <h3 className="text-2xl font-bold mb-4">About this paper</h3>
                <p className="text-lg text-muted-foreground whitespace-pre-line">{paper.description}</p>
              </div>
            </TabsContent>
            <TabsContent value="audio" className="mt-6">
              {paper.content?.audio_url ? <AudioPlayer src={paper.content.audio_url} title="Audio Sample" /> : <p className="text-muted-foreground">No audio sample available.</p>}
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
            <h2 className="text-3xl font-bold mb-8">Similar Papers</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
              {similarPapers.map((b) => (<BookCard key={b.id} book={b} />))}
            </div>
          </Container>
        </Section>
      )}
    </div>
  );
}
