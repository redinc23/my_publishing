import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAuthorForUser } from '@/lib/supabase/portal-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Book, Manuscript } from '@/types';

async function getAnalyticsData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const author = await getAuthorForUser(user.id);

  if (!author) {
    return { author: null, books: [], manuscripts: [] };
  }

  const [{ data: books }, { data: manuscripts }] = await Promise.all([
    supabase
      .from('books')
      .select('*')
      .eq('author_id', author.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('manuscripts')
      .select('*')
      .eq('author_id', author.id)
      .order('created_at', { ascending: false }),
  ]);

  return {
    author,
    books: (books as Book[]) || [],
    manuscripts: (manuscripts as Manuscript[]) || [],
  };
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

export default async function AnalyticsPage() {
  const { author, books, manuscripts } = await getAnalyticsData();

  if (!author) {
    return (
      <Section>
        <Container>
          <h1 className="mb-4 text-4xl font-bold">Analytics</h1>
          <p className="text-secondary">Author profile not found.</p>
        </Container>
      </Section>
    );
  }

  const totalReads = books.reduce((sum, book) => sum + (book.total_reads || 0), 0);
  const ratedBooks = books.filter((book) => typeof book.average_rating === 'number');
  const averageRating =
    ratedBooks.length > 0
      ? ratedBooks.reduce((sum, book) => sum + (book.average_rating || 0), 0) / ratedBooks.length
      : 0;
  const manuscriptCounts = manuscripts.reduce<Record<string, number>>((counts, manuscript) => {
    counts[manuscript.status] = (counts[manuscript.status] || 0) + 1;
    return counts;
  }, {});

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Analytics</h1>

        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Published Books</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{books.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Reads</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalReads.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Average Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{averageRating.toFixed(1)}</p>
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
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Manuscript Status</CardTitle>
            </CardHeader>
            <CardContent>
              {manuscripts.length === 0 ? (
                <p className="text-secondary">No manuscripts submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(manuscriptCounts).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="capitalize">{formatStatus(status)}</span>
                      <Badge>{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Books Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {books.length === 0 ? (
                <p className="text-secondary">No books published yet.</p>
              ) : (
                <div className="space-y-3">
                  {books.map((book) => (
                    <Link
                      key={book.id}
                      href={`/books/${book.slug}`}
                      className="block rounded-md border border-border p-3 transition-colors hover:border-primary"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium">{book.title}</span>
                        <span className="text-sm text-secondary">
                          {(book.total_reads || 0).toLocaleString()} reads ·{' '}
                          {(book.average_rating || 0).toFixed(1)}★
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
