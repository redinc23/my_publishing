import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createPublicCatalogClient, PUBLIC_AUTHOR_COLUMNS } from '@/lib/supabase/public-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Author, BookWithAuthor, Profile } from '@/types';
import { getSiteUrl } from '@/lib/seo/siteUrl';

interface AuthorWithProfile extends Author {
  profile?: Profile;
}

async function getAuthor(id: string): Promise<AuthorWithProfile | null> {
  const supabase = createPublicCatalogClient();
  const { data } = await supabase
    .from('authors')
    .select(PUBLIC_AUTHOR_COLUMNS)
    .eq('id', id)
    .single();

  return (data as unknown as AuthorWithProfile) || null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const author = await getAuthor(params.id);

  if (!author) {
    return {
      title: 'Author Not Found',
      description: 'The requested MANGU Publishers author profile could not be found.',
    };
  }

  const displayName = author.profile?.full_name || author.pen_name;
  const description =
    author.bio || `Read books and learn more about ${displayName}, an author on MANGU Publishers.`;
  const pageUrl = `${getSiteUrl()}/authors/${params.id}`;

  return {
    title: `${displayName} - Author`,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${displayName} - Author`,
      description,
      url: pageUrl,
    },
  };
}

async function getAuthorBooks(profileId: string): Promise<BookWithAuthor[]> {
  const supabase = createPublicCatalogClient();
  // Inner join so `.eq('author.profile_id', …)` filters instead of nulling the join.
  const { data } = await supabase
    .from('books')
    .select(`*, author:authors!inner(${PUBLIC_AUTHOR_COLUMNS})`)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('author.profile_id', profileId)
    .order('published_at', { ascending: false });

  return (data as unknown as BookWithAuthor[]) || [];
}

export default async function AuthorPage({ params }: { params: { id: string } }) {
  const author = await getAuthor(params.id);

  if (!author) {
    notFound();
  }

  const books = await getAuthorBooks(author.profile_id);
  const displayName = author.profile?.full_name || author.pen_name;
  const avatarUrl = author.photo_url || author.profile?.avatar_url || '';

  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="mb-2 text-4xl font-bold">{displayName}</h1>
              <p className="max-w-2xl text-secondary">
                {author.bio || 'This author has not shared a bio yet.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-secondary">
                <span>{author.total_books} published books</span>
                {author.is_verified && <span className="text-primary">Verified author</span>}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="mb-6 text-3xl font-bold">Published Books</h2>
          {books.length === 0 ? (
            <p className="text-secondary">No published books yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </Container>
      </Section>
    </div>
  );
}
