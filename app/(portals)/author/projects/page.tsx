import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { ManuscriptCard } from '@/components/cards/ManuscriptCard';
import type { Manuscript } from '@/types';
import { getAuthorContext } from '@/lib/utils/author-context';

async function getManuscripts() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { authorId } = await getAuthorContext(supabase, user.id);

  if (!authorId) {
    return [];
  }

  const { data } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });

  return (data as Manuscript[]) || [];
}

export default async function ProjectsPage() {
  const manuscripts = await getManuscripts();

  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-8">My Projects</h1>
        {manuscripts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-secondary mb-4">No manuscripts submitted yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {manuscripts.map((manuscript) => (
              <ManuscriptCard key={manuscript.id} manuscript={manuscript} />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
