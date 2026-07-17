import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthorForUser } from '@/lib/supabase/portal-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { ManuscriptCard } from '@/components/cards/ManuscriptCard';
import type { Manuscript } from '@/types';

async function getManuscripts() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // authors has no RLS SELECT policy, so resolve the author row server-side.
  const author = await getAuthorForUser(user.id);

  if (!author) {
    return [];
  }

  const { data } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('author_id', author.id)
    .order('created_at', { ascending: false });

  return (data as Manuscript[]) || [];
}

export default async function ProjectsPage() {
  const manuscripts = await getManuscripts();

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">My Projects</h1>
        {manuscripts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="mb-4 text-secondary">No manuscripts submitted yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {manuscripts.map((manuscript) => (
              <ManuscriptCard key={manuscript.id} manuscript={manuscript} />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
