import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthorForUser } from '@/lib/supabase/portal-queries';
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

  // authors has no RLS SELECT policy, so resolve the author row server-side.
  const author = await getAuthorForUser(user.id);

  if (!author) {
    return { author: null, books: [], manuscripts: [], earnings: 0 };
  }

  // PERF-PHASE2-3 — Parallelize independent queries
  const [{ data: books }, { data: manuscripts }] = await Promise.all([
    supabase.from('books').select('*').eq('author_id', author.id),
    supabase
      .from('manuscripts')
      .select('*')
      .eq('author_id', author.id)
      .order('created_at', { ascending: false }),
  ]);

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
            <h1 className="mb-4 text-2xl font-bold">Author profile not found</h1>
            <p className="mb-4 text-secondary">Please complete your author profile setup.</p>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container>
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold">Author Dashboard</h1>
          <Button asChild>
            <Link href="/author/submit">Submit Manuscript</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
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
        <div className="grid gap-6 md:grid-cols-2">
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
                        className="transition-colors hover:text-primary"
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
                        className="transition-colors hover:text-primary"
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
