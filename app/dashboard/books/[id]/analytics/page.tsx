import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import { getAuthorContext } from '@/lib/utils/author-context';

interface AnalyticsPageProps {
  params: {
    id: string;
  };
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { authorId, role } = await getAuthorContext(supabase, user.id);
  const isAdmin = role === 'admin';

  // Verify book ownership
  const { data: book } = await supabase
    .from('books')
    .select('id, title, author_id')
    .eq('id', params.id)
    .single();

  if (!book || (!isAdmin && book.author_id !== authorId)) {
    redirect('/dashboard');
  }

  return <AnalyticsDashboard bookId={params.id} />;
}