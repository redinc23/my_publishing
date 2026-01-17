import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Book, Manuscript } from '@/types';

async function getAuthorData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'author' && profile?.role !== 'admin') {
    redirect('/');
  }

  const { data: author } = await supabase
    .from('authors')
    .select('*')
    .eq('profile_id', user.id)
    .single();

  if (!author) {
    return { author: null, books: [], manuscripts: [], earnings: 0 };
  }

  const { data: books } = await supabase
    .from('books')
    .select('*')
    .eq('author_id', author.id);

  const { data: manuscripts } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('author_id', author.id)
    .order('created_at', { ascending: false });

  // Calculate earnings (simplified - would use view in production)
  const earnings = 0;

  return {
    author,
    books: (books as Book[]) || [],
    manuscripts: (manuscripts as Manuscript[]) || [],
    earnings,
  };
}

export default async function AuthorDashboardPage() {
  const { author, books, manuscripts, earnings } = await getAuthorData();

  if (!author) {
    return (
      <Section>
        <Container>
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Author profile not found</h1>
            <p className="text-secondary mb-4">Please complete your author profile setup.</p>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Author Dashboard</h1>
          <Button asChild>
            <Link href="/author/submit">Submit Manuscript</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Total Books</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{books.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Manuscripts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{manuscripts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">${earnings.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Books</CardTitle>
            </CardHeader>
            <CardContent>
              {books.length === 0 ? (
                <p className="text-secondary">No books published yet.</p>
              ) : (
                <ul className="space-y-2">
                  {books.slice(0, 5).map((book) => (
                    <li key={book.id}>
                      <Link
                        href={`/books/${book.slug}`}
                        className="hover:text-primary transition-colors"
                      >
                        {book.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent Manuscripts</CardTitle>
            </CardHeader>
            <CardContent>
              {manuscripts.length === 0 ? (
                <p className="text-secondary">No manuscripts submitted yet.</p>
              ) : (
                <ul className="space-y-2">
                  {manuscripts.slice(0, 5).map((manuscript) => (
                    <li key={manuscript.id}>
                      <Link
                        href={`/author/projects/${manuscript.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {manuscript.title} - {manuscript.status}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
