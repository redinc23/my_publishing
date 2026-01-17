import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { GenreCard } from '@/components/cards/GenreCard';
import { Grid } from '@/components/layout/Grid';

async function getGenres() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('genre')
    .eq('status', 'published');

  const genreCounts: Record<string, number> = {};
  data?.forEach((book) => {
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
        <h1 className="text-4xl font-bold mb-8">Browse by Genre</h1>
        <Grid cols={4}>
          {genres.map(({ genre, count }) => (
            <GenreCard key={genre} genre={genre} bookCount={count} />
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
