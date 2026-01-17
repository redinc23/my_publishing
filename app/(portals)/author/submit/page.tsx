import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SubmitManuscriptForm } from './SubmitManuscriptForm';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';

async function checkAuthorAccess() {
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
}

export default async function SubmitManuscriptPage() {
  await checkAuthorAccess();

  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-8">Submit Manuscript</h1>
        <div className="max-w-2xl">
          <SubmitManuscriptForm />
        </div>
      </Container>
    </Section>
  );
}
