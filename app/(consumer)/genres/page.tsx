import type { Metadata } from 'next';
import { createPublicCatalogClient } from '@/lib/supabase/public-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { GenreCard } from '@/components/cards/GenreCard';
import { Grid } from '@/components/layout/Grid';
export const metadata: Metadata = {
  title: 'Browse Genres',
  description: 'Explore books, comics, audiobooks, and papers by genre on MANGU Publishers.',
};

async function getGenres() {
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('books')
    .select('genre')
    .eq('status', 'published')
    .eq('visibility', 'public');

  const genreCounts: Record<string, number> = {};
  data?.forEach((book) => {
    if (!book.genre) return;
    genreCounts[book.genre] = (genreCounts[book.genre] || 0) + 1;
  });

  return Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

export default async function GenresPage() {
  const genres = await getGenres();

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Browse by Genre</h1>
        <Grid cols={4}>
          {genres.map(({ genre, count }) => (
            <GenreCard key={genre} genre={genre} bookCount={count} />
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
