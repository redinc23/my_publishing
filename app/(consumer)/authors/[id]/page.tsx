import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Author, BookWithAuthor, Profile } from '@/types';

interface AuthorWithProfile extends Author {
  profile?: Profile;
}

async function getAuthor(id: string): Promise<AuthorWithProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('authors')
    .select('*, profile:profiles!inner(*)')
    .eq('id', id)
    .single();

  return (data as AuthorWithProfile) || null;
}

async function getAuthorBooks(profileId: string): Promise<BookWithAuthor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors!inner(*, profile:profiles!inner(*))')
    .eq('status', 'published')
    .eq('author.profile_id', profileId)
    .order('published_at', { ascending: false });

  return (data as BookWithAuthor[]) || [];
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
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-4xl font-bold mb-2">{displayName}</h1>
              <p className="text-secondary max-w-2xl">
                {author.bio || 'This author has not shared a bio yet.'}
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-secondary mt-4">
                <span>{author.total_books} published books</span>
                {author.is_verified && <span className="text-primary">Verified author</span>}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="text-3xl font-bold mb-6">Published Books</h2>
          {books.length === 0 ? (
            <p className="text-secondary">No published books yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
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
