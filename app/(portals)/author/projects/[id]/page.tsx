import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Manuscript } from '@/types';
import { getAuthorContext } from '@/lib/utils/author-context';

async function getManuscript(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { authorId } = await getAuthorContext(supabase, user.id);

  if (!authorId) {
    return null;
  }

  const { data } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('id', id)
    .eq('author_id', authorId)
    .single();

  return data as Manuscript | null;
}

export default async function ManuscriptDetailPage({ params }: { params: { id: string } }) {
  const manuscript = await getManuscript(params.id);

  if (!manuscript) {
    notFound();
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500',
    submitted: 'bg-blue-500',
    under_review: 'bg-yellow-500',
    revisions_requested: 'bg-orange-500',
    accepted: 'bg-green-500',
    rejected: 'bg-red-500',
    published: 'bg-primary',
  };

  return (
    <Section>
      <Container>
        <div className="max-w-4xl">
          <div className="flex items-start justify-between mb-6">
            <h1 className="text-4xl font-bold">{manuscript.title}</h1>
            <Badge
              className={`text-white ${
                statusColors[manuscript.status] || 'bg-gray-500'
              }`}
            >
              {manuscript.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-secondary">Genre:</span>
                  <p className="font-medium">{manuscript.genre}</p>
                </div>
                {manuscript.word_count && (
                  <div>
                    <span className="text-sm text-secondary">Word Count:</span>
                    <p className="font-medium">{manuscript.word_count.toLocaleString()}</p>
                  </div>
                )}
                {manuscript.target_audience && (
                  <div>
                    <span className="text-sm text-secondary">Target Audience:</span>
                    <p className="font-medium">{manuscript.target_audience}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2">{manuscript.current_stage || 'N/A'}</p>
                {manuscript.editorial_notes && (
                  <div>
                    <span className="text-sm text-secondary">Editorial Notes:</span>
                    <p className="mt-1">{manuscript.editorial_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {manuscript.synopsis && (
            <Card>
              <CardHeader>
                <CardTitle>Synopsis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line">{manuscript.synopsis}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </Container>
    </Section>
  );
}
