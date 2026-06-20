import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import { BookFilters } from '../books/BookFilters';
import { Skeleton } from '@/components/ui/skeleton';
import type { BookWithAuthor } from '@/types';

interface ComicsPageProps {
  searchParams: { q?: string; genre?: string; sort?: string; page?: string };
}

async function getComics(searchParams: ComicsPageProps['searchParams']) {
  const supabase = await createClient();
  let query = supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*))')
    .eq('status', 'published')
    .eq('content_type', 'comic');

  if (searchParams.q) {
    query = query.textSearch('title', searchParams.q, { type: 'websearch' });
  }
  if (searchParams.genre) {
    query = query.eq('genre', searchParams.genre);
  }

  const sort = searchParams.sort || 'published_at';
  const ascending = sort === 'price' || sort === 'title';
  query = query.order(sort, { ascending });

  const page = parseInt(searchParams.page || '0');
  const pageSize = 20;
  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data } = await query;
  return (data as BookWithAuthor[]) || [];
}

function ComicGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-1" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default async function ComicsPage({ searchParams }: ComicsPageProps) {
  const comics = await getComics(searchParams);
  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-8">Browse Comic Books</h1>
        <BookFilters />
        <Suspense fallback={<ComicGridSkeleton />}>
          {comics.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No comics found. Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 mt-8">
              {comics.map((comic) => (
                <BookCard key={comic.id} book={comic} />
              ))}
            </div>
          )}
        </Suspense>
      </Container>
    </Section>
  );
}
