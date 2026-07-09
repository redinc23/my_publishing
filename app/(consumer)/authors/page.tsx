import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { AuthorCard } from '@/components/cards/AuthorCard';
import type { Author, Profile } from '@/types';

export const metadata: Metadata = {
  title: 'Authors | Mangu Publishers',
  description: 'Discover the authors publishing on Mangu Publishers.',
};

export const revalidate = 300;

type AuthorWithProfile = Author & { profile: Profile };

async function getAuthors(): Promise<AuthorWithProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('authors')
    .select('*, profile:profiles!inner(*)')
    .order('total_books', { ascending: false })
    .order('created_at', { ascending: false });

  return (data as AuthorWithProfile[]) || [];
}

export default async function AuthorsPage() {
  const authors = await getAuthors();

  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <h1 className="text-4xl font-bold mb-2">Authors</h1>
          <p className="text-secondary max-w-2xl">
            Meet the storytellers behind the books on Mangu Publishers.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          {authors.length === 0 ? (
            <p className="text-secondary">No authors to show yet. Check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {authors.map((author) => (
                <AuthorCard key={author.id} author={author} />
              ))}
            </div>
          )}
        </Container>
      </Section>
    </div>
  );
}
