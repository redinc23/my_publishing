// PERF-PHASE2-4
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getAuthorForUser } from '@/lib/supabase/portal-queries';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

interface AnalyticsPageProps {
  params: {
    id: string;
  };
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const author = await getAuthorForUser(user.id);
  if (!author) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();
  const { data: book } = await admin
    .from('books')
    .select('id, title, author_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!book) {
    notFound();
  }

  if (book.author_id !== author.id) {
    redirect('/dashboard');
  }

  return <AnalyticsDashboard bookId={params.id} />;
}
